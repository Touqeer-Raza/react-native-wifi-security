package com.openwifiguard

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.LocationManager
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.wifi.WifiInfo
import android.net.wifi.WifiManager
import android.os.Build
import android.provider.Settings
import android.util.Log
import androidx.annotation.RequiresApi
import androidx.core.content.ContextCompat
import androidx.core.location.LocationManagerCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.modules.core.PermissionAwareActivity
import com.facebook.react.modules.core.PermissionListener

private const val TAG = "OpenWifiGuard"
private const val EVENT_CHANGED = "OpenWifiGuardChanged"
/** BSSID returned when the app isn't allowed to see it */
private const val HIDDEN_BSSID = "02:00:00:00:00:00"
private const val PREFS = "open_wifi_guard"
/** Result of our last location prompt ("denied" | "never_ask_again"); absent = never asked */
private const val PREF_PROMPT = "location_prompt"
private const val PROMPT_DENIED = "denied"
private const val PROMPT_NEVER_ASK_AGAIN = "never_ask_again"
private const val PERMISSION_REQUEST_CODE = 0x0FA1

/**
 * Open Wi-Fi Guard native module (Android).
 *
 * Reports the connection type and the security of the connected Wi-Fi network. The JS side decides what blocks the
 * app. SSID / BSSID never leave this module.
 *
 * - Android 12+: `WifiInfo.getCurrentSecurityType()`.
 * - Older versions (or when the above is UNKNOWN): the connected BSSID matched against cached scan results; needs
 *   ACCESS_FINE_LOCATION and location services on (OS rule). No scan is started.
 */
class OpenWifiGuardModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "OpenWifiGuard"

    private val connectivity: ConnectivityManager
        get() = reactContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    @Suppress("DEPRECATION")
    private val wifiManager: WifiManager
        get() = reactContext.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager

    private val prefs
        get() = reactContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /** Latest Wi-Fi info from the callback (Android 12+, requested with location info when permitted). */
    @Volatile private var lastWifiInfo: WifiInfo? = null
    private var listenerCount = 0
    private var defaultCallback: ConnectivityManager.NetworkCallback? = null
    private var wifiCallback: ConnectivityManager.NetworkCallback? = null

    // region Permission

    private fun hasPermission(permission: String) =
        ContextCompat.checkSelfPermission(reactContext, permission) == PackageManager.PERMISSION_GRANTED

    /**
     * GRANTED (precise) | APPROXIMATE | NOT_ASKED | DENIED (can ask again) | BLOCKED (Settings only).
     * Android can't tell "never asked" from "denied", so the result of our own prompt is remembered.
     */
    private fun locationPermission(): String {
        if (hasPermission(Manifest.permission.ACCESS_FINE_LOCATION)) return "GRANTED"
        if (hasPermission(Manifest.permission.ACCESS_COARSE_LOCATION)) return "APPROXIMATE"
        return when (prefs.getString(PREF_PROMPT, null)) {
            null -> "NOT_ASKED"
            PROMPT_NEVER_ASK_AGAIN -> "BLOCKED"
            else -> "DENIED"
        }
    }

    private fun locationServicesOn(): Boolean = try {
        val manager = reactContext.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        LocationManagerCompat.isLocationEnabled(manager)
    } catch (_: Exception) {
        false
    }

    /** Shows the OS prompt ("While using the app"; precise or approximate on Android 12+). */
    @ReactMethod
    fun requestLocationPermission(promise: Promise) {
        if (hasPermission(Manifest.permission.ACCESS_FINE_LOCATION)) {
            prefs.edit().remove(PREF_PROMPT).apply()
            promise.resolve("GRANTED")
            return
        }
        val activity = reactContext.currentActivity
        if (activity !is PermissionAwareActivity) {
            promise.resolve(locationPermission())
            return
        }
        val listener = PermissionListener { requestCode, _, _ ->
            if (requestCode != PERMISSION_REQUEST_CODE) return@PermissionListener false
            if (hasPermission(Manifest.permission.ACCESS_FINE_LOCATION)) {
                prefs.edit().remove(PREF_PROMPT).apply()
            } else {
                val canAskAgain = (activity as Activity)
                    .shouldShowRequestPermissionRationale(Manifest.permission.ACCESS_FINE_LOCATION)
                prefs.edit().putString(PREF_PROMPT, if (canAskAgain) PROMPT_DENIED else PROMPT_NEVER_ASK_AGAIN).apply()
            }
            promise.resolve(locationPermission())
            true
        }
        try {
            activity.requestPermissions(
                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION),
                PERMISSION_REQUEST_CODE,
                listener,
            )
        } catch (e: Exception) {
            Log.w(TAG, "permission request failed: ${e.javaClass.simpleName}")
            promise.resolve(locationPermission())
        }
    }

    // endregion

    // region Status

    private fun transportOf(caps: NetworkCapabilities?): String = when {
        caps == null -> "NONE"
        caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN) -> "VPN"
        caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "WIFI"
        caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "CELLULAR"
        caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ETHERNET"
        else -> "OTHER"
    }

    private fun activeTransport(): String =
        transportOf(connectivity.activeNetwork?.let { connectivity.getNetworkCapabilities(it) })

    /** The connected Wi-Fi network (even when a VPN or mobile data is the default route). */
    @Suppress("DEPRECATION")
    private fun wifiNetwork(): Pair<Network, NetworkCapabilities>? =
        connectivity.allNetworks.firstNotNullOfOrNull { network ->
            connectivity.getNetworkCapabilities(network)
                ?.takeIf {
                    it.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) &&
                        !it.hasTransport(NetworkCapabilities.TRANSPORT_VPN)
                }
                ?.let { network to it }
        }

    private fun securityFromTransportInfo(caps: NetworkCapabilities): String {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return WifiSecurity.UNKNOWN
        val info = (caps.transportInfo as? WifiInfo) ?: lastWifiInfo ?: return WifiSecurity.UNKNOWN
        return WifiSecurity.fromSecurityType(info.currentSecurityType)
    }

    @Suppress("DEPRECATION")
    private fun securityFromScanResults(): String {
        if (!hasPermission(Manifest.permission.ACCESS_FINE_LOCATION) || !locationServicesOn()) return WifiSecurity.UNKNOWN
        return try {
            val bssid = wifiManager.connectionInfo?.bssid
            if (bssid.isNullOrBlank() || bssid == HIDDEN_BSSID) return WifiSecurity.UNKNOWN
            val match = wifiManager.scanResults.firstOrNull { it.BSSID.equals(bssid, ignoreCase = true) }
            WifiSecurity.fromCapabilities(match?.capabilities)
        } catch (_: SecurityException) {
            WifiSecurity.UNKNOWN
        }
    }

    @ReactMethod
    fun getStatus(promise: Promise) {
        try {
            val wifi = wifiNetwork()
            val result = Arguments.createMap()
            result.putString("transport", activeTransport())
            result.putBoolean("wifiConnected", wifi != null)
            result.putBoolean("supported", true)

            var source = "NONE"
            var security: String? = null
            var captive: Boolean? = null
            if (wifi != null) {
                val caps = wifi.second
                captive = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_CAPTIVE_PORTAL)
                security = securityFromTransportInfo(caps)
                if (security != WifiSecurity.UNKNOWN) {
                    source = "SECURITY_TYPE"
                } else {
                    security = securityFromScanResults()
                    if (security != WifiSecurity.UNKNOWN) source = "SCAN_RESULTS"
                }
            }
            val permission = locationPermission()
            val locationOn = locationServicesOn()
            if (security != null) result.putString("wifiSecurity", security) else result.putNull("wifiSecurity")
            if (captive != null) result.putBoolean("captivePortal", captive) else result.putNull("captivePortal")
            result.putString("locationPermission", permission)
            result.putBoolean("locationServicesOn", locationOn)
            // Location only helps when the security type couldn't be read without it
            result.putBoolean(
                "needsLocation",
                security == WifiSecurity.UNKNOWN && (permission != "GRANTED" || !locationOn),
            )
            result.putString("source", source)
            promise.resolve(result)
        } catch (e: Exception) {
            Log.w(TAG, "getStatus failed: ${e.javaClass.simpleName}")
            promise.reject("OPEN_WIFI_GUARD_STATUS", e.message, e)
        }
    }

    /** Connection type only (no Wi-Fi details); used when the full status fails. */
    @ReactMethod
    fun getTransport(promise: Promise) {
        try {
            promise.resolve(if (wifiNetwork() != null) "WIFI" else activeTransport())
        } catch (e: Exception) {
            promise.reject("OPEN_WIFI_GUARD_TRANSPORT", e.message, e)
        }
    }

    // endregion

    // region Settings

    private fun startSettings(action: String, promise: Promise) {
        try {
            val intent = Intent(action).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            (reactContext.currentActivity ?: reactContext).startActivity(intent)
            promise.resolve(true)
        } catch (_: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun openWifiSettings(promise: Promise) =
        startSettings(
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) Settings.Panel.ACTION_WIFI else Settings.ACTION_WIFI_SETTINGS,
            promise,
        )

    @ReactMethod
    fun openLocationSettings(promise: Promise) = startSettings(Settings.ACTION_LOCATION_SOURCE_SETTINGS, promise)

    // endregion

    // region Events

    private fun emitChanged() {
        if (!reactContext.hasActiveReactInstance()) return
        try {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(EVENT_CHANGED, null)
        } catch (_: Exception) {
        }
    }

    private fun newCallback(trackWifiInfo: Boolean): ConnectivityManager.NetworkCallback =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) callbackS(trackWifiInfo) else legacyCallback()

    /** Android 12+: keeps the Wi-Fi info (with location details only when the app holds the permission). */
    @RequiresApi(Build.VERSION_CODES.S)
    private fun callbackS(trackWifiInfo: Boolean) = object : ConnectivityManager.NetworkCallback(
        if (trackWifiInfo) FLAG_INCLUDE_LOCATION_INFO else 0,
    ) {
        override fun onAvailable(network: Network) = emitChanged()
        override fun onLost(network: Network) {
            if (trackWifiInfo) lastWifiInfo = null
            emitChanged()
        }
        override fun onCapabilitiesChanged(network: Network, caps: NetworkCapabilities) {
            if (trackWifiInfo) lastWifiInfo = caps.transportInfo as? WifiInfo
            emitChanged()
        }
    }

    /** Before Android 12 the constructor with flags doesn't exist. */
    private fun legacyCallback() = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) = emitChanged()
        override fun onLost(network: Network) = emitChanged()
        override fun onCapabilitiesChanged(network: Network, caps: NetworkCapabilities) = emitChanged()
    }

    private fun startObserving() {
        if (defaultCallback != null) return
        try {
            defaultCallback = newCallback(trackWifiInfo = false).also { connectivity.registerDefaultNetworkCallback(it) }
            val request = NetworkRequest.Builder().addTransportType(NetworkCapabilities.TRANSPORT_WIFI).build()
            wifiCallback = newCallback(trackWifiInfo = true).also { connectivity.registerNetworkCallback(request, it) }
        } catch (e: Exception) {
            Log.w(TAG, "network callbacks unavailable: ${e.javaClass.simpleName}")
        }
    }

    private fun stopObserving() {
        listOfNotNull(defaultCallback, wifiCallback).forEach {
            try {
                connectivity.unregisterNetworkCallback(it)
            } catch (_: Exception) {
            }
        }
        defaultCallback = null
        wifiCallback = null
        lastWifiInfo = null
    }

    /** Required by NativeEventEmitter */
    @ReactMethod
    fun addListener(eventName: String) {
        listenerCount += 1
        if (listenerCount == 1) startObserving()
    }

    /** Required by NativeEventEmitter */
    @ReactMethod
    fun removeListeners(count: Double) {
        listenerCount = (listenerCount - count.toInt()).coerceAtLeast(0)
        if (listenerCount == 0) stopObserving()
    }

    override fun invalidate() {
        stopObserving()
        super.invalidate()
    }

    // endregion
}
