import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
/** Emitted by the native module on every network / permission change (no payload) */
export const NETWORK_CHANGED_EVENT = 'OpenWifiGuardChanged';
/** Typed access to the native module; null when it isn't linked (tests, web, or the app wasn't rebuilt). */
export const nativeModule = Platform.OS === 'ios' || Platform.OS === 'android'
    ? (NativeModules.OpenWifiGuard ?? null)
    : null;
let emitter = null;
export const getEmitter = () => {
    if (!nativeModule)
        return null;
    if (!emitter)
        emitter = new NativeEventEmitter(NativeModules.OpenWifiGuard);
    return emitter;
};
//# sourceMappingURL=native.js.map