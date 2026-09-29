import { AppState, Linking, Platform } from 'react-native';
import { classify } from './classify';
import { NETWORK_CHANGED_EVENT, getEmitter, nativeModule } from './native';
export const DEFAULT_CONFIG = {
    enabled: true,
    mode: 'block',
    blockOwe: true,
    blockWep: true,
    blockCaptivePortal: true,
    failClosed: true,
    blockUnsupportedOs: false,
    checkTimeoutMs: 3000,
    debounceMs: 1000,
    debug: false,
};
let config = { ...DEFAULT_CONFIG };
const listeners = new Set();
const log = (message, details) => {
    if (config.debug)
        console.log(`[OpenWifiGuard] ${message}`, details ?? '');
};
/** The guard runs only when enabled and the native module is linked; otherwise the state is always SAFE. */
const isActive = () => config.enabled && nativeModule !== null;
const offResult = (reason) => ({
    state: 'SAFE',
    cause: 'NONE',
    reason,
    canAskPermission: false,
    status: null,
});
let current = isActive()
    ? { state: 'CHECKING', cause: 'NONE', reason: 'first check pending', canAskPermission: false, status: null }
    : offResult(nativeModule ? 'guard off' : 'native module missing');
/** `force`: notify even if the state is the same (config changed, e.g. mode, which changes `isBlocked`) */
const setResult = (next, force = false) => {
    const previous = current;
    current = next;
    const changed = force ||
        next.state !== previous.state ||
        next.cause !== previous.cause ||
        next.canAskPermission !== previous.canAskPermission;
    if (changed) {
        log(`state ${next.state}`, { reason: next.reason });
        listeners.forEach((listener) => listener(next));
    }
};
const withTimeout = (promise, ms) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then((value) => {
        clearTimeout(timer);
        resolve(value);
    }, (error) => {
        clearTimeout(timer);
        reject(error);
    });
});
const runCheck = async () => {
    if (!nativeModule || !isActive())
        return;
    try {
        const status = await withTimeout(nativeModule.getStatus(), config.checkTimeoutMs);
        if (!isActive())
            return;
        const result = classify(status, config);
        log('checked', {
            transport: status.transport,
            wifiSecurity: status.wifiSecurity,
            captivePortal: status.captivePortal,
            permission: status.locationPermission,
            locationServicesOn: status.locationServicesOn,
            source: status.source,
            state: result.state,
        });
        setResult(result);
    }
    catch (error) {
        if (!isActive())
            return;
        // Couldn't read the status: block only when on Wi-Fi (fail closed), never on mobile data
        let transport = null;
        try {
            transport = await withTimeout(nativeModule.getTransport(), 1000);
        }
        catch { }
        const onWifi = transport ? transport === 'WIFI' : current.status?.wifiConnected !== false;
        log('check failed', { error: error?.message, transport, onWifi });
        setResult(onWifi && config.failClosed
            ? { state: 'CANNOT_VERIFY', cause: 'ERROR', reason: 'check failed on Wi-Fi', canAskPermission: false, status: null }
            : offResult(onWifi ? 'check failed, failClosed off' : 'check failed, not on Wi-Fi'));
    }
};
let running = null;
let rerun = false;
/** Re-checks the network now. Calls made while a check runs are coalesced into one more check. */
export const check = () => {
    if (!isActive())
        return Promise.resolve(current);
    if (running) {
        rerun = true;
        return running;
    }
    running = (async () => {
        do {
            rerun = false;
            await runCheck();
        } while (rerun);
        return current;
    })().finally(() => {
        running = null;
    });
    return running;
};
// region Config
/**
 * Sets options. Can be called any time (e.g. from remote config); the current state is re-evaluated. The
 * `<OpenWifiGuard>` component calls this with its props, so most apps never call it directly.
 */
export const configure = (options = {}) => {
    const wasActive = isActive();
    const defined = Object.fromEntries(Object.entries(options).filter(([, value]) => value !== undefined));
    config = { ...config, ...defined };
    if (!isActive()) {
        if (wasActive || current.state !== 'SAFE')
            setResult(offResult(nativeModule ? 'guard off' : 'native module missing'));
        return;
    }
    if (!wasActive) {
        setResult({ state: 'CHECKING', cause: 'NONE', reason: 'guard turned on', canAskPermission: false, status: null });
        check();
        return;
    }
    // Same network, new rules
    setResult(current.status ? classify(current.status, config) : { ...current }, true);
};
export const getConfig = () => config;
// endregion
// region State
export const getResult = () => current;
/** The guard is enabled and its native module is linked */
export const isGuardActive = () => isActive();
/** The gate should cover the app (mode 'block' and the network isn't safe) */
export const isBlocked = (result = current) => isActive() && config.mode === 'block' && result.state !== 'SAFE' && result.state !== 'CHECKING';
/** Requests may be sent: guard off, mode 'monitor', or the network is SAFE */
export const isNetworkSafe = () => !isActive() || config.mode === 'monitor' || current.state === 'SAFE';
/**
 * Resolves once the state isn't CHECKING any more (starts a check if none is running). Takes at most about
 * `checkTimeoutMs` + 1 s.
 */
export const waitForFirstCheck = () => {
    if (!isActive() || current.state !== 'CHECKING')
        return Promise.resolve();
    if (!running)
        check();
    return new Promise((resolve) => {
        const unsubscribe = subscribe((result) => {
            if (result.state !== 'CHECKING') {
                unsubscribe();
                resolve();
            }
        });
    });
};
export const subscribe = (listener) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};
// endregion
// region Monitoring
let monitorCount = 0;
let stopMonitoring = null;
const debounce = (fn, ms) => {
    let timer = null;
    const debounced = () => {
        if (timer)
            clearTimeout(timer);
        timer = setTimeout(() => {
            timer = null;
            fn();
        }, ms);
    };
    debounced.cancel = () => {
        if (timer)
            clearTimeout(timer);
        timer = null;
    };
    return debounced;
};
/**
 * Starts watching the network: checks now, on every network / permission change (debounced) and when the app comes
 * to the foreground. Reference-counted; returns a function that stops this caller's monitoring.
 */
export const start = () => {
    monitorCount += 1;
    if (monitorCount === 1) {
        const onChange = debounce(() => {
            check();
        }, config.debounceMs);
        const nativeSubscription = getEmitter()?.addListener(NETWORK_CHANGED_EVENT, onChange);
        const appState = AppState.addEventListener('change', (state) => {
            if (state === 'active')
                check();
        });
        stopMonitoring = () => {
            nativeSubscription?.remove();
            appState.remove();
            onChange.cancel();
        };
        check();
    }
    let stopped = false;
    return () => {
        if (stopped)
            return;
        stopped = true;
        monitorCount -= 1;
        if (monitorCount === 0) {
            stopMonitoring?.();
            stopMonitoring = null;
        }
    };
};
// endregion
// region Actions
/** Shows the OS location prompt (if it still can), then re-checks. */
export const requestLocationPermission = async () => {
    if (!nativeModule)
        return null;
    let permission = null;
    try {
        permission = await nativeModule.requestLocationPermission();
    }
    catch (error) {
        log('permission request failed', { error: error?.message });
    }
    await check();
    return permission;
};
/** Opens the app's page in system Settings */
export const openAppSettings = async () => {
    await Linking.openSettings().catch(() => { });
};
/** Android: Wi-Fi panel. iOS has no public link to Wi-Fi settings, so this resolves false there. */
export const openWifiSettings = async () => {
    if (Platform.OS !== 'android' || !nativeModule)
        return false;
    return nativeModule.openWifiSettings().catch(() => false);
};
/** Android: location settings. iOS: the app's Settings page (the closest public link). */
export const openLocationSettings = async () => {
    const opened = Platform.OS === 'android' && nativeModule ? await nativeModule.openLocationSettings().catch(() => false) : false;
    if (!opened)
        await openAppSettings();
};
// endregion
//# sourceMappingURL=guard.js.map