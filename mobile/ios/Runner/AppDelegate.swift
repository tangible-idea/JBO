import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    GeneratedPluginRegistrant.register(with: self)
    if let controller = window?.rootViewController as? FlutterViewController {
      let channel = FlutterMethodChannel(name: "net.tangibleidea.mobile/config", binaryMessenger: controller.binaryMessenger)
      channel.setMethodCallHandler { call, result in
        guard call.method == "saveConnection",
              let args = call.arguments as? [String: String],
              let endpoint = args["endpoint"], let token = args["token"],
              let defaults = UserDefaults(suiteName: "group.net.tangibleidea.mobile") else {
          result(FlutterMethodNotImplemented)
          return
        }
        defaults.set(endpoint, forKey: "endpoint")
        defaults.set(token, forKey: "token")
        result(nil)
      }
    }
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
