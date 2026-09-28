import Foundation
import TidyCore
import UserNotifications

/// Fires when entries in a folder change (a download lands, is renamed from
/// .crdownload, or is removed). Events are coalesced for a moment so one
/// download triggers one rescan.
final class FolderWatcher {
    private let source: DispatchSourceFileSystemObject
    private var pending: DispatchWorkItem?

    init?(url: URL, onChange: @escaping () -> Void) {
        let descriptor = open(url.path, O_EVTONLY)
        guard descriptor >= 0 else { return nil }
        source = DispatchSource.makeFileSystemObjectSource(fileDescriptor: descriptor, eventMask: [.write, .rename, .delete], queue: .main)
        source.setEventHandler { [weak self] in
            self?.pending?.cancel()
            let work = DispatchWorkItem(block: onChange)
            self?.pending = work
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5, execute: work)
        }
        source.setCancelHandler { close(descriptor) }
        source.resume()
    }

    func stop() {
        pending?.cancel()
        pending = nil
        source.cancel()
    }
}

/// "‘file.pdf’ → Documents" notifications with Move / Ignore buttons.
final class Notifier: NSObject, UNUserNotificationCenterDelegate {
    static let shared = Notifier()
    private let category = "tidymark.download"

    func configure() {
        let center = UNUserNotificationCenter.current()
        center.delegate = self
        let move = UNNotificationAction(identifier: "move", title: L("옮기기"))
        let ignore = UNNotificationAction(identifier: "ignore", title: L("그대로 두기"))
        center.setNotificationCategories([UNNotificationCategory(identifier: category, actions: [move, ignore], intentIdentifiers: [])])
    }

    func requestAuthorization() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
    }

    func post(_ suggestion: PlanItem, root: URL) {
        let content = UNMutableNotificationContent()
        content.title = suggestion.item.name
        content.body = "→ \(suggestion.destinationLabel(root: root))\n\(suggestion.reason)"
        content.categoryIdentifier = category
        content.userInfo = ["path": suggestion.item.url.path]
        UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: suggestion.item.url.path, content: content, trigger: nil))
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        guard let path = response.notification.request.content.userInfo["path"] as? String else { return }
        await MainActor.run {
            switch response.actionIdentifier {
            case "move": AppModel.shared.acceptSuggestion(path: path)
            case "ignore": AppModel.shared.dismissSuggestion(path: path)
            default: break
            }
        }
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .sound]
    }
}
