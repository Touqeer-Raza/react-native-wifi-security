package com.openwifiguard

import android.net.wifi.WifiInfo
import android.os.Build
import androidx.annotation.RequiresApi

/**
 * Wi-Fi security categories reported to JS. The JS side decides which ones block the app.
 */
object WifiSecurity {
    const val OPEN = "OPEN"
    const val OWE = "OWE"
    const val WEP = "WEP"
    const val PERSONAL = "PERSONAL"
    const val ENTERPRISE = "ENTERPRISE"
    const val UNKNOWN = "UNKNOWN"

    /** Maps `WifiInfo.getCurrentSecurityType()` (Android 12+). */
    @RequiresApi(Build.VERSION_CODES.S)
    fun fromSecurityType(type: Int): String = when (type) {
        WifiInfo.SECURITY_TYPE_OPEN -> OPEN
        WifiInfo.SECURITY_TYPE_OWE -> OWE
        WifiInfo.SECURITY_TYPE_WEP -> WEP
        WifiInfo.SECURITY_TYPE_PSK,
        WifiInfo.SECURITY_TYPE_SAE,
        WifiInfo.SECURITY_TYPE_WAPI_PSK,
        WifiInfo.SECURITY_TYPE_DPP -> PERSONAL
        WifiInfo.SECURITY_TYPE_EAP,
        WifiInfo.SECURITY_TYPE_EAP_WPA3_ENTERPRISE,
        WifiInfo.SECURITY_TYPE_EAP_WPA3_ENTERPRISE_192_BIT,
        WifiInfo.SECURITY_TYPE_WAPI_CERT,
        WifiInfo.SECURITY_TYPE_OSEN,
        WifiInfo.SECURITY_TYPE_PASSPOINT_R1_R2,
        WifiInfo.SECURITY_TYPE_PASSPOINT_R3 -> ENTERPRISE
        else -> UNKNOWN
    }

    /**
     * Maps a `ScanResult.capabilities` string, e.g. `[WPA2-PSK-CCMP][RSN-PSK-CCMP][ESS][WPS]` (fallback before
     * Android 12). An access point with no key management tokens is open. `OWE_TRANSITION` alone marks the open half
     * of an Enhanced Open transition pair, so it counts as open.
     */
    fun fromCapabilities(capabilities: String?): String {
        if (capabilities.isNullOrBlank()) return UNKNOWN
        val tokens = capabilities.split('[', ']').map { it.trim().uppercase() }.filter { it.isNotEmpty() }
        if (tokens.isEmpty()) return UNKNOWN
        fun any(predicate: (String) -> Boolean) = tokens.any(predicate)
        return when {
            any { it.contains("EAP") || it.contains("802.1X") || it.contains("SUITE_B") || it.contains("WAPI-CERT") } ->
                ENTERPRISE
            any { it.contains("PSK") || it.contains("SAE") || it.contains("DPP") } -> PERSONAL
            any { it == "WEP" || it.startsWith("WEP") } -> WEP
            any { it.contains("OWE") && !it.startsWith("OWE_TRANSITION") } -> OWE
            else -> OPEN
        }
    }
}
