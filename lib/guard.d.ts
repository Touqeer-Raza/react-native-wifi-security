import type { GuardResult, LocationPermission, OpenWifiGuardConfig, ResolvedConfig } from './types';
export declare const DEFAULT_CONFIG: ResolvedConfig;
type Listener = (result: GuardResult) => void;
/** Re-checks the network now. Calls made while a check runs are coalesced into one more check. */
export declare const check: () => Promise<GuardResult>;
/**
 * Sets options. Can be called any time (e.g. from remote config); the current state is re-evaluated. The
 * `<OpenWifiGuard>` component calls this with its props, so most apps never call it directly.
 */
export declare const configure: (options?: OpenWifiGuardConfig) => void;
export declare const getConfig: () => Readonly<ResolvedConfig>;
export declare const getResult: () => GuardResult;
/** The guard is enabled and its native module is linked */
export declare const isGuardActive: () => boolean;
/** The gate should cover the app (mode 'block' and the network isn't safe) */
export declare const isBlocked: (result?: GuardResult) => boolean;
/** Requests may be sent: guard off, mode 'monitor', or the network is SAFE */
export declare const isNetworkSafe: () => boolean;
/**
 * Resolves once the state isn't CHECKING any more (starts a check if none is running). Takes at most about
 * `checkTimeoutMs` + 1 s.
 */
export declare const waitForFirstCheck: () => Promise<void>;
export declare const subscribe: (listener: Listener) => (() => void);
/**
 * Starts watching the network: checks now, on every network / permission change (debounced) and when the app comes
 * to the foreground. Reference-counted; returns a function that stops this caller's monitoring.
 */
export declare const start: () => (() => void);
/** Shows the OS location prompt (if it still can), then re-checks. */
export declare const requestLocationPermission: () => Promise<LocationPermission | null>;
/** Opens the app's page in system Settings */
export declare const openAppSettings: () => Promise<void>;
/** Android: Wi-Fi panel. iOS has no public link to Wi-Fi settings, so this resolves false there. */
export declare const openWifiSettings: () => Promise<boolean>;
/** Android: location settings. iOS: the app's Settings page (the closest public link). */
export declare const openLocationSettings: () => Promise<void>;
export {};
