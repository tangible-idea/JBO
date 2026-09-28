import AppKit
import SwiftUI
import TidyCore

@main
struct TidymarkMacApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var delegate
    @State private var model = AppModel.shared

    var body: some Scene {
        MenuBarExtra {
            MenuBarView()
                .environment(model)
        } label: {
            Image("MenuBarIcon")
        }
        .menuBarExtraStyle(.window)

        Window("Tidymark", id: "studio") {
            StudioView()
                .environment(model)
                .frame(minWidth: 860, minHeight: 620)
        }
        .defaultSize(width: 1000, height: 720)
        .windowResizability(.contentMinSize)
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        StudioOpener.open()
        return false
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Tidymark keeps one light look everywhere (extension, site, app), even in Dark Mode.
        NSApp.appearance = NSAppearance(named: .aqua)
        Notifier.shared.configure()
        let model = AppModel.shared
        if model.onboarded {
            model.start()
        } else {
            // First launch: explain before macOS asks for Downloads access.
            DispatchQueue.main.async { StudioOpener.open() }
        }
        if ProcessInfo.processInfo.arguments.contains("--open-studio") {
            DispatchQueue.main.async { StudioOpener.open() }
        }
        #if DEBUG
        Snapshotter.runIfRequested()
        #endif
    }
}

/// Opens (or focuses) the studio window from places without SwiftUI's openWindow.
enum StudioOpener {
    @MainActor static var openWindow: OpenWindowAction?

    @MainActor static func open() {
        NSApp.activate(ignoringOtherApps: true)
        if let window = NSApp.windows.first(where: { $0.identifier?.rawValue.contains("studio") == true }) {
            if window.isMiniaturized { window.deminiaturize(nil) }
            window.makeKeyAndOrderFront(nil)
        } else {
            openWindow?(id: "studio")
        }
    }
}
