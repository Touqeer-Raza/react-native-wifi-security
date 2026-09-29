import React from 'react';
import { type GateTheme } from './GateScreen';
import { type AxiosLike } from './httpGuard';
import type { OpenWifiGuardMessages } from './messages';
import type { GuardResult, OpenWifiGuardConfig } from './types';
import { type OpenWifiGuardController } from './useOpenWifiGuard';
export interface OpenWifiGuardProps extends OpenWifiGuardConfig {
    children?: React.ReactNode;
    /**
     * Axios instances whose requests are refused while the network isn't safe (see `guardAxios`). Installed on the
     * first render, so requests made by the app's first effects are covered. Read once; later changes are ignored.
     */
    axiosInstances?: AxiosLike[];
    /** Also refuse global `fetch` calls while the network isn't safe. Default false. Read once. */
    guardFetch?: boolean;
    /**
     * Keep the app unmounted until the first check says SAFE (default true), so no screen, query or request starts on
     * an unsafe Wi-Fi. After that the app stays mounted and the gate is drawn over it, so the session and navigation
     * survive a block.
     */
    holdAppUntilChecked?: boolean;
    /** Shown while the first check runs (usually a few ms). Default: nothing, so the native splash stays visible. */
    renderWhileChecking?: () => React.ReactNode;
    /** Replace the built-in gate screen */
    renderGate?: (guard: OpenWifiGuardController) => React.ReactNode;
    /** Text of the built-in gate screen (e.g. your translations) */
    messages?: Partial<OpenWifiGuardMessages>;
    /** Colors and fonts of the built-in gate screen */
    theme?: Partial<GateTheme>;
    darkTheme?: Partial<GateTheme>;
    /** Replaces the icon of the built-in gate screen */
    icon?: React.ReactNode;
    /** Every state change (also in 'monitor' mode) */
    onStateChange?: (result: GuardResult) => void;
    /** The gate appeared (true) or went away (false). E.g. pause data fetching, hide the splash screen. */
    onBlockedChange?: (blocked: boolean, result: GuardResult) => void;
}
/**
 * Wrap the app's root with this. It watches the network, shows a full-screen gate while the connected Wi-Fi is
 * open (no password), WEP, Enhanced Open or behind a captive portal, and (optionally) refuses HTTP requests.
 */
export declare const OpenWifiGuardProvider: React.FC<OpenWifiGuardProps>;
