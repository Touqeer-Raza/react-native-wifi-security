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

export const englishMessages: OpenWifiGuardMessages = {
  unsafeTitle: 'Unsafe Wi-Fi network',
  unsafeMessage:
    "You're connected to a public Wi-Fi that doesn't need a password. To keep your account safe, connect to a password-protected Wi-Fi or turn off Wi-Fi to use mobile data.",
  permissionTitle: 'Location access needed',
  permissionMessage:
    'Location access is required to check that your Wi-Fi is secure. Your location is only used on your phone and is never stored or shared.',
  cannotVerifyTitle: "Wi-Fi can't be verified",
  locationDeniedTitle: 'Location access needed',
  cannotVerifyPermissionMessage:
    'Location access is required to check that your Wi-Fi is secure. Allow it to continue on Wi-Fi, or switch to mobile data.',
  preciseLocationTitle: 'Precise location needed',
  cannotVerifyApproximateMessage:
    'Precise location is required to check that your Wi-Fi is secure. Turn it on in Settings to continue on Wi-Fi, or switch to mobile data.',
  cannotVerifyErrorMessage: "We couldn't check your Wi-Fi. Please try again or switch to mobile data.",
  unsupportedMessage: "This phone can't check whether your Wi-Fi is secure. Please switch to mobile data.",
  locationOffTitle: 'Turn on Location',
  locationOffMessage:
    'Location is required to check that your Wi-Fi is secure. Turn it on to continue on Wi-Fi, or switch to mobile data.',
  iosWifiHint: 'Go to Settings → Wi-Fi to change network.',
  wifiSettings: 'Wi-Fi settings',
  tryAgain: 'Try again',
  continue: 'Continue',
  allowLocation: 'Allow location',
  openSettings: 'Open Settings',
  turnOnLocation: 'Turn on Location',
};
