# react-native-wifi-security

[![npm version](https://img.shields.io/npm/v/react-native-wifi-security.svg)](https://www.npmjs.com/package/react-native-wifi-security)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![platforms](https://img.shields.io/badge/platforms-android%20%7C%20ios-lightgrey.svg)

Stops a React Native app from being used on **unsafe Wi-Fi**: public networks that need no password (cafés, airports, hotels), WEP, Enhanced Open (OWE) and captive-portal networks. While the phone is on such a network, a full-screen gate covers the app and (optionally) every HTTP request is refused before it is sent. When the user switches to mobile data or a password-protected Wi-Fi, the gate disappears and the app continues on the same screen.

Add this at the app root.

```tsx
import OpenWifiGuard from 'react-native-wifi-security';

export default function App() {
  return (
    <OpenWifiGuard guardFetch>
      {/* the rest of your app */}
    </OpenWifiGuard>
  );
}
```

---

## Contents

1. [What it does](#1-what-it-does)
2. [How it works](#2-how-it-works)
3. [Requirements and platform support](#3-requirements-and-platform-support)
4. [Installation](#4-installation)
5. [Platform setup](#5-platform-setup)
6. [Integration, step by step](#6-integration-step-by-step)
7. [Configuration reference](#7-configuration-reference)
8. [API reference](#8-api-reference)
9. [States and what the user sees](#9-states-and-what-the-user-sees)
10. [Customising the gate screen](#10-customising-the-gate-screen)
11. [Recipes](#11-recipes)
12. [Testing your integration](#12-testing-your-integration)
13. [Privacy and app store notes](#13-privacy-and-app-store-notes)
14. [Troubleshooting](#14-troubleshooting)
15. [Limitations](#15-limitations)

---

## 1. What it does

| Connection | Default decision |
|---|---|
| Mobile data, Ethernet, USB tethering, no connection | ✅ Allowed |
| Wi-Fi with WPA / WPA2 / WPA3 Personal (PSK, SAE), WAPI-PSK | ✅ Allowed |
| Wi-Fi with 802.1X / Enterprise, Passpoint (Hotspot 2.0), WAPI-CERT | ✅ Allowed |
| **Open Wi-Fi (no password)** | ⛔ Blocked |
| **WEP** (password, but broken encryption) | ⛔ Blocked (`blockWep`) |
| **Enhanced Open / OWE** (no password, encrypted) | ⛔ Blocked (`blockOwe`) |
| **Captive portal** (sign-in page, Android only) | ⛔ Blocked (`blockCaptivePortal`) |
| Wi-Fi whose security can't be read (permission refused, location off, error) | ⛔ Blocked, with a screen that says how to fix it (`failClosed`) |

**Rule:** the app is blocked whenever an unsafe Wi-Fi is *connected*, even if a VPN is on or the OS sends traffic over mobile data. The message stays simple: "Turn off Wi-Fi or join a secured one."

What you get:

- **Native detection** on Android and iOS: security type, captive portal, connection type, and change events. No SSID, BSSID or location ever leaves the native module.
- **A built-in full-screen gate** in light and dark mode, with text you can reword or translate, accessibility support (screen readers only see the gate), and the Android back button disabled while blocked.
- **Cold-start protection:** the app isn't mounted until the first check says the network is safe, so no screen, query or request starts on an unsafe Wi-Fi.
- **Session-preserving overlay:** if the network turns unsafe while the app is open, the gate is drawn *over* the app. Navigation state, in-memory tokens and forms are kept.
- **Request guard that works with any HTTP client**: a global `fetch` wrapper, `assertNetworkSafe()` for any other client or your own request wrapper, and an optional axios helper. Requests are refused *before* they are sent, without an HTTP response, so 401/sign-out handling doesn't run.
- **Location permission flow:** the permission is only asked for when the phone is on Wi-Fi *and* the OS requires it to read the security type. Users on mobile data never see it.
- **Runtime switches:** `enabled` and `mode: 'monitor'` let you turn it off or run it silently (for example from remote config) without a new build.

---

## 2. How it works

```
┌──────────────────────────── your app ─────────────────────────────┐
│ <OpenWifiGuard>                                                   │
│   ├─ holds the app until the first check          (cold start)    │
│   ├─ <View>{children}</View>   stays mounted once started         │
│   └─ <GateScreen/>             drawn on top while blocked         │
│                                                                   │
│ guard engine (singleton, no React)                                │
│   check() ─► native getStatus() ─► classify() ─► state            │
│   triggers: start · network/permission change (debounced 1 s)     │
│             · app returns to foreground · "Try again"             │
│                                                                   │
│ request guard: fetch wrapper · assertNetworkSafe() · axios helper │
│   waits for first check ─► state SAFE ? send : reject             │
└───────────────────────────────┬───────────────────────────────────┘
                                │ NativeModules.OpenWifiGuard
          ┌─────────────────────┴───────────────────────┐
     Android (Kotlin)                               iOS (Obj-C)
```

### How the OS tells whether Wi-Fi is secured

| Platform | API used | Permission needed |
|---|---|---|
| **Android 12+** (API 31+) | `WifiInfo.getCurrentSecurityType()` from the Wi-Fi network's `NetworkCapabilities` | Usually none. If the device reports `UNKNOWN`, falls back to the method below |
| **Android 7–11** (API 24–30) | Connected BSSID matched against cached `WifiManager.getScanResults()`; the `capabilities` string (`[ESS]` = open, `[WPA2-PSK-CCMP]`, `[RSN-SAE]`, `[WEP]`, `[RSN-OWE]`, `EAP`…) gives the security. No new scan is started. | `ACCESS_FINE_LOCATION` **and** location services on (OS rule for reading the BSSID) |
| **Android captive portal** | `NetworkCapabilities.NET_CAPABILITY_CAPTIVE_PORTAL` | None |
| **iOS 15+** | `NEHotspotNetwork.fetchCurrent` → `securityType` (`open`, `WEP`, `personal`, `enterprise`) | *Access Wi-Fi Information* entitlement **and** location "While Using" (precise) |
| **iOS 13–14** | No security-type API. Reported as `supported: false`; allowed unless `blockUnsupportedOs` | — |

Connection type and change events come from `ConnectivityManager` network callbacks (Android) and `nw_path_monitor` (iOS). Neither needs a permission.

---

## 3. Requirements and platform support

| | Minimum |
|---|---|
| React Native | 0.71+ (tested with 0.77.2, old and new architecture; the new architecture runs it through the interop layer) |
| React | 18+ |
| Android | minSdk 24 (Android 7). Full detection without location on Android 12+ |
| iOS | 13.4 to build, **15+ for detection** |
| Expo | Bare / prebuild projects only (it's a native module; no config plugin yet, see §5) |

Peer dependencies: `react` and `react-native` only. There are no other runtime dependencies: no HTTP client, NetInfo, AsyncStorage or SVG library is required.

---

## 4. Installation

```sh
npm install react-native-wifi-security
# or
yarn add react-native-wifi-security
```

Then install the native parts:

```sh
cd ios && pod install && cd ..
```

Android needs nothing: React Native autolinking registers `OpenWifiGuardPackage`, and the permissions below are merged into your manifest automatically.

**Rebuild the app** (`yarn android` / `yarn ios`, or a new Xcode/Gradle build). A Metro reload isn't enough, because this is a native module. Until the app is rebuilt, the module isn't linked, and the guard silently stays off (state always `SAFE`).

---

## 5. Platform setup

### iOS (required)

1. **Location purpose string**: add it to `Info.plist` (and to every other Info plist you ship, such as `Info-Release.plist`):

   ```xml
   <key>NSLocationWhenInUseUsageDescription</key>
   <string>Your location is used only to check that your Wi-Fi network is secure. It is not stored or shared.</string>
   ```

   Without it, iOS silently ignores the permission request. The guard logs a warning and the user stays on "Wi-Fi can't be verified".

2. **Access Wi-Fi Information entitlement**: in Xcode, open *Target → Signing & Capabilities → + Capability → Access WiFi Information*. Or add it to your `.entitlements` file:

   ```xml
   <key>com.apple.developer.networking.wifi-info</key>
   <true/>
   ```

   Then enable **Access Wi-Fi Information** on the App ID at developer.apple.com (*Identifiers → your app → Capabilities*), and **regenerate the provisioning profiles** (development, ad hoc, App Store) for every bundle ID or flavor you ship.

   Without the entitlement, `NEHotspotNetwork.fetchCurrent` returns nothing. Every Wi-Fi then shows up as "can't be verified" and is blocked.

3. `cd ios && pod install`, then rebuild.

### Android (automatic)

The package's manifest adds these to your app:

```xml
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

Location is only *requested* when the security can't be read without it (mainly Android 7–11). No background location is ever requested.

If your `minSdk` is 31 or higher, you may drop the location permissions. Then set `failClosed` to your policy for the rare device that doesn't report the security type:

```xml
<!-- android/app/src/main/AndroidManifest.xml, <manifest xmlns:tools="http://schemas.android.com/tools"> -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" tools:node="remove" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" tools:node="remove" />
```

Your app's `MainActivity` must extend `ReactActivity` (the default); it is used for the permission prompt.

### Expo

Use a development build / `expo prebuild`, then apply the iOS steps above to the generated `ios/` project (or with your own config plugin). Expo Go can't load custom native modules.

---

## 6. Integration, step by step

### Step 1: Wrap the root

Put `<OpenWifiGuard>` as high as possible: above your navigation and data providers, and below error boundaries and anything that must stay visible when the network is unsafe (for example a root/jailbreak screen).

```tsx
// App.tsx
import OpenWifiGuard from 'react-native-wifi-security';

export default function App() {
  return (
    <OpenWifiGuard>
      {/* your providers, navigation and screens */}
    </OpenWifiGuard>
  );
}
```

That's a working integration: detection, the gate, the permission flow and re-checks on network change and foreground are all on.

### Step 2: Guard your network requests (recommended)

The gate stops the user; the request guard stops *code* (background refetches, timers, token refresh) from sending anything while the network is unsafe. Use whichever of the options below matches how your app talks to the network. They can be combined.

Every refused request rejects with `error.code === 'UNSAFE_NETWORK'` (check it with `isUnsafeNetworkError(error)`). It has **no HTTP response**, so your 401/403/sign-out handling doesn't run and the session survives.

**`fetch`**, and libraries built on it:

```tsx
<OpenWifiGuard guardFetch>
```

This wraps `globalThis.fetch` on the first render, before your screens' effects run. Code that uses `XMLHttpRequest` directly isn't covered by this wrapper.

**Any other client, or your own request wrapper**: call `assertNetworkSafe()` before the request goes out. It waits for the first check and throws the `UNSAFE_NETWORK` error if the network isn't safe.

```ts
import { assertNetworkSafe } from 'react-native-wifi-security';

export async function request(url: string, init?: RequestInit) {
  await assertNetworkSafe(undefined, url); // the url only shows up in debug logs
  return fetch(url, init);
}
```

The same call fits in any client's "before request" hook, middleware, link or interceptor.

**axios** (optional; the package doesn't depend on axios):

```tsx
import axios from 'axios';

const client = axios.create({ baseURL: 'https://api.example.com' });

<OpenWifiGuard axiosInstances={[client, axios]}>
```

- List **every** instance you send requests through, including the default `axios` export if you call it directly.
- The guard is installed on the first render. Axios runs the most recently added request interceptor first, so if your own interceptors (auth headers, request signing) are added at import time, the guard runs before them and a refused request is never signed.
- Outside React, for example in a plain module: `guardAxios(client, axios)`. It returns a function that removes the guard.

### Step 3: Pause background work while blocked

`onBlockedChange` fires when the gate appears and disappears. Use it to stop polling, close sockets or tell your data layer it's offline, so work pauses instead of failing and resumes when the network is safe again.

```tsx
<OpenWifiGuard
  onBlockedChange={(blocked) => {
    if (blocked) stopBackgroundSync();
    else startBackgroundSync();
  }}
>
```

### Step 4: Splash screen

On cold start the app isn't mounted until the first check finishes (usually a few milliseconds, at most `checkTimeoutMs`). If the network is unsafe, the gate is shown *instead of* the app, so the code that normally hides your splash screen never runs. Hide it when the gate appears, with whichever splash screen library you use:

```tsx
<OpenWifiGuard onBlockedChange={(blocked) => blocked && hideSplashScreen()}>
```

To show something of your own during the first check instead of keeping the native splash, pass `renderWhileChecking={() => <MySplash />}`.

### Step 5: Text, translations and branding

The built-in gate uses English text by default (exported as `englishMessages`). Pass `messages` to reword or translate any of it; keys you leave out keep the default text.

```tsx
<OpenWifiGuard
  messages={{
    unsafeTitle: t('wifiGuard.unsafeTitle'),
    unsafeMessage: t('wifiGuard.unsafeMessage'),
    tryAgain: t('common.tryAgain'),
  }}
  theme={{ primary: '#0A84FF', accent: '#FF9500', fontFamily: 'Inter-Regular', fontFamilyBold: 'Inter-Bold' }}
  darkTheme={{ background: '#000000', primary: '#0A84FF' }}
>
```

See [§10](#10-customising-the-gate-screen) for every message key and for a fully custom screen.

### Step 6: Build-time and runtime switches

```tsx
<OpenWifiGuard
  enabled={wifiGuardEnabled}   // build-time flag, e.g. from your .env
  mode={wifiGuardMode}         // 'block' | 'monitor', e.g. from remote config
  debug={__DEV__}
>
```

Changing a prop re-evaluates the current network immediately; no restart is needed.

### Complete example

```tsx
import OpenWifiGuard from 'react-native-wifi-security';

import { AppContent } from './AppContent';
import { hideSplashScreen } from './splash';

export default function App() {
  return (
    <OpenWifiGuard
      guardFetch
      theme={{ primary: '#0A84FF' }}
      onBlockedChange={(blocked) => {
        if (blocked) hideSplashScreen();
      }}
      debug={__DEV__}
    >
      <AppContent />
    </OpenWifiGuard>
  );
}
```

---

## 7. Configuration reference

All are props of `<OpenWifiGuard>`, or options of `OpenWifiGuard.configure()` when used without the component.

| Option | Type | Default | Description |
|---|---|---|---|
| `enabled` | `boolean` | `true` | `false` turns everything off: state is always `SAFE`, nothing is blocked. |
| `mode` | `'block' \| 'monitor'` | `'block'` | `monitor` only reports state (hook, callbacks) and never shows the gate or refuses requests. |
| `blockOwe` | `boolean` | `true` | Block Enhanced Open (OWE): no password, but encrypted. |
| `blockWep` | `boolean` | `true` | Block WEP. |
| `blockCaptivePortal` | `boolean` | `true` | Block Wi-Fi behind a captive portal (Android only). |
| `failClosed` | `boolean` | `true` | Block Wi-Fi whose security can't be read, with a fix-it screen. If `false`, such Wi-Fi is allowed and the guard never asks for location. Turning it off means denying the permission bypasses the guard. |
| `blockUnsupportedOs` | `boolean` | `false` | Block Wi-Fi on iOS 13–14 (no security API there). |
| `checkTimeoutMs` | `number` | `3000` | A check slower than this counts as "can't verify" on Wi-Fi. |
| `debounceMs` | `number` | `1000` | Network change events are coalesced this long before re-checking. Read when monitoring starts. |
| `debug` | `boolean` | `false` | `console.log` state changes and refused requests (never network names or location). |

Component-only props:

| Prop | Type | Description |
|---|---|---|
| `guardFetch` | `boolean` | Guard global `fetch`. Default `false`. Read once, on mount. |
| `axiosInstances` | `AxiosLike[]` | Optional axios instances to guard (see Step 2). Read once, on mount. |
| `holdAppUntilChecked` | `boolean` | Default `true`. Don't mount the app until the first check says `SAFE`. |
| `renderWhileChecking` | `() => ReactNode` | Shown during the first check. Default: nothing (native splash stays). |
| `renderGate` | `(guard) => ReactNode` | Replaces the built-in gate screen. |
| `messages` | `Partial<OpenWifiGuardMessages>` | Text of the built-in gate. Missing keys fall back to `englishMessages`. |
| `theme` / `darkTheme` | `Partial<GateTheme>` | Colors and fonts of the built-in gate. `theme` also applies in dark mode unless `darkTheme` is given. |
| `icon` | `ReactNode` | Replaces the built-in Wi-Fi icon. |
| `onStateChange` | `(result) => void` | Every state change (also in `monitor` mode). Good for analytics. |
| `onBlockedChange` | `(blocked, result) => void` | The gate appeared or disappeared. |

---

## 8. API reference

### Default export: `OpenWifiGuard`

The component, with the imperative API attached as static members:

```ts
OpenWifiGuard.configure(options)          // set options at any time
OpenWifiGuard.check(): Promise<GuardResult>   // re-check now
OpenWifiGuard.getState(): GuardResult
OpenWifiGuard.subscribe(listener): () => void
OpenWifiGuard.start(): () => void         // watch the network without the component (ref-counted)
OpenWifiGuard.isGuardActive(): boolean    // enabled and native module linked
OpenWifiGuard.isBlocked(): boolean
OpenWifiGuard.isNetworkSafe(): boolean    // requests may be sent
OpenWifiGuard.waitForFirstCheck(): Promise<void>
OpenWifiGuard.requestLocationPermission(): Promise<LocationPermission | null>
OpenWifiGuard.openWifiSettings(): Promise<boolean>   // Android Wi-Fi panel; false on iOS
OpenWifiGuard.openLocationSettings(): Promise<void>  // iOS: app settings
OpenWifiGuard.openAppSettings(): Promise<void>
OpenWifiGuard.guardFetch(): () => void
OpenWifiGuard.guardAxios(...instances): () => void   // optional, for axios users
OpenWifiGuard.isUnsafeNetworkError(error): boolean
```

The same functions are also named exports (`import { check, guardFetch } from 'react-native-wifi-security'`). `getState` is exported under that name.

### `useOpenWifiGuard()`

Works inside or outside `<OpenWifiGuard>`. While any component uses it, the network is watched.

```ts
const guard = useOpenWifiGuard();
guard.state            // 'CHECKING' | 'SAFE' | 'UNSAFE' | 'NEEDS_PERMISSION' | 'LOCATION_OFF' | 'CANNOT_VERIFY'
guard.cause            // 'NETWORK' | 'PERMISSION' | 'APPROXIMATE' | 'LOCATION_OFF' | 'ERROR' | 'UNSUPPORTED' | 'NONE'
guard.blocked          // the gate is showing
guard.active           // enabled and native module linked
guard.canAskPermission // OS prompt can still be shown
guard.status           // raw WifiStatus (below) or null
guard.reason           // human-readable reason, for logs
guard.retry()
guard.askPermission()
guard.openWifiSettings // function on Android, null on iOS
guard.openLocationSettings()
guard.openAppSettings()
```

### `WifiStatus` (raw native result)

```ts
{
  transport: 'WIFI' | 'CELLULAR' | 'ETHERNET' | 'VPN' | 'NONE' | 'OTHER';
  wifiConnected: boolean;            // even if VPN / cellular carries the traffic
  wifiSecurity: 'OPEN' | 'OWE' | 'WEP' | 'PERSONAL' | 'ENTERPRISE' | 'UNKNOWN' | null;
  captivePortal: boolean | null;     // Android only
  locationPermission: 'GRANTED' | 'APPROXIMATE' | 'NOT_ASKED' | 'DENIED' | 'BLOCKED';
  locationServicesOn: boolean;
  needsLocation: boolean;            // location would let the security be read
  supported: boolean;                // false on iOS 13–14
  source: 'SECURITY_TYPE' | 'SCAN_RESULTS' | 'HOTSPOT' | 'NONE';
}
```

### Other exports

`GateScreen`, `getGateContent`, `UnsafeWifiIcon`, `lightGateTheme`, `darkGateTheme`, `englishMessages`, `classify` (the pure decision function), `DEFAULT_CONFIG`, `assertNetworkSafe()`, `UNSAFE_NETWORK_ERROR`, and all types.

---

## 9. States and what the user sees

```
          start / foreground / network change / Try again
                              │
                              ▼
                          CHECKING
      ┌──────────────┬────────┴────────┬─────────────────┐
      ▼              ▼                 ▼                 ▼
    SAFE          UNSAFE       NEEDS_PERMISSION   LOCATION_OFF / CANNOT_VERIFY
  app runs     gate: switch     gate: Continue →    gate: fix it (Settings,
               network          OS prompt           Turn on Location, Try again)
```

| State | Title (built-in) | Primary button | Secondary |
|---|---|---|---|
| `UNSAFE` | Unsafe Wi-Fi network | Android: **Wi-Fi settings**; iOS: **Try again** (+ "Settings → Wi-Fi" hint) | Try again (Android) |
| `NEEDS_PERMISSION` | Check your Wi-Fi | **Continue** → OS location prompt | Wi-Fi settings (Android) |
| `LOCATION_OFF` | Turn on Location | **Turn on Location** | Try again |
| `CANNOT_VERIFY` (permission denied) | Wi-Fi can't be verified | **Allow location** (if the OS can still ask) or **Open Settings** | Try again |
| `CANNOT_VERIFY` (approximate location) | Wi-Fi can't be verified | **Open Settings** (turn on Precise Location) | Try again |
| `CANNOT_VERIFY` (error / timeout / unsupported) | Wi-Fi can't be verified | **Try again** | Wi-Fi settings (Android) |

The gate re-checks by itself when the user comes back from Settings (app foreground) and whenever the network changes. "Try again" is just a manual shortcut.

---

## 10. Customising the gate screen

**Text and colors**: use `messages`, `theme`, `darkTheme` and `icon` (see Step 5).

- `OpenWifiGuardMessages` keys: `unsafeTitle`, `unsafeMessage`, `permissionTitle`, `permissionMessage`, `cannotVerifyTitle`, `cannotVerifyPermissionMessage`, `cannotVerifyApproximateMessage`, `cannotVerifyErrorMessage`, `unsupportedMessage`, `locationOffTitle`, `locationOffMessage`, `iosWifiHint`, `wifiSettings`, `tryAgain`, `continue`, `allowLocation`, `openSettings`, `turnOnLocation`. The default values are exported as `englishMessages`.
- `GateTheme` keys: `background`, `text`, `textSecondary`, `icon`, `accent`, `primary`, `onPrimary`, `link`, `fontFamily`, `fontFamilyBold`.

**Your own screen**: `renderGate` receives the same controller as `useOpenWifiGuard()`. The guard still positions it full-screen over the app, hides the app from screen readers, disables the Android back button and dismisses the keyboard.

```tsx
<OpenWifiGuard
  renderGate={(guard) => (
    <MyErrorScreen
      title={guard.state === 'UNSAFE' ? t('unsafeWifi.title') : t('checkWifi.title')}
      primaryLabel={t('common.tryAgain')}
      onPrimary={guard.state === 'NEEDS_PERMISSION' ? guard.askPermission : guard.retry}
      onSecondary={guard.openWifiSettings ?? undefined}
    />
  )}
>
```

To reuse the built-in decision of which title and buttons fit each state: `getGateContent(guard, messages)` returns `{ title, message, primary: { label, onPress }, secondary? }`.

---

## 11. Recipes

**Soft launch: monitor first, then block**

```tsx
<OpenWifiGuard
  mode={flags.blockUnsafeWifi ? 'block' : 'monitor'}
  onStateChange={(r) => analytics.logEvent('wifi_guard_state', { state: r.state, cause: r.cause })}
>
```

**Show your own banner instead of blocking**

```tsx
function WifiWarningBanner() {
  const { state } = useOpenWifiGuard();
  return state === 'UNSAFE' ? <Banner text="You're on public Wi-Fi" /> : null;
}
// with <OpenWifiGuard mode="monitor">, or no component at all
```

**Guard a single action only**

```ts
import { assertNetworkSafe, isUnsafeNetworkError } from 'react-native-wifi-security';

try {
  await assertNetworkSafe();   // throws UNSAFE_NETWORK when not safe (ignores mode 'monitor')
  await submitSensitiveForm();
} catch (e) {
  if (isUnsafeNetworkError(e)) showToast('Switch to a secure network');
}
```

Note: in `mode: 'monitor'`, `assertNetworkSafe` and the HTTP guards let everything through. To block one action in monitor mode, check `OpenWifiGuard.getState().state === 'SAFE'` yourself.

**Development builds and emulators**

The Android emulator's built-in `AndroidWifi` network is typically open, and the iOS Simulator has no Wi-Fi information, so the gate can appear while developing. Use `enabled={!__DEV__}`, a `.env` switch, or turn Wi-Fi off in the emulator.

**Keep a root/jailbreak (RASP) screen in front**

Render your RASP gate *outside* `<OpenWifiGuard>` and return early when it blocks, so it always takes priority:

```tsx
if (raspBlocked) return <SecurityGate />;
return <OpenWifiGuard>{app}</OpenWifiGuard>;
```

---

## 12. Testing your integration

**Test networks:** a travel router or a spare Android phone hotspot set to **Open**, **WPA2**, **WPA3** and (if possible) **WEP** / **OWE**; a hotel or café Wi-Fi, or a router with a splash page, for captive portals. iPhone hotspots are always WPA2, so use an Android phone or a router for Open.

| # | Scenario | Expected |
|---|---|---|
| 1 | Cold start on open Wi-Fi | Gate only; the app never mounts; no API request in logs |
| 2 | Cold start on WPA2 / WPA3 / enterprise | App works; no permission prompt on Android 12+ |
| 3 | Cold start on mobile data | App works; **no location prompt ever** |
| 4 | App open on WPA2 → join open Wi-Fi | Gate within about 1–2 s; requests refused; back button does nothing |
| 5 | From 4, turn Wi-Fi off or join WPA2 | Gate disappears; same screen; still signed in; data refetches |
| 6 | WEP / OWE | Blocked (defaults) |
| 7 | Captive-portal Wi-Fi (Android) | Blocked |
| 8 | VPN on over open Wi-Fi | Blocked |
| 9 | Permission: allow / deny / "don't ask again" / approximate only | Correct screen each time; Settings round-trip re-checks |
| 10 | Location services off (Android 7–11, iOS) | "Turn on Location" screen |
| 11 | Network changed while app in background | Correct state on return |
| 12 | Airplane mode | Your normal offline behaviour, not the gate |
| 13 | Rapid Wi-Fi ↔ cellular switching | No flicker loop; final state correct |
| 14 | TalkBack / VoiceOver on the gate | Only gate content is readable; buttons labelled |

Turn on `debug` to see every check in the Metro log:

```
[OpenWifiGuard] checked { transport: 'WIFI', wifiSecurity: 'OPEN', captivePortal: false, permission: 'GRANTED', ... state: 'UNSAFE' }
[OpenWifiGuard] state UNSAFE { reason: 'open Wi-Fi' }
[OpenWifiGuard] request refused { url: 'https://api.example.com/profile' }
```

**In your Jest tests**, the native module isn't linked, so the guard is inactive and always `SAFE`. Your existing tests keep working without mocks. To test blocked behaviour, set `NativeModules.OpenWifiGuard` to a mock with `getStatus`, `getTransport`, `requestLocationPermission`, `openWifiSettings`, `openLocationSettings`, `addListener` and `removeListeners` *before* importing the package.

---

## 13. Privacy and app store notes

- The native module reads only the security **type**. SSID, BSSID and location are never read into JS, stored, logged or sent.
- Location permission is foreground-only ("While using the app"). It is asked for only while on Wi-Fi, and only if the security can't be read without it.
- **Google Play**, *Data safety*: location is *accessed* but processed on device only, and not collected or shared. No background location, so no location declaration form is needed.
- **App Store**: explain the location use in the App Review notes (Wi-Fi security check, nothing stored). App Privacy details don't change if location isn't collected. Make sure the purpose string in `Info.plist` says what it's for.

---

## 14. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Nothing happens; state is always `SAFE`; `guard.active === false` | The native module isn't linked. Rebuild the app (not just Metro). iOS: run `pod install`. Check `NativeModules.OpenWifiGuard` isn't `undefined`. |
| iOS: every Wi-Fi shows "Wi-Fi can't be verified" | Missing *Access Wi-Fi Information* entitlement or provisioning profile, or location not granted or only approximate. Turn on `debug` and look at `source` (should be `HOTSPOT`) and `permission`. |
| iOS: tapping "Continue" does nothing | `NSLocationWhenInUseUsageDescription` is missing (a warning is logged). |
| Android 10/11: "Turn on Location" | The OS only reveals the connected access point with location services on. Expected. |
| Android emulator always blocked | The emulator's `AndroidWifi` is typically open. See the recipe in §11. |
| Requests fail with `UNSAFE_NETWORK` on mobile data | Another Wi-Fi is still *connected* (for example a hotel network without internet). Expected by the "connected unsafe Wi-Fi blocks" rule. |
| App flashes / remounts when the network changes | Make sure `<OpenWifiGuard>` itself isn't remounted (for example by a `key` or a conditional parent). |
| Splash screen never hides on unsafe Wi-Fi | Hide it in `onBlockedChange` (Step 4). |
| iOS build fails in the `fmt` pod ("call to consteval function … is not a constant expression") | Not caused by this package: React Native 0.77's `fmt` vs Xcode 26 clang. In the Podfile `post_install`, set `CLANG_CXX_LANGUAGE_STANDARD = 'c++17'` for the `fmt` target. |
| Gate hidden behind a native modal | React Native `Modal`s are separate windows; close them in `onBlockedChange` if needed. |

---

## 15. Limitations

- **Public but password-protected Wi-Fi** (a café that prints its WPA2 password on the menu) can't be told apart from a home network. The OS doesn't know either. TLS and certificate pinning remain the protection there.
- **Captive portals** are detected on Android only. iOS has no public API for it.
- **iOS** has no public deep link to Wi-Fi settings; the gate shows "Settings → Wi-Fi" text instead.
- **iOS 13–14**: no security-type API; allowed by default (`blockUnsupportedOs`).
- Only the app's own UI and the HTTP clients you guard are covered. Native SDKs with their own networking (Firebase, analytics, WebViews, download managers) are not blocked by the HTTP guard, although WebViews and downloads are covered visually by the gate.
- There's no server-side switch. Use `enabled` / `mode` with your own remote config if you need one.

---

## License

[MIT](LICENSE)
