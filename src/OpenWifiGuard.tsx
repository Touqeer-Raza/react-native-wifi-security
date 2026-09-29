import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, Keyboard, StyleSheet, View } from 'react-native';

import { GateScreen, type GateTheme } from './GateScreen';
import { configure, getConfig, subscribe } from './guard';
import { type AxiosLike, guardAxios, guardFetch } from './httpGuard';
import type { OpenWifiGuardMessages } from './messages';
import type { GuardResult, OpenWifiGuardConfig } from './types';
import { type OpenWifiGuardController, useOpenWifiGuard } from './useOpenWifiGuard';

export interface OpenWifiGuardProps extends OpenWifiGuardConfig {
  children?: React.ReactNode;
  /**
   * Axios instances whose requests are refused while the network isn't safe (see `guardAxios`). Installed on the
   * first render, so requests made by the app's first effects are covered. Read once; later changes are ignored.
   */
  axiosInstances?: AxiosLike[];
  /** Also refuse global `fetch` calls while the network isn't safe. Default false. Read once. */
  guardFetch?: boolean;
  /**
   * Keep the app unmounted until the first check says SAFE (default true), so no screen, query or request starts on
   * an unsafe Wi-Fi. After that the app stays mounted and the gate is drawn over it, so the session and navigation
   * survive a block.
   */
  holdAppUntilChecked?: boolean;
  /** Shown while the first check runs (usually a few ms). Default: nothing, so the native splash stays visible. */
  renderWhileChecking?: () => React.ReactNode;
  /** Replace the built-in gate screen */
  renderGate?: (guard: OpenWifiGuardController) => React.ReactNode;
  /** Text of the built-in gate screen (e.g. your translations) */
  messages?: Partial<OpenWifiGuardMessages>;
  /** Colors and fonts of the built-in gate screen */
  theme?: Partial<GateTheme>;
  darkTheme?: Partial<GateTheme>;
  /** Replaces the icon of the built-in gate screen */
  icon?: React.ReactNode;
  /** Every state change (also in 'monitor' mode) */
  onStateChange?: (result: GuardResult) => void;
  /** The gate appeared (true) or went away (false). E.g. pause data fetching, hide the splash screen. */
  onBlockedChange?: (blocked: boolean, result: GuardResult) => void;
}

const configKeys: (keyof OpenWifiGuardConfig)[] = [
  'enabled',
  'mode',
  'blockOwe',
  'blockWep',
  'blockCaptivePortal',
  'failClosed',
  'blockUnsupportedOs',
  'checkTimeoutMs',
  'debounceMs',
  'debug',
];

const pickConfig = (props: OpenWifiGuardProps): OpenWifiGuardConfig => {
  const picked: Record<string, unknown> = {};
  configKeys.forEach((key) => {
    if (props[key] !== undefined) picked[key] = props[key];
  });
  return picked as OpenWifiGuardConfig;
};

/**
 * Wrap the app's root with this. It watches the network, shows a full-screen gate while the connected Wi-Fi is
 * open (no password), WEP, Enhanced Open or behind a captive portal, and (optionally) refuses HTTP requests.
 */
export const OpenWifiGuardProvider: React.FC<OpenWifiGuardProps> = (props) => {
  const {
    children,
    axiosInstances,
    guardFetch: shouldGuardFetch = false,
    holdAppUntilChecked = true,
    renderWhileChecking,
    renderGate,
    messages,
    theme,
    darkTheme,
    icon,
    onStateChange,
    onBlockedChange,
  } = props;

  // Configure and install the HTTP guards synchronously on the first render, before any child effect runs
  const installGuards = () => {
    const removeAxios = axiosInstances?.length ? guardAxios(...axiosInstances) : () => {};
    const removeFetch = shouldGuardFetch ? guardFetch() : () => {};
    return () => {
      removeAxios();
      removeFetch();
    };
  };
  const removeGuards = useRef<null | (() => void)>(null);
  const configured = useRef(false);
  if (!configured.current) {
    configured.current = true;
    configure(pickConfig(props));
    removeGuards.current = installGuards();
  }
  useEffect(() => {
    // React StrictMode unmounts and mounts again in development: put the guards back
    if (!removeGuards.current) removeGuards.current = installGuards();
    return () => {
      removeGuards.current?.();
      removeGuards.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const configSignature = JSON.stringify(pickConfig(props));
  const firstConfig = useRef(configSignature);
  useEffect(() => {
    if (configSignature === firstConfig.current) return;
    firstConfig.current = configSignature;
    configure(JSON.parse(configSignature));
  }, [configSignature]);

  const guard = useOpenWifiGuard();
  const monitorOnly = !guard.active || getConfig().mode === 'monitor';

  // Latest callbacks without re-subscribing
  const callbacks = useRef({ onStateChange, onBlockedChange });
  callbacks.current = { onStateChange, onBlockedChange };

  useEffect(() => subscribe((result) => callbacks.current.onStateChange?.(result)), []);

  const wasBlocked = useRef(false);
  useEffect(() => {
    if (guard.blocked === wasBlocked.current) return;
    wasBlocked.current = guard.blocked;
    callbacks.current.onBlockedChange?.(guard.blocked, guard);
  }, [guard]);

  useEffect(() => {
    if (!guard.blocked) return;
    Keyboard.dismiss();
    // Android back button does nothing while blocked
    const back = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => back.remove();
  }, [guard.blocked]);

  const canStart = !holdAppUntilChecked || monitorOnly || guard.state === 'SAFE';
  const [appStarted, setAppStarted] = useState(canStart);
  useEffect(() => {
    if (canStart) setAppStarted(true);
  }, [canStart]);

  const gate = guard.blocked ? (
    <View style={styles.gate} accessibilityViewIsModal importantForAccessibility="yes">
      {renderGate ? (
        renderGate(guard)
      ) : (
        <GateScreen guard={guard} messages={messages} theme={theme} darkTheme={darkTheme} icon={icon} />
      )}
    </View>
  ) : null;

  if (!appStarted && !canStart) {
    return <>{gate ?? renderWhileChecking?.() ?? null}</>;
  }

  return (
    <>
      <View
        style={styles.app}
        accessibilityElementsHidden={guard.blocked}
        importantForAccessibility={guard.blocked ? 'no-hide-descendants' : 'auto'}
      >
        {children}
      </View>
      {gate}
    </>
  );
};

const styles = StyleSheet.create({
  app: {
    flex: 1,
  },
  gate: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
    elevation: 10000,
  },
});
