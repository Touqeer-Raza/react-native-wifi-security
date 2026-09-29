import { classify } from '../classify';
import { DEFAULT_CONFIG } from '../guard';
import type { WifiStatus } from '../types';

import { cellular, status } from './helpers';

const run = (s: WifiStatus, options: Partial<typeof DEFAULT_CONFIG> = {}) =>
  classify(s, { ...DEFAULT_CONFIG, ...options });

describe('classify', () => {
  it('allows anything that is not Wi-Fi', () => {
    expect(run(cellular()).state).toBe('SAFE');
    expect(run(status({ transport: 'ETHERNET', wifiConnected: false, wifiSecurity: null })).state).toBe('SAFE');
    expect(run(status({ transport: 'NONE', wifiConnected: false, wifiSecurity: null })).state).toBe('SAFE');
  });

  it('allows secured Wi-Fi', () => {
    expect(run(status({ wifiSecurity: 'PERSONAL' })).state).toBe('SAFE');
    expect(run(status({ wifiSecurity: 'ENTERPRISE' })).state).toBe('SAFE');
  });

  it('blocks open Wi-Fi, also behind a VPN or with mobile data as the default route', () => {
    expect(run(status({ wifiSecurity: 'OPEN' }))).toMatchObject({ state: 'UNSAFE', cause: 'NETWORK' });
    expect(run(status({ wifiSecurity: 'OPEN', transport: 'VPN' })).state).toBe('UNSAFE');
    expect(run(status({ wifiSecurity: 'OPEN', transport: 'CELLULAR' })).state).toBe('UNSAFE');
  });

  it('blocks WEP and OWE by default and allows them when configured', () => {
    expect(run(status({ wifiSecurity: 'WEP' })).state).toBe('UNSAFE');
    expect(run(status({ wifiSecurity: 'OWE' })).state).toBe('UNSAFE');
    expect(run(status({ wifiSecurity: 'WEP' }), { blockWep: false }).state).toBe('SAFE');
    expect(run(status({ wifiSecurity: 'OWE' }), { blockOwe: false }).state).toBe('SAFE');
  });

  it('blocks captive portals, even on secured Wi-Fi, unless turned off', () => {
    expect(run(status({ wifiSecurity: 'PERSONAL', captivePortal: true })).state).toBe('UNSAFE');
    expect(run(status({ wifiSecurity: 'PERSONAL', captivePortal: true }), { blockCaptivePortal: false }).state).toBe(
      'SAFE',
    );
  });

  describe('unknown security', () => {
    const unknown = (overrides: Partial<WifiStatus>) =>
      status({ wifiSecurity: 'UNKNOWN', needsLocation: true, source: 'NONE', ...overrides });

    it('asks for permission when it was never asked', () => {
      expect(run(unknown({ locationPermission: 'NOT_ASKED' }))).toMatchObject({
        state: 'NEEDS_PERMISSION',
        canAskPermission: true,
      });
    });

    it('can ask again after a plain denial but not after "don\'t ask again"', () => {
      expect(run(unknown({ locationPermission: 'DENIED' }))).toMatchObject({
        state: 'CANNOT_VERIFY',
        cause: 'PERMISSION',
        canAskPermission: true,
      });
      expect(run(unknown({ locationPermission: 'BLOCKED' }))).toMatchObject({
        state: 'CANNOT_VERIFY',
        cause: 'PERMISSION',
        canAskPermission: false,
      });
    });

    it('explains approximate location and location services off', () => {
      expect(run(unknown({ locationPermission: 'APPROXIMATE' })).cause).toBe('APPROXIMATE');
      expect(run(unknown({ locationPermission: 'GRANTED', locationServicesOn: false })).state).toBe('LOCATION_OFF');
      expect(run(unknown({ locationPermission: 'APPROXIMATE', locationServicesOn: false })).state).toBe(
        'LOCATION_OFF',
      );
    });

    it('reports an error when location would not help', () => {
      expect(run(unknown({ needsLocation: false }))).toMatchObject({ state: 'CANNOT_VERIFY', cause: 'ERROR' });
    });

    it('allows unverified Wi-Fi when failClosed is off', () => {
      expect(run(unknown({ locationPermission: 'NOT_ASKED' }), { failClosed: false }).state).toBe('SAFE');
      // Known-open Wi-Fi is still blocked
      expect(run(status({ wifiSecurity: 'OPEN' }), { failClosed: false }).state).toBe('UNSAFE');
    });

    it('allows unsupported OS versions unless blockUnsupportedOs', () => {
      const old = unknown({ supported: false, needsLocation: false });
      expect(run(old).state).toBe('SAFE');
      expect(run(old, { blockUnsupportedOs: true })).toMatchObject({ state: 'CANNOT_VERIFY', cause: 'UNSUPPORTED' });
    });
  });

  it('keeps the native status on the result', () => {
    const s = status({ wifiSecurity: 'OPEN' });
    expect(run(s).status).toBe(s);
  });
});
