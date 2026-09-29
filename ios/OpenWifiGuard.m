#import <CoreLocation/CoreLocation.h>
#import <Network/Network.h>
#import <NetworkExtension/NetworkExtension.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#import <React/RCTLog.h>

static NSString *const kChangedEvent = @"OpenWifiGuardChanged";

/**
 * Open Wi-Fi Guard native module (iOS).
 *
 * Reports the connection type and the security of the connected Wi-Fi network. The JS side decides what blocks the
 * app. SSID / BSSID never leave this module.
 *
 * `NEHotspotNetwork.fetchCurrent` (iOS 14+, `securityType` iOS 15+) needs the Access Wi-Fi Information entitlement and
 * location permission ("While Using"); without them it returns nil and the security is reported as UNKNOWN.
 */
@interface OpenWifiGuard : RCTEventEmitter <RCTBridgeModule, CLLocationManagerDelegate>
@end

@implementation OpenWifiGuard {
  dispatch_queue_t _queue;
  nw_path_monitor_t _monitor;
  /// Latest path from the monitor; read and written on `_queue`
  nw_path_t _path;
  BOOL _hasListeners;
  /// Created and used on the main queue (delegate callbacks need a run loop)
  CLLocationManager *_locationManager;
  NSMutableArray<RCTPromiseResolveBlock> *_pendingPermission;
}

RCT_EXPORT_MODULE(OpenWifiGuard)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (instancetype)init
{
  if (self = [super init]) {
    _queue = dispatch_queue_create("com.openwifiguard.network", DISPATCH_QUEUE_SERIAL);
    _pendingPermission = [NSMutableArray new];
    _monitor = nw_path_monitor_create();
    nw_path_monitor_set_queue(_monitor, _queue);
    __weak OpenWifiGuard *weakSelf = self;
    nw_path_monitor_set_update_handler(_monitor, ^(nw_path_t path) {
      OpenWifiGuard *strongSelf = weakSelf;
      if (!strongSelf) {
        return;
      }
      strongSelf->_path = path;
      [strongSelf emitChanged];
    });
    nw_path_monitor_start(_monitor);
  }
  return self;
}

- (void)dealloc
{
  if (_monitor) {
    nw_path_monitor_cancel(_monitor);
  }
}

- (NSArray<NSString *> *)supportedEvents
{
  return @[ kChangedEvent ];
}

- (void)startObserving
{
  _hasListeners = YES;
}

- (void)stopObserving
{
  _hasListeners = NO;
}

- (void)emitChanged
{
  if (_hasListeners) {
    [self sendEventWithName:kChangedEvent body:nil];
  }
}

#pragma mark - Network

static NSString *TransportOf(nw_path_t path)
{
  if (!path || nw_path_get_status(path) != nw_path_status_satisfied) {
    return @"NONE";
  }
  if (nw_path_uses_interface_type(path, nw_interface_type_wifi)) {
    return @"WIFI";
  }
  if (nw_path_uses_interface_type(path, nw_interface_type_cellular)) {
    return @"CELLULAR";
  }
  if (nw_path_uses_interface_type(path, nw_interface_type_wired)) {
    return @"ETHERNET";
  }
  if (nw_path_uses_interface_type(path, nw_interface_type_other)) {
    return @"VPN";
  }
  return @"OTHER";
}

/// A Wi-Fi interface is part of the path, even when a VPN or cellular carries the traffic
static BOOL PathHasWifi(nw_path_t path)
{
  if (!path) {
    return NO;
  }
  __block BOOL found = NO;
  nw_path_enumerate_interfaces(path, ^bool(nw_interface_t interface) {
    if (nw_interface_get_type(interface) == nw_interface_type_wifi) {
      found = YES;
      return false;
    }
    return true;
  });
  return found;
}

static NSString *SecurityOf(NEHotspotNetwork *network) API_AVAILABLE(ios(15.0))
{
  if (!network) {
    return @"UNKNOWN";
  }
  switch (network.securityType) {
    case NEHotspotNetworkSecurityTypeOpen:
      return @"OPEN";
    case NEHotspotNetworkSecurityTypeWEP:
      return @"WEP";
    case NEHotspotNetworkSecurityTypePersonal:
      return @"PERSONAL";
    case NEHotspotNetworkSecurityTypeEnterprise:
      return @"ENTERPRISE";
    default:
      return @"UNKNOWN";
  }
}

#pragma mark - Location

/// Main queue only
- (CLLocationManager *)locationManager
{
  if (!_locationManager) {
    _locationManager = [CLLocationManager new];
    _locationManager.delegate = self;
  }
  return _locationManager;
}

/// GRANTED (precise) | APPROXIMATE | NOT_ASKED | BLOCKED (iOS never shows the prompt twice). Main queue only.
- (NSString *)permissionStatus
{
  CLLocationManager *manager = [self locationManager];
  CLAuthorizationStatus status;
  if (@available(iOS 14.0, *)) {
    status = manager.authorizationStatus;
  } else {
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
    status = [CLLocationManager authorizationStatus];
#pragma clang diagnostic pop
  }
  switch (status) {
    case kCLAuthorizationStatusNotDetermined:
      return @"NOT_ASKED";
    case kCLAuthorizationStatusAuthorizedAlways:
    case kCLAuthorizationStatusAuthorizedWhenInUse:
      if (@available(iOS 14.0, *)) {
        if (manager.accuracyAuthorization == CLAccuracyAuthorizationReducedAccuracy) {
          return @"APPROXIMATE";
        }
      }
      return @"GRANTED";
    default:
      return @"BLOCKED";
  }
}

- (void)authorizationChanged
{
  NSString *status = [self permissionStatus];
  if ([status isEqualToString:@"NOT_ASKED"]) {
    return;
  }
  NSArray<RCTPromiseResolveBlock> *waiting = [_pendingPermission copy];
  [_pendingPermission removeAllObjects];
  for (RCTPromiseResolveBlock resolve in waiting) {
    resolve(status);
  }
  [self emitChanged];
}

- (void)locationManagerDidChangeAuthorization:(CLLocationManager *)manager API_AVAILABLE(ios(14.0))
{
  [self authorizationChanged];
}

#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-implementations"
- (void)locationManager:(CLLocationManager *)manager didChangeAuthorizationStatus:(CLAuthorizationStatus)status
{
  // iOS 13 only; iOS 14+ calls locationManagerDidChangeAuthorization instead
  if (@available(iOS 14.0, *)) {
    return;
  }
  [self authorizationChanged];
}
#pragma clang diagnostic pop

#pragma mark - Methods

RCT_EXPORT_METHOD(getStatus : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject)
{
  dispatch_async(_queue, ^{
    nw_path_t path = self->_path;
    NSString *transport = TransportOf(path);
    BOOL pathHasWifi = PathHasWifi(path);
    // Documented as potentially slow; kept off the main queue
    BOOL locationOn = [CLLocationManager locationServicesEnabled];

    dispatch_async(dispatch_get_main_queue(), ^{
      NSString *permission = [self permissionStatus];

      void (^finish)(BOOL, NSString *, BOOL) = ^(BOOL wifiConnected, NSString *security, BOOL supported) {
        BOOL unknown = [security isEqualToString:@"UNKNOWN"];
        BOOL needsLocation = supported && unknown && (![permission isEqualToString:@"GRANTED"] || !locationOn);
        resolve(@{
          @"transport" : transport,
          @"wifiConnected" : @(wifiConnected),
          @"wifiSecurity" : security ?: [NSNull null],
          @"captivePortal" : [NSNull null],
          @"locationPermission" : permission,
          @"locationServicesOn" : @(locationOn),
          @"needsLocation" : @(needsLocation),
          @"supported" : @(supported),
          @"source" : (security && !unknown) ? @"HOTSPOT" : @"NONE",
        });
      };

      if (@available(iOS 15.0, *)) {
        [NEHotspotNetwork fetchCurrentWithCompletionHandler:^(NEHotspotNetwork *_Nullable network) {
          BOOL wifiConnected = pathHasWifi || network != nil;
          finish(wifiConnected, wifiConnected ? SecurityOf(network) : nil, YES);
        }];
      } else {
        // The security type API doesn't exist before iOS 15
        finish(pathHasWifi, pathHasWifi ? @"UNKNOWN" : nil, NO);
      }
    });
  });
}

/// Connection type only (no Wi-Fi details); used when the full status fails.
RCT_EXPORT_METHOD(getTransport : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject)
{
  dispatch_async(_queue, ^{
    nw_path_t path = self->_path;
    resolve(PathHasWifi(path) ? @"WIFI" : TransportOf(path));
  });
}

/// Shows the "While Using" prompt once; afterwards resolves the current status (the user changes it in Settings).
RCT_EXPORT_METHOD(requestLocationPermission : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    NSString *status = [self permissionStatus];
    if (![status isEqualToString:@"NOT_ASKED"]) {
      resolve(status);
      return;
    }
    // Without the purpose string iOS silently ignores the request and the promise would never settle
    if (![[NSBundle mainBundle] objectForInfoDictionaryKey:@"NSLocationWhenInUseUsageDescription"]) {
      RCTLogWarn(@"[OpenWifiGuard] NSLocationWhenInUseUsageDescription is missing from Info.plist");
      reject(@"MISSING_USAGE_DESCRIPTION", @"NSLocationWhenInUseUsageDescription is missing from Info.plist", nil);
      return;
    }
    [self->_pendingPermission addObject:resolve];
    [[self locationManager] requestWhenInUseAuthorization];
  });
}

/// iOS has no public link to Wi-Fi or location settings; JS opens the app's settings instead.
RCT_EXPORT_METHOD(openWifiSettings : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject)
{
  resolve(@NO);
}

RCT_EXPORT_METHOD(openLocationSettings : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject)
{
  resolve(@NO);
}

@end
