#if DEBUG
import AppKit
import SwiftUI
import TidyCore

/// Debug-only: `--snapshot <dir>` renders the app's own windows to PNGs and quits,
/// so the UI can be reviewed without screen-recording permission.
@MainActor
enum Snapshotter {
    static func runIfRequested() {
        let args = ProcessInfo.processInfo.arguments
        guard let flag = args.firstIndex(of: "--snapshot"), args.indices.contains(flag + 1) else { return }
        let folder = URL(fileURLWithPath: args[flag + 1])
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        Task { await run(into: folder) }
    }

    static func run(into folder: URL) async {
        let model = AppModel.shared
        if !model.onboarded {
            render(OnboardingView().environment(model).background(Theme.paper), size: CGSize(width: 1000, height: 640), to: folder, name: "0-onboarding")
            model.onboarded = true
        }
        model.start()
        try? await Task.sleep(for: .seconds(3))
        render(MenuBarView().environment(model).background(.regularMaterial), size: CGSize(width: 360, height: 420), to: folder, name: "1-menubar")
        for mode in OrganizeMode.allCases {
            model.studioTab = .organize
            model.mode = mode
            model.analyze()
            try? await Task.sleep(for: .milliseconds(300))
            render(StudioView().environment(model), size: CGSize(width: 1000, height: 1500), to: folder, name: "2-organize-\(mode.letter)")
        }
        model.studioTab = .checkup
        render(StudioView().environment(model), size: CGSize(width: 1000, height: 1300), to: folder, name: "3-checkup")
        model.studioTab = .settings
        render(StudioView().environment(model), size: CGSize(width: 1000, height: 1100), to: folder, name: "4-settings")
        NSApp.terminate(nil)
    }

    static func render<V: View>(_ view: V, size: CGSize, to folder: URL, name: String) {
        let window = NSWindow(contentRect: CGRect(origin: .zero, size: size), styleMask: [.borderless], backing: .buffered, defer: false)
        let host = NSHostingView(rootView: view.frame(width: size.width, height: size.height))
        host.frame = CGRect(origin: .zero, size: size)
        window.contentView = host
        window.orderFrontRegardless()
        host.layoutSubtreeIfNeeded()
        RunLoop.current.run(until: Date().addingTimeInterval(0.4))
        guard let rep = host.bitmapImageRepForCachingDisplay(in: host.bounds) else { return }
        host.cacheDisplay(in: host.bounds, to: rep)
        try? rep.representation(using: .png, properties: [:])?.write(to: folder.appendingPathComponent("\(name).png"))
        window.orderOut(nil)
    }
}
#endif
