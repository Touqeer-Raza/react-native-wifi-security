import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

import type { LocationPermission, Transport, WifiStatus } from './types';

interface OpenWifiGuardNativeModule {
  getStatus(): Promise<WifiStatus>;
  /** Connection type only; used when the full status fails */
  getTransport(): Promise<Transport>;
  /** Shows the OS "While using the app" prompt when it still can */
  requestLocationPermission(): Promise<LocationPermission>;
  /** Resolves false when the platform has no such screen (iOS) */
  openWifiSettings(): Promise<boolean>;
  openLocationSettings(): Promise<boolean>;
}

/** Emitted by the native module on every network / permission change (no payload) */
export const NETWORK_CHANGED_EVENT = 'OpenWifiGuardChanged';

/** Typed access to the native module; null when it isn't linked (tests, web, or the app wasn't rebuilt). */
export const nativeModule: OpenWifiGuardNativeModule | null =
  Platform.OS === 'ios' || Platform.OS === 'android'
    ? ((NativeModules.OpenWifiGuard as OpenWifiGuardNativeModule | undefined) ?? null)
    : null;

let emitter: NativeEventEmitter | null = null;

export const getEmitter = (): NativeEventEmitter | null => {
  if (!nativeModule) return null;
  if (!emitter) emitter = new NativeEventEmitter(NativeModules.OpenWifiGuard);
  return emitter;
};
