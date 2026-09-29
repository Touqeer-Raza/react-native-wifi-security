package com.openwifiguard

import org.junit.Assert.assertEquals
import org.junit.Test

class WifiSecurityTest {
    private fun assertCaps(expected: String, capabilities: String?) =
        assertEquals(capabilities, expected, WifiSecurity.fromCapabilities(capabilities))

    @Test
    fun openNetworks() {
        assertCaps(WifiSecurity.OPEN, "[ESS]")
        assertCaps(WifiSecurity.OPEN, "[ESS][WPS]")
        assertCaps(WifiSecurity.OPEN, "[OWE_TRANSITION][ESS]")
    }

    @Test
    fun personalNetworks() {
        assertCaps(WifiSecurity.PERSONAL, "[WPA2-PSK-CCMP][RSN-PSK-CCMP][ESS][WPS]")
        assertCaps(WifiSecurity.PERSONAL, "[RSN-SAE-CCMP][ESS]")
        assertCaps(WifiSecurity.PERSONAL, "[RSN-PSK+SAE-CCMP][ESS]")
        assertCaps(WifiSecurity.PERSONAL, "[WPA-PSK-TKIP][ESS]")
    }

    @Test
    fun enterpriseNetworks() {
        assertCaps(WifiSecurity.ENTERPRISE, "[WPA2-EAP-CCMP][RSN-EAP-CCMP][ESS]")
        assertCaps(WifiSecurity.ENTERPRISE, "[RSN-EAP/SHA256-CCMP][ESS]")
        assertCaps(WifiSecurity.ENTERPRISE, "[RSN-SUITE_B_192-GCMP-256][ESS]")
    }

    @Test
    fun weakOrEnhancedOpenNetworks() {
        assertCaps(WifiSecurity.WEP, "[WEP][ESS]")
        assertCaps(WifiSecurity.OWE, "[RSN-OWE-CCMP][ESS]")
    }

    @Test
    fun unreadableCapabilities() {
        assertCaps(WifiSecurity.UNKNOWN, null)
        assertCaps(WifiSecurity.UNKNOWN, "")
        assertCaps(WifiSecurity.UNKNOWN, "[][]")
    }
}
