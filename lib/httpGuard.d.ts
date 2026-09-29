import type { GuardState } from './types';
/** `error.code` of requests refused by the guard */
export declare const UNSAFE_NETWORK_ERROR = "UNSAFE_NETWORK";
export interface UnsafeNetworkError extends Error {
    code: typeof UNSAFE_NETWORK_ERROR;
    /** Guard state that refused the request */
    state: GuardState;
    /** The axios request config (axios guard only) */
    config?: unknown;
}
export declare const isUnsafeNetworkError: (error: unknown) => error is UnsafeNetworkError;
/** Waits for the first network check, then throws if the network isn't safe */
export declare const assertNetworkSafe: (config?: unknown, url?: unknown) => Promise<void>;
/** The part of an axios instance the guard uses (so the package doesn't depend on axios) */
export interface AxiosLike {
    interceptors: {
        request: {
            use(onFulfilled: (config: any) => any): number;
            eject(id: number): void;
        };
    };
}
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
export declare const guardAxios: (...instances: AxiosLike[]) => (() => void);
/**
 * Wraps the global `fetch` so it rejects with an UnsafeNetworkError while the network isn't safe. Covers libraries
 * that use `fetch` directly. Returns a function that restores the original `fetch`.
 */
export declare const guardFetch: () => (() => void);
