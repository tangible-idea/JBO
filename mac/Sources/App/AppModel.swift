import AppKit
import Observation
import ServiceManagement
import TidyCore

/// App state shared by the menu bar window and the studio window.
@MainActor
@Observable
final class AppModel {
    static let shared = AppModel()

    // MARK: settings (UserDefaults)

    let downloadsURL: URL
    var rootURL: URL { didSet { defaults.set(rootURL.path, forKey: "rootPath"); refreshPlanIfShown() } }
    var targetFolders: [URL] { didSet { defaults.set(targetFolders.map(\.path), forKey: "targetFolders") } }
    var graceDays: Int { didSet { defaults.set(graceDays, forKey: "graceDays") } }
    var splitUsageByKind: Bool { didSet { defaults.set(splitUsageByKind, forKey: "splitUsageByKind") } }
    var useBookmarks: Bool { didSet { defaults.set(useBookmarks, forKey: "useBookmarks"); reloadBookmarks() } }
    var watchEnabled: Bool { didSet { defaults.set(watchEnabled, forKey: "watchEnabled"); updateWatcher() } }
    var notifyEnabled: Bool { didSet { defaults.set(notifyEnabled, forKey: "notifyEnabled"); if notifyEnabled { Notifier.shared.requestAuthorization() } } }
    var onboarded: Bool { didSet { defaults.set(onboarded, forKey: "onboarded") } }
    var language: Language {
        didSet { defaults.set(language.rawValue, forKey: L10n.preferenceKey); languageRevision += 1 }
    }
    /// Bumped when the language changes so views re-read their strings.
    var languageRevision = 0

    // MARK: state

    var items: [DownloadItem] = []
    var accessDenied = false
    var isScanning = false
    var mode: OrganizeMode = .newFolders
    var studioTab: StudioTab = .organize
    var plan: [PlanItem] = []
    var planMode: OrganizeMode?
    var findings: [CheckupFinding] = []
    var lastUndo: UndoRecord? = UndoStore.load()
    var status: (text: String, isError: Bool)?
    /// Live suggestions for downloads that arrived while the app was running.
    var suggestions: [PlanItem] = []
    private(set) var bookmarks = BookmarkIndex()

    private let defaults = UserDefaults.standard
    private let chromeRoot: URL
    private var watcher: FolderWatcher?
    private var knownURLs = Set<URL>()

    private init() {
        // Launch arguments let development point the app at a fixture folder
        // instead of the real Downloads: --downloads <path> --root <path> --chrome <path>.
        let args = ProcessInfo.processInfo.arguments
        func arg(_ name: String) -> URL? {
            args.firstIndex(of: name).flatMap { args.indices.contains($0 + 1) ? URL(fileURLWithPath: args[$0 + 1]) : nil }
        }
        downloadsURL = arg("--downloads") ?? DownloadScanner.defaultDownloadsURL
        chromeRoot = arg("--chrome") ?? BookmarkIndex.chromeRoot
        let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        rootURL = arg("--root") ?? defaults.string(forKey: "rootPath").map { URL(fileURLWithPath: $0) } ?? documents.appendingPathComponent("Tidymark")
        targetFolders = (defaults.stringArray(forKey: "targetFolders") ?? []).map { URL(fileURLWithPath: $0) }
        graceDays = defaults.object(forKey: "graceDays") as? Int ?? 2
        splitUsageByKind = defaults.object(forKey: "splitUsageByKind") as? Bool ?? true
        useBookmarks = defaults.object(forKey: "useBookmarks") as? Bool ?? true
        watchEnabled = defaults.object(forKey: "watchEnabled") as? Bool ?? true
        notifyEnabled = defaults.object(forKey: "notifyEnabled") as? Bool ?? true
        onboarded = defaults.bool(forKey: "onboarded") || args.contains("--skip-onboarding")
        language = Language(rawValue: defaults.string(forKey: L10n.preferenceKey) ?? "") ?? .system
        registerAppStrings()
        reloadBookmarks()
    }

    /// Called once the user has been told why access is needed (onboarding), or on later launches.
    func start() {
        guard onboarded else { return }
        refresh()
        updateWatcher()
        if notifyEnabled { Notifier.shared.requestAuthorization() }
    }

    var options: PlannerOptions {
        PlannerOptions(root: rootURL, targetFolders: targetFolders, graceDays: graceDays,
                       splitUsageByKind: splitUsageByKind, bookmarks: useBookmarks ? bookmarks : BookmarkIndex())
    }

    func reloadBookmarks() {
        let root = chromeRoot
        let enabled = useBookmarks
        Task.detached {
            let index = enabled ? BookmarkIndex.loadChrome(root: root) : BookmarkIndex()
            await MainActor.run { self.bookmarks = index }
        }
    }

    // MARK: scanning

    func refresh() {
        guard !isScanning else { return }
        isScanning = true
        let folder = downloadsURL
        let root = rootURL
        Task.detached(priority: .userInitiated) {
            let scanned = Result { try DownloadScanner.scan(folder) }
            let items = (try? scanned.get()) ?? []
            let findings = Checkup.run(items, root: root, installedApps: Checkup.installedAppNames())
            await MainActor.run {
                self.isScanning = false
                if case .failure(let error as NSError) = scanned {
                    self.accessDenied = error.code == NSFileReadNoPermissionError || error.domain == NSPOSIXErrorDomain
                    self.items = []
                    self.findings = []
                    return
                }
                self.accessDenied = false
                self.items = items
                self.findings = findings
                if self.knownURLs.isEmpty { self.knownURLs = Set(items.map(\.url)) }
                self.refreshPlanIfShown()
            }
        }
    }

    var totalSize: Int64 { items.reduce(0) { $0 + $1.size } }

    // MARK: organize

    func analyze() {
        plan = Planner.plan(mode, items: items, options: options)
        planMode = mode
    }

    private func refreshPlanIfShown() {
        if let planMode, planMode == mode { plan = Planner.plan(mode, items: items, options: options) }
    }

    func applyPlan() {
        apply(plan.filter(\.checked))
        plan = []
        planMode = nil
    }

    func applyCheckup() {
        apply(findings.map(\.plan).filter(\.checked))
    }

    func apply(_ items: [PlanItem]) {
        guard !items.isEmpty else { return }
        let result = Executor.apply(items)
        if result.record.count > 0 {
            lastUndo = result.record
            UndoStore.save(result.record)
        }
        status = result.failures.isEmpty
            ? (result.record.summary, false)
            : (result.failures.prefix(3).joined(separator: "\n"), true)
        refresh()
    }

    func undo() {
        guard let record = lastUndo else { return }
        let failures = Executor.undo(record)
        status = failures.isEmpty ? (L("파일 {0}개를 되돌렸어요.", record.count), false) : (failures.prefix(3).joined(separator: "\n"), true)
        lastUndo = nil
        UndoStore.save(nil)
        refresh()
    }

    // MARK: new downloads

    func updateWatcher() {
        watcher?.stop()
        watcher = nil
        guard watchEnabled, onboarded else { return }
        watcher = FolderWatcher(url: downloadsURL) { [weak self] in
            Task { @MainActor in self?.downloadsChanged() }
        }
    }

    private func downloadsChanged() {
        let before = knownURLs
        refresh()
        // Look at arrivals after the scan; partial downloads are skipped until they finish and get renamed.
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(600))
            let arrivals = self.items.filter { !before.contains($0.url) && !Checkup.partialExtensions.contains($0.ext) }
            self.knownURLs = Set(self.items.map(\.url))
            for item in arrivals {
                let suggestion = Planner.newFolder(item, self.options)
                self.suggestions.insert(suggestion, at: 0)
                if self.notifyEnabled { Notifier.shared.post(suggestion, root: self.rootURL) }
            }
            self.suggestions = Array(self.suggestions.prefix(8))
        }
    }

    func acceptSuggestion(path: String) {
        guard let index = suggestions.firstIndex(where: { $0.item.url.path == path }) else { return }
        var suggestion = suggestions.remove(at: index)
        suggestion.checked = true
        apply([suggestion])
    }

    func dismissSuggestion(path: String) {
        suggestions.removeAll { $0.item.url.path == path }
    }

    // MARK: system

    var launchAtLogin: Bool {
        get { SMAppService.mainApp.status == .enabled }
        set {
            do {
                if newValue { try SMAppService.mainApp.register() } else { try SMAppService.mainApp.unregister() }
            } catch {
                status = (error.localizedDescription, true)
            }
        }
    }

    func openPrivacySettings() {
        NSWorkspace.shared.open(URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_FilesAndFolders")!)
    }

    func reveal(_ url: URL) {
        NSWorkspace.shared.activateFileViewerSelecting([url])
    }
}
