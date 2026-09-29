import { cellular, createNativeMock, loadPackage, status } from './helpers';

describe('guard engine', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('is always SAFE when the native module is not linked', async () => {
    const pkg = loadPackage(undefined);
    expect(pkg.isGuardActive()).toBe(false);
    expect(pkg.getState().state).toBe('SAFE');
    expect(pkg.isNetworkSafe()).toBe(true);
    await expect(pkg.check()).resolves.toMatchObject({ state: 'SAFE' });
  });

  it('starts CHECKING and resolves the first check', async () => {
    const native = createNativeMock(status({ wifiSecurity: 'OPEN' }));
    const pkg = loadPackage(native);
    expect(pkg.getState().state).toBe('CHECKING');
    expect(pkg.isNetworkSafe()).toBe(false);
    await pkg.waitForFirstCheck();
    expect(pkg.getState().state).toBe('UNSAFE');
    expect(pkg.OpenWifiGuard.isBlocked()).toBe(true);
  });

  it('notifies subscribers only when the state changes', async () => {
    const native = createNativeMock(cellular());
    const pkg = loadPackage(native);
    const listener = jest.fn();
    pkg.subscribe(listener);
    await pkg.check();
    await pkg.check();
    expect(listener).toHaveBeenCalledTimes(1);
    native.setNext(status({ wifiSecurity: 'OPEN' }));
    await pkg.check();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ state: 'UNSAFE' }));
  });

  it('coalesces checks requested while one is running', async () => {
    const native = createNativeMock(cellular());
    const pkg = loadPackage(native);
    await Promise.all([pkg.check(), pkg.check(), pkg.check()]);
    // One running check plus one re-run for the calls made meanwhile
    expect(native.getStatus).toHaveBeenCalledTimes(2);
  });

  it('fails closed on Wi-Fi when the check times out', async () => {
    jest.useFakeTimers();
    const native = createNativeMock();
    native.setNext('hang');
    const pkg = loadPackage(native);
    const done = pkg.check();
    await jest.advanceTimersByTimeAsync(3000);
    await done;
    expect(pkg.getState()).toMatchObject({ state: 'CANNOT_VERIFY', cause: 'ERROR' });
  });

  it('stays SAFE on mobile data when the check fails', async () => {
    const native = createNativeMock();
    native.setNext(new Error('boom'));
    native.getTransport.mockResolvedValue('CELLULAR');
    const pkg = loadPackage(native);
    await pkg.check();
    expect(pkg.getState().state).toBe('SAFE');
  });

  it('does not block in monitor mode but still reports the state', async () => {
    const native = createNativeMock(status({ wifiSecurity: 'OPEN' }));
    const pkg = loadPackage(native);
    pkg.configure({ mode: 'monitor' });
    await pkg.check();
    expect(pkg.getState().state).toBe('UNSAFE');
    expect(pkg.OpenWifiGuard.isBlocked()).toBe(false);
    expect(pkg.isNetworkSafe()).toBe(true);
  });

  it('re-evaluates the last status when options change', async () => {
    const native = createNativeMock(status({ wifiSecurity: 'OWE' }));
    const pkg = loadPackage(native);
    await pkg.check();
    expect(pkg.getState().state).toBe('UNSAFE');
    pkg.configure({ blockOwe: false });
    expect(pkg.getState().state).toBe('SAFE');
    expect(native.getStatus).toHaveBeenCalledTimes(1);
  });

  it('turns off and on at runtime', async () => {
    const native = createNativeMock(status({ wifiSecurity: 'OPEN' }));
    const pkg = loadPackage(native);
    await pkg.check();
    pkg.configure({ enabled: false });
    expect(pkg.getState().state).toBe('SAFE');
    expect(pkg.isNetworkSafe()).toBe(true);
    pkg.configure({ enabled: true });
    expect(pkg.getState().state).toBe('CHECKING');
    await pkg.waitForFirstCheck();
    expect(pkg.getState().state).toBe('UNSAFE');
  });

  it('re-checks after the permission prompt', async () => {
    const native = createNativeMock(
      status({ wifiSecurity: 'UNKNOWN', needsLocation: true, locationPermission: 'NOT_ASKED' }),
    );
    const pkg = loadPackage(native);
    await pkg.check();
    expect(pkg.getState().state).toBe('NEEDS_PERMISSION');
    native.setNext(status({ wifiSecurity: 'PERSONAL' }));
    await expect(pkg.requestLocationPermission()).resolves.toBe('GRANTED');
    expect(pkg.getState().state).toBe('SAFE');
  });
});
