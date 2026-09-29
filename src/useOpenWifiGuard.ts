import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import {
  check,
  getResult,
  isBlocked,
  isGuardActive,
  openAppSettings,
  openLocationSettings,
  openWifiSettings,
  requestLocationPermission,
  start,
  subscribe,
} from './guard';
import type { GuardResult } from './types';

export interface OpenWifiGuardController extends GuardResult {
  /** The guard is enabled and its native module is linked */
  active: boolean;
  /** The gate covers the app (mode 'block' and the network isn't safe) */
  blocked: boolean;
  /** Re-check now */
  retry: () => Promise<void>;
  /** Show the OS location prompt (if it still can), then re-check */
  askPermission: () => Promise<void>;
  /** Android: opens the Wi-Fi panel. null on iOS (no public link). */
  openWifiSettings: (() => Promise<void>) | null;
  /** Android: location settings. iOS: the app's Settings page. */
  openLocationSettings: () => Promise<void>;
  openAppSettings: () => Promise<void>;
}

/**
 * Current guard state plus the actions a gate screen needs. Works with or without `<OpenWifiGuard>`; while any
 * component uses it, the network is being watched.
 */
export const useOpenWifiGuard = (): OpenWifiGuardController => {
  const result = useSyncExternalStore(subscribe, getResult, getResult);

  useEffect(() => start(), []);

  const retry = useCallback(async () => {
    await check();
  }, []);

  const askPermission = useCallback(async () => {
    await requestLocationPermission();
  }, []);

  const openWifi = useCallback(async () => {
    await openWifiSettings();
  }, []);

  return useMemo(
    () => ({
      ...result,
      active: isGuardActive(),
      blocked: isBlocked(result),
      retry,
      askPermission,
      openWifiSettings: Platform.OS === 'android' ? openWifi : null,
      openLocationSettings,
      openAppSettings,
    }),
    [result, retry, askPermission, openWifi],
  );
};
