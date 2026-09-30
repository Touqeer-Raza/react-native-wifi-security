/**
 * Text of the built-in gate screen. Pass `messages` to `<OpenWifiGuard>` to translate or reword any of it.
 */
export interface OpenWifiGuardMessages {
    unsafeTitle: string;
    unsafeMessage: string;
    permissionTitle: string;
    permissionMessage: string;
    cannotVerifyTitle: string;
    /** Title when location was denied */
    locationDeniedTitle: string;
    cannotVerifyPermissionMessage: string;
    /** Title when only approximate location is allowed */
    preciseLocationTitle: string;
    cannotVerifyApproximateMessage: string;
    cannotVerifyErrorMessage: string;
    unsupportedMessage: string;
    locationOffTitle: string;
    locationOffMessage: string;
    /** Appended on iOS, which has no public link to Wi-Fi settings */
    iosWifiHint: string;
    wifiSettings: string;
    tryAgain: string;
    continue: string;
    allowLocation: string;
    openSettings: string;
    turnOnLocation: string;
}
export declare const englishMessages: OpenWifiGuardMessages;
