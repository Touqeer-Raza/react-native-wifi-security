import React from 'react';
import { type OpenWifiGuardMessages } from './messages';
import type { OpenWifiGuardController } from './useOpenWifiGuard';
export interface GateTheme {
    background: string;
    text: string;
    textSecondary: string;
    icon: string;
    /** Slash across the Wi-Fi icon */
    accent: string;
    primary: string;
    onPrimary: string;
    link: string;
    /** Font for body text (default: system font) */
    fontFamily?: string;
    /** Font for the title and buttons (default: system bold) */
    fontFamilyBold?: string;
}
export declare const lightGateTheme: GateTheme;
export declare const darkGateTheme: GateTheme;
export interface GateScreenProps {
    guard: OpenWifiGuardController;
    messages?: Partial<OpenWifiGuardMessages>;
    /** Overrides for light mode (and dark mode unless `darkTheme` is given) */
    theme?: Partial<GateTheme>;
    darkTheme?: Partial<GateTheme>;
    /** Replaces the built-in Wi-Fi icon */
    icon?: React.ReactNode;
}
interface Action {
    label: string;
    onPress: () => Promise<void>;
}
interface Content {
    title: string;
    message: string;
    primary: Action;
    secondary?: Action;
}
export declare const getGateContent: (guard: OpenWifiGuardController, m: OpenWifiGuardMessages) => Content;
/** Wi-Fi symbol with a slash, drawn with plain Views (no SVG dependency). */
export declare const UnsafeWifiIcon: ({ color, accent, size }: {
    color: string;
    accent: string;
    size?: number;
}) => React.JSX.Element;
/**
 * Built-in full-screen gate, styled like a "No internet" screen. Nothing underneath can be used while it shows.
 */
export declare const GateScreen: React.FC<GateScreenProps>;
export {};
