import { cellular, createNativeMock, loadPackage, status } from './helpers';

/** Minimal axios-like instance: runs request interceptors newest first, like axios */
const fakeAxios = () => {
  const interceptors: { id: number; fn: (config: any) => any }[] = [];
  let nextId = 0;
  const send = jest.fn((config: any) => Promise.resolve({ status: 200, config }));
  const instance = {
    interceptors: {
      request: {
        use: (fn: (config: any) => any) => {
          interceptors.push({ id: nextId, fn });
          return nextId++;
        },
        eject: (id: number) => {
          const index = interceptors.findIndex((entry) => entry.id === id);
          if (index >= 0) interceptors.splice(index, 1);
        },
      },
    },
    send,
    async request(config: any) {
      let current = config;
      for (const { fn } of [...interceptors].reverse()) current = await fn(current);
      return send(current);
    },
  };
  return instance;
};

describe('HTTP guard', () => {
  it('refuses axios requests before they are sent while unsafe, and sends them when safe', async () => {
    const native = createNativeMock(status({ wifiSecurity: 'OPEN' }));
    const pkg = loadPackage(native);
    const api = fakeAxios();
    const signer = jest.fn((config) => ({ ...config, headers: { signed: true } }));
    api.interceptors.request.use(signer);
    pkg.guardAxios(api);

    const error = await api.request({ url: '/accounts' }).catch((e) => e);
    expect(pkg.isUnsafeNetworkError(error)).toBe(true);
    expect(error).toMatchObject({ code: pkg.UNSAFE_NETWORK_ERROR, state: 'UNSAFE', config: { url: '/accounts' } });
    expect(error.response).toBeUndefined();
    // The guard runs first, so the app's own interceptor never sees a refused request
    expect(signer).not.toHaveBeenCalled();
    expect(api.send).not.toHaveBeenCalled();

    native.setNext(status({ wifiSecurity: 'PERSONAL' }));
    await pkg.check();
    await expect(api.request({ url: '/accounts' })).resolves.toMatchObject({ status: 200 });
    expect(signer).toHaveBeenCalledTimes(1);
  });

  it('waits for the first check instead of refusing during CHECKING', async () => {
    const native = createNativeMock(cellular());
    const pkg = loadPackage(native);
    const api = fakeAxios();
    pkg.guardAxios(api);
    expect(pkg.getState().state).toBe('CHECKING');
    await expect(api.request({ url: '/x' })).resolves.toMatchObject({ status: 200 });
  });

  it('installs once per instance and can be removed', async () => {
    const native = createNativeMock(status({ wifiSecurity: 'OPEN' }));
    const pkg = loadPackage(native);
    const api = fakeAxios();
    const remove = pkg.guardAxios(api);
    pkg.guardAxios(api);
    remove();
    await expect(api.request({ url: '/x' })).resolves.toMatchObject({ status: 200 });
  });

  it('guards global fetch and restores it', async () => {
    const native = createNativeMock(status({ wifiSecurity: 'OPEN' }));
    const pkg = loadPackage(native);
    const original = jest.fn(() => Promise.resolve({ ok: true }));
    (globalThis as any).fetch = original;
    const restore = pkg.guardFetch();

    await expect(fetch('https://example.com')).rejects.toMatchObject({ code: 'UNSAFE_NETWORK' });
    expect(original).not.toHaveBeenCalled();

    restore();
    expect(globalThis.fetch).toBe(original);
  });

  it('never blocks when the guard is off', async () => {
    const native = createNativeMock(status({ wifiSecurity: 'OPEN' }));
    const pkg = loadPackage(native);
    pkg.configure({ enabled: false });
    const api = fakeAxios();
    pkg.guardAxios(api);
    await expect(api.request({ url: '/x' })).resolves.toMatchObject({ status: 200 });
  });
});
