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
    var isChecking = false
    var isAnalyzing = false
    var mode: OrganizeMode = .newFolders
    var studioTab: StudioTab = .organize
    var plan: [PlanItem] = []
    var planMode: OrganizeMode?
    var findings: [CheckupFinding] = []
    var lastUndo: UndoRecord?
    var status: (text: String, isError: Bool)?
    /// Live suggestions for downloads that arrived while the app was running.
    var suggestions: [PlanItem] = []
    private(set) var bookmarks = BookmarkIndex()

    private let defaults: UserDefaults
    private let chromeRoot: URL
    private var watcher: FolderWatcher?
    private var knownURLs = Set<URL>()
    private var hasScanned = false
    private var lastScan: Date?
    private var refreshPending = false
    private var checkupTask: Task<Void, Never>?
    private var scanRevision = 0
    private var planRevision = 0

    private init() {
        // Launch arguments let development point the app at a fixture folder
        // instead of the real Downloads: --downloads <path> --root <path> --chrome <path>.
        let args = ProcessInfo.processInfo.arguments
        func arg(_ name: String) -> URL? {
            args.firstIndex(of: name).flatMap { args.indices.contains($0 + 1) ? URL(fileURLWithPath: args[$0 + 1]) : nil }
        }
        // Any override means a development run: keep its settings and undo record apart
        // from the real ones so a test can never overwrite what the user did.
        let isDevRun = ["--downloads", "--root", "--chrome"].contains(where: args.contains)
        defaults = isDevRun ? UserDefaults(suiteName: "net.tangibleidea.tidymark.mac.dev")! : .standard
        if isDevRun {
            UndoStore.directory = FileManager.default.temporaryDirectory.appendingPathComponent("TidymarkDev", isDirectory: true)
        }
        lastUndo = UndoStore.load()
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

    /// Opening the menu uses the last result. The watcher and explicit refresh
    /// keep it current; this fallback also works when watching is disabled.
    func refreshIfNeeded() {
        guard !isScanning, lastScan.map({ Date().timeIntervalSince($0) < 60 }) != true else { return }
        refresh()
    }

    func refresh() {
        guard !isScanning else { refreshPending = true; return }
        isScanning = true
        scanRevision += 1
        let revision = scanRevision
        checkupTask?.cancel()
        isChecking = false
        let folder = downloadsURL
        Task.detached(priority: .userInitiated) {
            let scanned = Result { try DownloadScanner.scan(folder) }
            await MainActor.run {
                self.isScanning = false
                defer {
                    if self.refreshPending {
                        self.refreshPending = false
                        self.refresh()
                    }
                }
                guard case .success(let items) = scanned else {
                    if case .failure(let error as NSError) = scanned {
                        self.accessDenied = error.code == NSFileReadNoPermissionError || error.domain == NSPOSIXErrorDomain
                    }
                    self.items = []
                    self.findings = []
                    return
                }
                self.accessDenied = false
                self.lastScan = Date()
                self.items = items
                self.recordArrivals(items)
                self.refreshPlanIfShown()
                self.runCheckup(items, revision: revision)
            }
        }
    }

    private func runCheckup(_ items: [DownloadItem], revision: Int) {
        let root = rootURL
        isChecking = true
        checkupTask = Task.detached(priority: .utility) {
            let findings = Checkup.run(items, root: root, installedApps: Checkup.installedAppNames())
            guard !Task.isCancelled else { return }
            await MainActor.run {
                guard self.scanRevision == revision else { return }
                self.findings = findings
                self.isChecking = false
            }
        }
    }

    var totalSize: Int64 { items.reduce(0) { $0 + $1.size } }

    // MARK: organize

    func analyze() {
        planRevision += 1
        let revision = planRevision
        let mode = mode
        let items = items
        let options = options
        isAnalyzing = true
        Task.detached(priority: .userInitiated) {
            let plan = Planner.plan(mode, items: items, options: options)
            await MainActor.run {
                guard self.planRevision == revision else { return }
                self.isAnalyzing = false
                guard self.mode == mode else { return }
                self.plan = plan
                self.planMode = mode
            }
        }
    }

    private func refreshPlanIfShown() {
        if let planMode, planMode == mode { analyze() }
    }

    func applyPlan() {
        planRevision += 1
        isAnalyzing = false
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
        refresh()
    }

    /// Compare only completed scans, rather than guessing when disk I/O finishes.
    private func recordArrivals(_ items: [DownloadItem]) {
        let arrivals = hasScanned && watchEnabled
            ? items.filter { !knownURLs.contains($0.url) && !Checkup.partialExtensions.contains($0.ext) }
            : []
        knownURLs = Set(items.map(\.url))
        hasScanned = true
        for item in arrivals {
            let suggestion = Planner.newFolder(item, options)
            suggestions.insert(suggestion, at: 0)
            if notifyEnabled { Notifier.shared.post(suggestion, root: rootURL) }
        }
        suggestions = Array(suggestions.prefix(8))
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
