import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { check, getResult, isBlocked, isGuardActive, openAppSettings, openLocationSettings, openWifiSettings, requestLocationPermission, start, subscribe, } from './guard';
/**
 * Current guard state plus the actions a gate screen needs. Works with or without `<OpenWifiGuard>`; while any
 * component uses it, the network is being watched.
 */
export const useOpenWifiGuard = () => {
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
    return useMemo(() => ({
        ...result,
        active: isGuardActive(),
        blocked: isBlocked(result),
        retry,
        askPermission,
        openWifiSettings: Platform.OS === 'android' ? openWifi : null,
        openLocationSettings,
        openAppSettings,
    }), [result, retry, askPermission, openWifi]);
};
//# sourceMappingURL=useOpenWifiGuard.js.map