import type { GuardCause, GuardResult, GuardState, ResolvedConfig, WifiStatus } from './types';

export type ClassifyOptions = Pick<
  ResolvedConfig,
  'blockOwe' | 'blockWep' | 'blockCaptivePortal' | 'failClosed' | 'blockUnsupportedOs'
>;

const result = (
  status: WifiStatus | null,
  state: GuardState,
  cause: GuardCause,
  reason: string,
  canAskPermission = false,
): GuardResult => ({ state, cause, reason, canAskPermission, status });

/**
 * Decides whether the app may run on the current network. Pure function.
 *
 * Rule: the app is blocked whenever an unsafe Wi-Fi is connected, even if a VPN or mobile data carries the traffic.
 * With `failClosed`, Wi-Fi whose security can't be read also blocks, with a state that says how to fix it.
 */
export const classify = (status: WifiStatus, options: ClassifyOptions): GuardResult => {
  if (!status.wifiConnected) return result(status, 'SAFE', 'NONE', `no Wi-Fi (${status.transport})`);

  if (options.blockCaptivePortal && status.captivePortal) return result(status, 'UNSAFE', 'NETWORK', 'captive portal');

  switch (status.wifiSecurity) {
    case 'OPEN':
      return result(status, 'UNSAFE', 'NETWORK', 'open Wi-Fi');
    case 'OWE':
      return options.blockOwe
        ? result(status, 'UNSAFE', 'NETWORK', 'Enhanced Open Wi-Fi')
        : result(status, 'SAFE', 'NONE', 'Enhanced Open allowed');
    case 'WEP':
      return options.blockWep
        ? result(status, 'UNSAFE', 'NETWORK', 'WEP Wi-Fi')
        : result(status, 'SAFE', 'NONE', 'WEP allowed');
    case 'PERSONAL':
    case 'ENTERPRISE':
      return result(status, 'SAFE', 'NONE', `${status.wifiSecurity.toLowerCase()} Wi-Fi`);
    default:
      break;
  }

  // Security unknown from here on
  if (!status.supported) {
    return options.blockUnsupportedOs
      ? result(status, 'CANNOT_VERIFY', 'UNSUPPORTED', 'OS has no Wi-Fi security API')
      : result(status, 'SAFE', 'NONE', 'unsupported OS allowed');
  }

  if (!options.failClosed) return result(status, 'SAFE', 'NONE', 'unverified Wi-Fi allowed (failClosed off)');

  if (!status.needsLocation) return result(status, 'CANNOT_VERIFY', 'ERROR', 'security unavailable');

  switch (status.locationPermission) {
    case 'NOT_ASKED':
      return result(status, 'NEEDS_PERMISSION', 'PERMISSION', 'location not asked', true);
    case 'DENIED':
      return result(status, 'CANNOT_VERIFY', 'PERMISSION', 'location denied', true);
    case 'BLOCKED':
      return result(status, 'CANNOT_VERIFY', 'PERMISSION', 'location blocked');
    case 'APPROXIMATE':
      return status.locationServicesOn
        ? result(status, 'CANNOT_VERIFY', 'APPROXIMATE', 'approximate location only')
        : result(status, 'LOCATION_OFF', 'LOCATION_OFF', 'location services off');
    case 'GRANTED':
    default:
      return status.locationServicesOn
        ? result(status, 'CANNOT_VERIFY', 'ERROR', 'security unavailable with location')
        : result(status, 'LOCATION_OFF', 'LOCATION_OFF', 'location services off');
  }
};
