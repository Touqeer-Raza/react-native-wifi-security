# Changelog

All notable changes to this project are documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-09-28

First public release.

- Native Wi-Fi security detection: Android (`getCurrentSecurityType`, scan-result fallback, captive portal) and iOS 15+ (`NEHotspotNetwork`).
- `<OpenWifiGuard>` root component: cold-start hold, session-preserving overlay, built-in gate screen (light/dark, fully translatable text), Android back button and keyboard handling.
- Location permission flow that is only shown on Wi-Fi and only when needed; Android "don't ask again" tracking done natively.
- Request guards that work with any HTTP client: `guardFetch()` for global `fetch`, `assertNetworkSafe()` for any other client, and an optional `guardAxios()` helper (no axios dependency). Refused requests fail with an `UNSAFE_NETWORK` error and no HTTP response.
- `block` / `monitor` modes, runtime `enabled` switch, `useOpenWifiGuard()` hook and imperative API.
