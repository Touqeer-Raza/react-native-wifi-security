/**
 * `<OpenWifiGuard>` wraps the app root. Its static members are the imperative API, e.g. `OpenWifiGuard.check()`.
 */
export declare const OpenWifiGuard: import("react").FC<import("./OpenWifiGuard").OpenWifiGuardProps> & {
    configure: (options?: import("./types").OpenWifiGuardConfig) => void;
    getConfig: () => Readonly<import("./types").ResolvedConfig>;
    check: () => Promise<import("./types").GuardResult>;
    start: () => (() => void);
    subscribe: (listener: (result: import("./types").GuardResult) => void) => (() => void);
    getState: () => import("./types").GuardResult;
    isGuardActive: () => boolean;
    isBlocked: () => boolean;
    isNetworkSafe: () => boolean;
    waitForFirstCheck: () => Promise<void>;
    requestLocationPermission: () => Promise<import("./types").LocationPermission | null>;
    openWifiSettings: () => Promise<boolean>;
    openLocationSettings: () => Promise<void>;
    openAppSettings: () => Promise<void>;
    guardAxios: (...instances: import("./httpGuard").AxiosLike[]) => (() => void);
    guardFetch: () => (() => void);
    isUnsafeNetworkError: (error: unknown) => error is import("./httpGuard").UnsafeNetworkError;
};
export default OpenWifiGuard;
export { OpenWifiGuardProvider } from './OpenWifiGuard';
export type { OpenWifiGuardProps } from './OpenWifiGuard';
export { useOpenWifiGuard } from './useOpenWifiGuard';
export type { OpenWifiGuardController } from './useOpenWifiGuard';
export { GateScreen, UnsafeWifiIcon, darkGateTheme, getGateContent, lightGateTheme } from './GateScreen';
export type { GateScreenProps, GateTheme } from './GateScreen';
export { englishMessages } from './messages';
export type { OpenWifiGuardMessages } from './messages';
export { classify } from './classify';
export { DEFAULT_CONFIG, check, configure, getConfig, getResult as getState, isGuardActive, isNetworkSafe, openAppSettings, openLocationSettings, openWifiSettings, requestLocationPermission, start, subscribe, waitForFirstCheck, } from './guard';
export { UNSAFE_NETWORK_ERROR, assertNetworkSafe, guardAxios, guardFetch, isUnsafeNetworkError } from './httpGuard';
export type { AxiosLike, UnsafeNetworkError } from './httpGuard';
export type { GuardCause, GuardMode, GuardResult, GuardState, LocationPermission, OpenWifiGuardConfig, Transport, WifiSecurity, WifiStatus, } from './types';
