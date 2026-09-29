import type { WifiStatus } from '../types';

export const status = (overrides: Partial<WifiStatus> = {}): WifiStatus => ({
  transport: 'WIFI',
  wifiConnected: true,
  wifiSecurity: 'PERSONAL',
  captivePortal: false,
  locationPermission: 'GRANTED',
  locationServicesOn: true,
  needsLocation: false,
  supported: true,
  source: 'SECURITY_TYPE',
  ...overrides,
});

export const cellular = (): WifiStatus =>
  status({ transport: 'CELLULAR', wifiConnected: false, wifiSecurity: null, captivePortal: null, source: 'NONE' });

export const createNativeMock = (initial: WifiStatus = status()) => {
  let next: WifiStatus | Error | 'hang' = initial;
  const mock = {
    getStatus: jest.fn(() => {
      if (next === 'hang') return new Promise<WifiStatus>(() => {});
      if (next instanceof Error) return Promise.reject(next);
      return Promise.resolve(next);
    }),
    getTransport: jest.fn(() => Promise.resolve('WIFI')),
    requestLocationPermission: jest.fn(() => Promise.resolve('GRANTED')),
    openWifiSettings: jest.fn(() => Promise.resolve(true)),
    openLocationSettings: jest.fn(() => Promise.resolve(true)),
    addListener: jest.fn(),
    removeListeners: jest.fn(),
    /** What the next getStatus() returns */
    setNext(value: WifiStatus | Error | 'hang') {
      next = value;
    },
  };
  return mock;
};

export type NativeMock = ReturnType<typeof createNativeMock>;

/** Loads a fresh copy of the package with the given native module (undefined = not linked). */
export const loadPackage = (native?: NativeMock): typeof import('../index') => {
  jest.resetModules();
  const ReactNative = require('react-native');
  ReactNative.NativeModules.OpenWifiGuard = native;
  return require('../index');
};
