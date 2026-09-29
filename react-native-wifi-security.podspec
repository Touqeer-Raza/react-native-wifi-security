require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "react-native-wifi-security"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]
  s.platforms    = { :ios => "13.4" }
  s.source       = { :git => "https://github.com/Touqeer-Raza/react-native-wifi-security.git", :tag => s.version.to_s }

  s.source_files = "ios/**/*.{h,m,mm}"
  s.frameworks   = "CoreLocation", "Network", "NetworkExtension"

  # Adds React-Core (and the new architecture dependencies when enabled) the way the app's React Native expects
  if respond_to?(:install_modules_dependencies, true)
    install_modules_dependencies(s)
  else
    s.dependency "React-Core"
  end
end
