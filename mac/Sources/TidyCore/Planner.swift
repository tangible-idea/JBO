import Foundation

/// Builds a move plan for one of the four organize modes. Rules only: extension,
/// source site, bookmark folders, dates. No file contents are read.
public enum Planner {
    public static let day: TimeInterval = 86_400
    public static let usage = (activeDays: 30, archiveDays: 180)
    /// Downloads this close together count as one session (mode D).
    public static let burstGap: TimeInterval = 3 * 3600
    public static let burstMinimum = 3

    public static func plan(_ mode: OrganizeMode, items: [DownloadItem], options: PlannerOptions) -> [PlanItem] {
        let (fresh, old) = splitFresh(items, options)
        let kept = fresh.map { PlanItem(item: $0, action: .keep, reason: L("최근 {0}일 안에 받은 파일", options.graceDays)) }
        switch mode {
        case .newFolders: return old.map { newFolder($0, options) } + kept
        case .existingFolders: return existingFolders(old, options) + kept
        case .usage: return old.map { usageBucket($0, options) } + kept
        case .projects: return projects(old, options) + kept
        }
    }

    static func splitFresh(_ items: [DownloadItem], _ options: PlannerOptions) -> ([DownloadItem], [DownloadItem]) {
        let cutoff = options.now.addingTimeInterval(-Double(options.graceDays) * day)
        let fresh = items.filter { $0.dateAdded > cutoff }
        return (fresh, items.filter { $0.dateAdded <= cutoff })
    }

    // MARK: A · new folders by kind, or by the bookmark folder of the same site

    /// Also used for live suggestions when a new download arrives.
    public static func newFolder(_ item: DownloadItem, _ options: PlannerOptions) -> PlanItem {
        if let match = options.bookmarks.folder(for: item) {
            let folder = match.path.reduce(options.root) { $0.appendingPathComponent(sanitize($1)) }
            return PlanItem(item: item, action: .move(to: folder),
                            reason: L("북마크 ‘{0}’와 같은 사이트({1})", match.path.joined(separator: " / "), match.domain))
        }
        if Checkup.isScreenshot(item.name) {
            return PlanItem(item: item, action: .move(to: options.root.appendingPathComponent(L("스크린샷"))), reason: L("스크린샷"))
        }
        let category = FileCategory.of(item)
        return PlanItem(item: item, action: .move(to: options.root.appendingPathComponent(category.folderName)),
                        reason: L("‘{0}’ 파일이라서", item.ext.isEmpty ? category.folderName : item.ext.uppercased()))
    }

    // MARK: B · into folders the user already has

    struct TargetProfile {
        let url: URL
        let tokens: Set<String>
        let domains: Set<String>
    }

    static func existingFolders(_ items: [DownloadItem], _ options: PlannerOptions) -> [PlanItem] {
        let targets = options.targetFolders.map { profile($0) }
        return items.map { item in
            var best: (target: TargetProfile, score: Double, reason: String)?
            func consider(_ target: TargetProfile, _ score: Double, _ reason: String) {
                if score > (best?.score ?? 0) { best = (target, score, reason) }
            }
            let bookmark = options.bookmarks.folder(for: item)
            let itemTokens = tokens(item.name).union(item.sourceDomains.flatMap { tokens($0) })
            for target in targets {
                let name = target.url.lastPathComponent
                if let bookmark, bookmark.path.contains(where: { $0.caseInsensitiveCompare(name) == .orderedSame }) {
                    consider(target, 0.9, L("북마크 ‘{0}’와 같은 사이트({1})", bookmark.path.joined(separator: " / "), bookmark.domain))
                }
                if let domain = item.sourceDomains.first(where: { target.domains.contains($0) }) {
                    consider(target, 0.85, L("같은 사이트({0})에서 받은 파일이 이미 있어요", domain))
                }
                if !target.tokens.isDisjoint(with: itemTokens) {
                    consider(target, 0.6, L("폴더 이름 ‘{0}’과 겹쳐요", name))
                }
            }
            guard let best else {
                return PlanItem(item: item, action: .keep, reason: L("맞는 폴더를 찾지 못했어요"))
            }
            return PlanItem(item: item, action: .move(to: best.target.url), reason: best.reason, checked: best.score >= 0.8,
                            needsReview: best.score < 0.8)
        }
    }

    /// Learns a target folder from its name and the sites its files came from.
    static func profile(_ folder: URL) -> TargetProfile {
        var domains = Set<String>()
        if let enumerator = FileManager.default.enumerator(at: folder, includingPropertiesForKeys: nil,
                                                           options: [.skipsHiddenFiles, .skipsPackageDescendants]) {
            var seen = 0
            for case let url as URL in enumerator {
                if enumerator.level > 2 { enumerator.skipDescendants(); continue }
                seen += 1
                if seen > 400 { break }
                for from in DownloadScanner.whereFroms(url) {
                    if let domain = Domain.registrable(fromURL: from) { domains.insert(domain) }
                }
            }
        }
        return TargetProfile(url: folder, tokens: tokens(folder.lastPathComponent), domains: domains)
    }

    static let stopwords: Set<String> = ["the", "and", "for", "com", "net", "org", "www", "file", "download", "copy", "final", "new"]

    static func tokens(_ text: String) -> Set<String> {
        let words = text.lowercased().components(separatedBy: CharacterSet.alphanumerics.inverted)
        return Set(words.filter { $0.count >= 3 && Int($0) == nil && !stopwords.contains($0) })
    }

    // MARK: C · by when it was last opened

    static func usageBucket(_ item: DownloadItem, _ options: PlannerOptions) -> PlanItem {
        let bucket: String
        let reason: String
        if let used = item.lastUsed {
            let days = options.now.timeIntervalSince(used) / day
            if days <= Double(usage.activeDays) {
                bucket = "Active"; reason = L("최근 {0}일 안에 연 것", usage.activeDays)
            } else if days <= Double(usage.archiveDays) {
                bucket = "Occasional"; reason = L("{0}~{1}일 전에 연 것", usage.activeDays, usage.archiveDays)
            } else {
                bucket = "Archive"; reason = L("{0}일 넘게 안 연 것", usage.archiveDays)
            }
        } else {
            bucket = "Someday"; reason = L("받기만 하고 한 번도 안 연 것")
        }
        var folder = options.root.appendingPathComponent(bucket)
        if options.splitUsageByKind { folder.appendPathComponent(FileCategory.of(item).folderName) }
        return PlanItem(item: item, action: .move(to: folder), reason: reason)
    }

    // MARK: D · downloads that arrived in one burst become a project folder

    static func projects(_ items: [DownloadItem], _ options: PlannerOptions) -> [PlanItem] {
        let sorted = items.sorted { $0.dateAdded < $1.dateAdded }
        var groups: [[DownloadItem]] = []
        for item in sorted {
            if let last = groups.last?.last, item.dateAdded.timeIntervalSince(last.dateAdded) <= burstGap {
                groups[groups.count - 1].append(item)
            } else {
                groups.append([item])
            }
        }
        var result: [PlanItem] = []
        for group in groups {
            guard group.count >= burstMinimum, let label = projectLabel(group) else {
                result += group.map { PlanItem(item: $0, action: .keep, reason: L("맞는 폴더를 찾지 못했어요")) }
                continue
            }
            let formatter = DateFormatter()
            formatter.dateFormat = "yyyy-MM-dd"
            let name = sanitize("\(formatter.string(from: group[0].dateAdded)) · \(label)")
            let folder = options.root.appendingPathComponent("Projects").appendingPathComponent(name)
            let span = group.last!.dateAdded.timeIntervalSince(group[0].dateAdded)
            let spanText = span < 3600 ? "\(max(1, Int(span / 60)))m" : "\(Int((span / 3600).rounded(.up)))h"
            let reason = L("{0} 동안 {1}개를 몰아서 받았어요", spanText, group.count)
            result += group.map { PlanItem(item: $0, action: .move(to: folder), reason: reason) }
        }
        return result
    }

    /// Names a burst after the site most of it came from, else a word most names share.
    /// Returns nil when the files have nothing in common, so unrelated downloads stay put.
    static func projectLabel(_ group: [DownloadItem]) -> String? {
        let domainCounts = Dictionary(group.compactMap(\.primaryDomain).map { ($0, 1) }, uniquingKeysWith: +)
        if let (domain, count) = domainCounts.max(by: { $0.value < $1.value }), count >= 2 { return domain }
        let tokenCounts = Dictionary(group.flatMap { tokens(($0.name as NSString).deletingPathExtension) }.map { ($0, 1) },
                                     uniquingKeysWith: +)
        if let (token, count) = tokenCounts.max(by: { $0.value < $1.value || ($0.value == $1.value && $0.key > $1.key) }),
           count >= 2 { return token }
        return nil
    }

    /// Folder names can't contain "/" or ":".
    public static func sanitize(_ name: String) -> String {
        let cleaned = name.replacingOccurrences(of: "/", with: "-").replacingOccurrences(of: ":", with: "-")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return cleaned.isEmpty ? L("묶음") : String(cleaned.prefix(80))
    }
}
