import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Keyboard, StyleSheet, View } from 'react-native';
import { GateScreen } from './GateScreen';
import { configure, getConfig, subscribe } from './guard';
import { guardAxios, guardFetch } from './httpGuard';
import { useOpenWifiGuard } from './useOpenWifiGuard';
const configKeys = [
    'enabled',
    'mode',
    'blockOwe',
    'blockWep',
    'blockCaptivePortal',
    'failClosed',
    'blockUnsupportedOs',
    'checkTimeoutMs',
    'debounceMs',
    'debug',
];
const pickConfig = (props) => {
    const picked = {};
    configKeys.forEach((key) => {
        if (props[key] !== undefined)
            picked[key] = props[key];
    });
    return picked;
};
/**
 * Wrap the app's root with this. It watches the network, shows a full-screen gate while the connected Wi-Fi is
 * open (no password), WEP, Enhanced Open or behind a captive portal, and (optionally) refuses HTTP requests.
 */
export const OpenWifiGuardProvider = (props) => {
    const { children, axiosInstances, guardFetch: shouldGuardFetch = false, holdAppUntilChecked = true, renderWhileChecking, renderGate, messages, theme, darkTheme, icon, onStateChange, onBlockedChange, } = props;
    // Configure and install the HTTP guards synchronously on the first render, before any child effect runs
    const installGuards = () => {
        const removeAxios = axiosInstances?.length ? guardAxios(...axiosInstances) : () => { };
        const removeFetch = shouldGuardFetch ? guardFetch() : () => { };
        return () => {
            removeAxios();
            removeFetch();
        };
    };
    const removeGuards = useRef(null);
    const configured = useRef(false);
    if (!configured.current) {
        configured.current = true;
        configure(pickConfig(props));
        removeGuards.current = installGuards();
    }
    useEffect(() => {
        // React StrictMode unmounts and mounts again in development: put the guards back
        if (!removeGuards.current)
            removeGuards.current = installGuards();
        return () => {
            removeGuards.current?.();
            removeGuards.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const configSignature = JSON.stringify(pickConfig(props));
    const firstConfig = useRef(configSignature);
    useEffect(() => {
        if (configSignature === firstConfig.current)
            return;
        firstConfig.current = configSignature;
        configure(JSON.parse(configSignature));
    }, [configSignature]);
    const guard = useOpenWifiGuard();
    const monitorOnly = !guard.active || getConfig().mode === 'monitor';
    // Latest callbacks without re-subscribing
    const callbacks = useRef({ onStateChange, onBlockedChange });
    callbacks.current = { onStateChange, onBlockedChange };
    useEffect(() => subscribe((result) => callbacks.current.onStateChange?.(result)), []);
    const wasBlocked = useRef(false);
    useEffect(() => {
        if (guard.blocked === wasBlocked.current)
            return;
        wasBlocked.current = guard.blocked;
        callbacks.current.onBlockedChange?.(guard.blocked, guard);
    }, [guard]);
    useEffect(() => {
        if (!guard.blocked)
            return;
        Keyboard.dismiss();
        // Android back button does nothing while blocked
        const back = BackHandler.addEventListener('hardwareBackPress', () => true);
        return () => back.remove();
    }, [guard.blocked]);
    const canStart = !holdAppUntilChecked || monitorOnly || guard.state === 'SAFE';
    const [appStarted, setAppStarted] = useState(canStart);
    useEffect(() => {
        if (canStart)
            setAppStarted(true);
    }, [canStart]);
    const gate = guard.blocked ? (_jsx(View, { style: styles.gate, accessibilityViewIsModal: true, importantForAccessibility: "yes", children: renderGate ? (renderGate(guard)) : (_jsx(GateScreen, { guard: guard, messages: messages, theme: theme, darkTheme: darkTheme, icon: icon })) })) : null;
    if (!appStarted && !canStart) {
        return _jsx(_Fragment, { children: gate ?? renderWhileChecking?.() ?? null });
    }
    return (_jsxs(_Fragment, { children: [_jsx(View, { style: styles.app, accessibilityElementsHidden: guard.blocked, importantForAccessibility: guard.blocked ? 'no-hide-descendants' : 'auto', children: children }), gate] }));
};
const styles = StyleSheet.create({
    app: {
        flex: 1,
    },
    gate: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 10000,
        elevation: 10000,
    },
});
//# sourceMappingURL=OpenWifiGuard.js.map