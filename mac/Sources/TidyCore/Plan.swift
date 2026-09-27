import Foundation

public enum PlanAction: Hashable, Sendable {
    /// Move into this folder (created if missing).
    case move(to: URL)
    case trash
    case keep
}

/// One proposed change. Nothing happens until the user applies the plan.
public struct PlanItem: Identifiable, Hashable, Sendable {
    public let id = UUID()
    public let item: DownloadItem
    public var action: PlanAction
    public let reason: String
    public var checked: Bool
    /// Low-confidence guesses are shown but not selected by default.
    public let needsReview: Bool

    public init(item: DownloadItem, action: PlanAction, reason: String, checked: Bool = true, needsReview: Bool = false) {
        self.item = item
        self.action = action
        self.reason = reason
        self.checked = checked && action != .keep
        self.needsReview = needsReview
    }

    /// Where the item ends up, for grouping in the UI.
    public func destinationLabel(root: URL) -> String {
        switch action {
        case .keep: return L("그대로 두기")
        case .trash: return L("휴지통")
        case .move(let folder):
            let rootPath = root.deletingLastPathComponent().path
            return folder.path.hasPrefix(rootPath + "/") ? String(folder.path.dropFirst(rootPath.count + 1)).replacingOccurrences(of: "/", with: " / ") : folder.path
        }
    }
}

public enum OrganizeMode: String, CaseIterable, Identifiable, Sendable {
    case newFolders, existingFolders, usage, projects
    public var id: String { rawValue }
    public var letter: String { ["A", "B", "C", "D"][OrganizeMode.allCases.firstIndex(of: self)!] }
}

public struct PlannerOptions: Sendable {
    /// Where modes A, C and D create folders (e.g. ~/Documents/Tidymark).
    public var root: URL
    /// Mode B targets, chosen by the user.
    public var targetFolders: [URL]
    /// Files downloaded within this many days are left alone.
    public var graceDays: Int
    /// Mode C: split each usage bucket by file kind.
    public var splitUsageByKind: Bool
    public var bookmarks: BookmarkIndex
    public var now: Date

    public init(root: URL, targetFolders: [URL] = [], graceDays: Int = 2, splitUsageByKind: Bool = true,
                bookmarks: BookmarkIndex = BookmarkIndex(), now: Date = Date()) {
        self.root = root
        self.targetFolders = targetFolders
        self.graceDays = graceDays
        self.splitUsageByKind = splitUsageByKind
        self.bookmarks = bookmarks
        self.now = now
    }
}
