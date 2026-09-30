import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { englishMessages } from './messages';
export const lightGateTheme = {
    background: '#F8F8F8',
    text: '#111111',
    textSecondary: '#4A4A4A',
    icon: '#1F5FAD',
    accent: '#D14B1F',
    primary: '#1F5FAD',
    onPrimary: '#FFFFFF',
    link: '#1F5FAD',
};
export const darkGateTheme = {
    background: '#141414',
    text: '#FFFFFF',
    textSecondary: '#B7BAC0',
    icon: '#B7BAC0',
    accent: '#FF7A45',
    primary: '#3D82D6',
    onPrimary: '#FFFFFF',
    link: '#FFFFFF',
};
export const getGateContent = (guard, m) => {
    const tryAgain = { label: m.tryAgain, onPress: guard.retry };
    const wifiSettings = guard.openWifiSettings
        ? { label: m.wifiSettings, onPress: guard.openWifiSettings }
        : undefined;
    const withIosHint = (message) => (guard.openWifiSettings ? message : `${message}\n\n${m.iosWifiHint}`);
    switch (guard.state) {
        case 'UNSAFE':
            return {
                title: m.unsafeTitle,
                message: withIosHint(m.unsafeMessage),
                primary: wifiSettings ?? tryAgain,
                secondary: wifiSettings ? tryAgain : undefined,
            };
        case 'NEEDS_PERMISSION':
            return {
                title: m.permissionTitle,
                message: m.permissionMessage,
                primary: { label: m.continue, onPress: guard.askPermission },
                secondary: wifiSettings,
            };
        case 'LOCATION_OFF':
            return {
                title: m.locationOffTitle,
                message: m.locationOffMessage,
                primary: { label: m.turnOnLocation, onPress: guard.openLocationSettings },
                secondary: tryAgain,
            };
        case 'CANNOT_VERIFY':
        default:
            if (guard.cause === 'PERMISSION' || guard.cause === 'APPROXIMATE') {
                return {
                    title: guard.cause === 'APPROXIMATE' ? m.preciseLocationTitle : m.locationDeniedTitle,
                    message: guard.cause === 'APPROXIMATE' ? m.cannotVerifyApproximateMessage : m.cannotVerifyPermissionMessage,
                    primary: guard.canAskPermission
                        ? { label: m.allowLocation, onPress: guard.askPermission }
                        : { label: m.openSettings, onPress: guard.openAppSettings },
                    secondary: tryAgain,
                };
            }
            return {
                title: m.cannotVerifyTitle,
                message: withIosHint(guard.cause === 'UNSUPPORTED' ? m.unsupportedMessage : m.cannotVerifyErrorMessage),
                primary: tryAgain,
                secondary: wifiSettings,
            };
    }
};
/** Wi-Fi symbol with a slash, drawn with plain Views (no SVG dependency). */
export const UnsafeWifiIcon = ({ color, accent, size = 96 }) => {
    const unit = size / 96;
    const stroke = 6 * unit;
    const centerX = 48 * unit;
    const centerY = 72 * unit;
    const arcs = [16, 32, 48].map((radius) => radius * unit);
    const slashLength = 96 * unit;
    return (_jsxs(View, { style: { width: size, height: size }, accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants", testID: "OpenWifiGuard.icon", children: [arcs.map((radius) => (_jsx(View, { style: {
                    position: 'absolute',
                    left: centerX - radius,
                    top: centerY - radius,
                    width: radius * 2,
                    height: radius * 2,
                    borderRadius: radius,
                    borderWidth: stroke,
                    borderColor: 'transparent',
                    borderTopColor: color,
                } }, radius))), _jsx(View, { style: {
                    position: 'absolute',
                    left: centerX - 5 * unit,
                    top: centerY - 5 * unit,
                    width: 10 * unit,
                    height: 10 * unit,
                    borderRadius: 5 * unit,
                    backgroundColor: color,
                } }), _jsx(View, { style: {
                    position: 'absolute',
                    left: (size - slashLength) / 2,
                    top: size / 2 - stroke / 2,
                    width: slashLength,
                    height: stroke,
                    borderRadius: stroke / 2,
                    backgroundColor: accent,
                    transform: [{ rotate: '45deg' }],
                } })] }));
};
/**
 * Built-in full-screen gate, styled like a "No internet" screen. Nothing underneath can be used while it shows.
 */
export const GateScreen = ({ guard, messages, theme, darkTheme, icon }) => {
    const dark = useColorScheme() === 'dark';
    const palette = dark
        ? { ...darkGateTheme, ...(darkTheme ?? theme) }
        : { ...lightGateTheme, ...theme };
    const m = useMemo(() => ({ ...englishMessages, ...messages }), [messages]);
    const content = getGateContent(guard, m);
    const [busy, setBusy] = useState(false);
    const run = (action) => async () => {
        if (busy)
            return;
        setBusy(true);
        try {
            await action.onPress();
        }
        finally {
            setBusy(false);
        }
    };
    const regular = palette.fontFamily ? { fontFamily: palette.fontFamily } : {};
    const bold = palette.fontFamilyBold ? { fontFamily: palette.fontFamilyBold } : { fontWeight: '700' };
    return (_jsxs(View, { style: [styles.container, { backgroundColor: palette.background }], testID: "OpenWifiGuard.gate", children: [_jsxs(View, { style: styles.content, children: [icon ?? _jsx(UnsafeWifiIcon, { color: palette.icon, accent: palette.accent }), _jsx(Text, { accessibilityRole: "header", style: [styles.title, { color: palette.text }, bold], children: content.title }), _jsx(Text, { style: [styles.message, { color: palette.textSecondary }, regular], children: content.message })] }), _jsxs(View, { style: styles.actions, children: [_jsx(Pressable, { accessibilityRole: "button", accessibilityState: { disabled: busy, busy }, disabled: busy, onPress: run(content.primary), style: ({ pressed }) => [
                            styles.primaryButton,
                            { backgroundColor: palette.primary, opacity: pressed || busy ? 0.8 : 1 },
                        ], testID: "OpenWifiGuard.primary", children: busy ? (_jsx(ActivityIndicator, { color: palette.onPrimary })) : (_jsx(Text, { style: [styles.buttonLabel, { color: palette.onPrimary }, bold], children: content.primary.label })) }), content.secondary ? (_jsx(Pressable, { accessibilityRole: "button", disabled: busy, onPress: run(content.secondary), style: ({ pressed }) => [styles.secondaryButton, { opacity: pressed ? 0.6 : 1 }], testID: "OpenWifiGuard.secondary", children: _jsx(Text, { style: [styles.buttonLabel, { color: palette.link }, bold], children: content.secondary.label }) })) : null] })] }));
};
const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 64,
        paddingBottom: 40,
        justifyContent: 'space-between',
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 22,
        marginTop: 24,
        marginBottom: 8,
        textAlign: 'center',
    },
    message: {
        fontSize: 16,
        lineHeight: 24,
        textAlign: 'center',
    },
    actions: {
        width: '100%',
    },
    primaryButton: {
        minHeight: 52,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    secondaryButton: {
        minHeight: 48,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
    },
    buttonLabel: {
        fontSize: 16,
    },
});
//# sourceMappingURL=GateScreen.js.map