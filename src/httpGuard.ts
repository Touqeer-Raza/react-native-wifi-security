import { getConfig, getResult, isNetworkSafe, waitForFirstCheck } from './guard';
import type { GuardState } from './types';

/** `error.code` of requests refused by the guard */
export const UNSAFE_NETWORK_ERROR = 'UNSAFE_NETWORK';

export interface UnsafeNetworkError extends Error {
  code: typeof UNSAFE_NETWORK_ERROR;
  /** Guard state that refused the request */
  state: GuardState;
  /** The axios request config (axios guard only) */
  config?: unknown;
}

export const isUnsafeNetworkError = (error: unknown): error is UnsafeNetworkError =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === UNSAFE_NETWORK_ERROR;

const refuse = (config?: unknown): UnsafeNetworkError => {
  const error = new Error('Request blocked: unsafe Wi-Fi network') as UnsafeNetworkError;
  error.name = 'UnsafeNetworkError';
  error.code = UNSAFE_NETWORK_ERROR;
  error.state = getResult().state;
  if (config !== undefined) error.config = config;
  return error;
};

const logRefused = (url: unknown) => {
  if (getConfig().debug) console.log('[OpenWifiGuard] request refused', { url });
};

/** Waits for the first network check, then throws if the network isn't safe */
export const assertNetworkSafe = async (config?: unknown, url?: unknown): Promise<void> => {
  await waitForFirstCheck();
  if (isNetworkSafe()) return;
  logRefused(url);
  throw refuse(config);
};

/** The part of an axios instance the guard uses (so the package doesn't depend on axios) */
export interface AxiosLike {
  interceptors: {
    request: {
      use(onFulfilled: (config: any) => any): number;
      eject(id: number): void;
    };
  };
}

const installed = new Map<AxiosLike, number>();

/**
 * Refuses every request of the given axios instances before it is sent while the network isn't safe. Pass each
 * instance your app sends requests through, including the default `axios` export if you use it directly (for
 * example for token refresh).
 *
 * Axios runs the most recently added request interceptor first, so call this after your own interceptors are added
 * (auth headers, signing): a refused request never reaches them. The rejection has no HTTP response, so 401 / sign-out
 * handling in response interceptors is not triggered and the session survives.
 *
 * Safe to call more than once for the same instance. Returns a function that removes the guard again.
 */
export const guardAxios = (...instances: AxiosLike[]): (() => void) => {
  const added: AxiosLike[] = [];
  instances.forEach((instance) => {
    if (!instance?.interceptors || installed.has(instance)) return;
    const id = instance.interceptors.request.use(async (config: { url?: string }) => {
      await assertNetworkSafe(config, config?.url);
      return config;
    });
    installed.set(instance, id);
    added.push(instance);
  });
  return () => {
    added.forEach((instance) => {
      const id = installed.get(instance);
      if (id !== undefined) instance.interceptors.request.eject(id);
      installed.delete(instance);
    });
  };
};

let originalFetch: typeof fetch | null = null;

/**
 * Wraps the global `fetch` so it rejects with an UnsafeNetworkError while the network isn't safe. Covers libraries
 * that use `fetch` directly. Returns a function that restores the original `fetch`.
 */
export const guardFetch = (): (() => void) => {
  if (originalFetch) return () => {};
  const original = globalThis.fetch;
  if (typeof original !== 'function') return () => {};
  originalFetch = original;
  const guarded: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : (input as { url?: string })?.url;
    await assertNetworkSafe(undefined, url);
    return original(input, init);
  };
  globalThis.fetch = guarded;
  return () => {
    if (globalThis.fetch === guarded && originalFetch) globalThis.fetch = originalFetch;
    originalFetch = null;
  };
};
