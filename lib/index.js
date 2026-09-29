import { OpenWifiGuardProvider } from './OpenWifiGuard';
import { check, configure, getConfig, getResult, isBlocked, isGuardActive, isNetworkSafe, openAppSettings, openLocationSettings, openWifiSettings, requestLocationPermission, start, subscribe, waitForFirstCheck, } from './guard';
import { guardAxios, guardFetch, isUnsafeNetworkError } from './httpGuard';
/** Imperative API; the same functions are also exported individually. */
const api = {
    configure,
    getConfig,
    check,
    start,
    subscribe,
    getState: getResult,
    isGuardActive,
    isBlocked: () => isBlocked(),
    isNetworkSafe,
    waitForFirstCheck,
    requestLocationPermission,
    openWifiSettings,
    openLocationSettings,
    openAppSettings,
    guardAxios,
    guardFetch,
    isUnsafeNetworkError,
};
/**
 * `<OpenWifiGuard>` wraps the app root. Its static members are the imperative API, e.g. `OpenWifiGuard.check()`.
 */
export const OpenWifiGuard = Object.assign(OpenWifiGuardProvider, api);
export default OpenWifiGuard;
export { OpenWifiGuardProvider } from './OpenWifiGuard';
export { useOpenWifiGuard } from './useOpenWifiGuard';
export { GateScreen, UnsafeWifiIcon, darkGateTheme, getGateContent, lightGateTheme } from './GateScreen';
export { englishMessages } from './messages';
export { classify } from './classify';
export { DEFAULT_CONFIG, check, configure, getConfig, getResult as getState, isGuardActive, isNetworkSafe, openAppSettings, openLocationSettings, openWifiSettings, requestLocationPermission, start, subscribe, waitForFirstCheck, } from './guard';
export { UNSAFE_NETWORK_ERROR, assertNetworkSafe, guardAxios, guardFetch, isUnsafeNetworkError } from './httpGuard';
//# sourceMappingURL=index.js.map