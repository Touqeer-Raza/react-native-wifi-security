export type Transport = 'WIFI' | 'CELLULAR' | 'ETHERNET' | 'VPN' | 'NONE' | 'OTHER';

export type WifiSecurity = 'OPEN' | 'OWE' | 'WEP' | 'PERSONAL' | 'ENTERPRISE' | 'UNKNOWN';

/**
 * Location permission as the guard sees it.
 * - GRANTED: precise location, "While using the app" or better
 * - APPROXIMATE: approximate location only (not enough to read the Wi-Fi security)
 * - NOT_ASKED: the OS prompt can be shown
 * - DENIED: refused, but the OS prompt can be shown again (Android)
 * - BLOCKED: refused and the OS won't show the prompt again (Settings only)
 */
export type LocationPermission = 'GRANTED' | 'APPROXIMATE' | 'NOT_ASKED' | 'DENIED' | 'BLOCKED';

/** Raw status reported by the native module. SSID / BSSID are never included. */
export interface WifiStatus {
  /** What carries the traffic right now */
  transport: Transport;
  /** A Wi-Fi network is connected, even if a VPN or mobile data carries the traffic */
  wifiConnected: boolean;
  /** null when not on Wi-Fi */
  wifiSecurity: WifiSecurity | null;
  /** Android only; null on iOS or when not on Wi-Fi */
  captivePortal: boolean | null;
  locationPermission: LocationPermission;
  locationServicesOn: boolean;
  /** The security type couldn't be read, and location permission / services would allow it */
  needsLocation: boolean;
  /** The OS has an API for the Wi-Fi security type (false on iOS 13–14) */
  supported: boolean;
  /** How the security was read (debug only) */
  source: 'SECURITY_TYPE' | 'SCAN_RESULTS' | 'HOTSPOT' | 'NONE';
}

export type GuardState =
  /** First check hasn't finished yet */
  | 'CHECKING'
  /** Not on Wi-Fi, or on a secured Wi-Fi */
  | 'SAFE'
  /** Open / WEP / OWE / captive-portal Wi-Fi */
  | 'UNSAFE'
  /** On Wi-Fi; reading the security needs location permission that hasn't been asked for yet */
  | 'NEEDS_PERMISSION'
  /** On Wi-Fi; location services are off */
  | 'LOCATION_OFF'
  /** On Wi-Fi; security can't be read (permission refused, approximate only, error, timeout, unsupported OS) */
  | 'CANNOT_VERIFY';

/** What the user can do about a block; picks the screen text and buttons */
export type GuardCause = 'NETWORK' | 'PERMISSION' | 'APPROXIMATE' | 'LOCATION_OFF' | 'ERROR' | 'UNSUPPORTED' | 'NONE';

export interface GuardResult {
  state: GuardState;
  cause: GuardCause;
  /** Why, for logs only (never shown to the user) */
  reason: string;
  /** The OS permission prompt can still be shown (otherwise only Settings helps) */
  canAskPermission: boolean;
  /** Last native status (null before the first check or when it failed) */
  status: WifiStatus | null;
}

/**
 * - `block`: shows the gate screen over the app and refuses guarded HTTP requests while the network isn't safe.
 * - `monitor`: only reports the state (hook, callbacks); never blocks. Useful for a soft launch or a custom UI.
 */
export type GuardMode = 'block' | 'monitor';

export interface OpenWifiGuardConfig {
  /** Turn the guard off entirely (state is always SAFE). Default true. */
  enabled?: boolean;
  /** Default 'block'. */
  mode?: GuardMode;
  /** Block Enhanced Open (OWE: no password, but encrypted). Default true. */
  blockOwe?: boolean;
  /** Block WEP (password, but broken encryption). Default true. */
  blockWep?: boolean;
  /** Block Wi-Fi behind a captive portal (hotel / café sign-in page; Android only). Default true. */
  blockCaptivePortal?: boolean;
  /**
   * On Wi-Fi whose security can't be read (permission refused, location off, error), block with a screen that
   * explains how to fix it. If false, such Wi-Fi is allowed (and the permission prompt is never shown by the guard).
   * Default true: otherwise refusing the permission would bypass the guard.
   */
  failClosed?: boolean;
  /** Block Wi-Fi on OS versions without a security-type API (iOS 13–14). Default false. */
  blockUnsupportedOs?: boolean;
  /** A check taking longer than this counts as "can't verify" on Wi-Fi. Default 3000 ms. */
  checkTimeoutMs?: number;
  /** Network change events are coalesced for this long before re-checking. Default 1000 ms. */
  debounceMs?: number;
  /** Log state changes to the console (never network names or location). Default false. */
  debug?: boolean;
}

export type ResolvedConfig = Required<OpenWifiGuardConfig>;
