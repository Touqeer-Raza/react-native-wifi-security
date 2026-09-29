import type { GuardResult, ResolvedConfig, WifiStatus } from './types';
export type ClassifyOptions = Pick<ResolvedConfig, 'blockOwe' | 'blockWep' | 'blockCaptivePortal' | 'failClosed' | 'blockUnsupportedOs'>;
/**
 * Decides whether the app may run on the current network. Pure function.
 *
 * Rule: the app is blocked whenever an unsafe Wi-Fi is connected, even if a VPN or mobile data carries the traffic.
 * With `failClosed`, Wi-Fi whose security can't be read also blocks, with a state that says how to fix it.
 */
export declare const classify: (status: WifiStatus, options: ClassifyOptions) => GuardResult;
