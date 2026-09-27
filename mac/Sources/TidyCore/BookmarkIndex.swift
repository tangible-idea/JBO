import Foundation

/// Which bookmark folders each site lives in, read from Chrome's profiles. When a
/// download comes from a site the user already filed under "Travel / Portugal",
/// the file can go to a folder of the same name.
public struct BookmarkIndex: Sendable {
    /// Registrable domain → folder paths (top-level roots such as "Bookmarks bar" removed).
    public private(set) var foldersByDomain: [String: [[String]]] = [:]

    public init(foldersByDomain: [String: [[String]]] = [:]) {
        self.foldersByDomain = foldersByDomain
    }

    public static let chromeRoot = FileManager.default.homeDirectoryForCurrentUser
        .appendingPathComponent("Library/Application Support/Google/Chrome")

    /// Reads `Bookmarks` from every Chrome profile. Missing or unreadable files are skipped.
    public static func loadChrome(root: URL = chromeRoot) -> BookmarkIndex {
        var index = BookmarkIndex()
        let profiles = (try? FileManager.default.contentsOfDirectory(atPath: root.path)) ?? []
        for profile in profiles where profile == "Default" || profile.hasPrefix("Profile ") {
            let file = root.appendingPathComponent(profile).appendingPathComponent("Bookmarks")
            guard let data = try? Data(contentsOf: file) else { continue }
            index.merge(chromeJSON: data)
        }
        return index
    }

    public mutating func merge(chromeJSON data: Data) {
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let roots = json["roots"] as? [String: Any] else { return }
        for case let root as [String: Any] in roots.values {
            walk(root, path: [], isRoot: true)
        }
    }

    private mutating func walk(_ node: [String: Any], path: [String], isRoot: Bool) {
        if let url = node["url"] as? String {
            guard !path.isEmpty, let domain = Domain.registrable(fromURL: url) else { return }
            if !(foldersByDomain[domain]?.contains(path) ?? false) {
                foldersByDomain[domain, default: []].append(path)
            }
            return
        }
        let name = (node["name"] as? String) ?? ""
        // Chrome's own roots (Bookmarks bar, Other bookmarks, Mobile) are not topics.
        let next = isRoot ? path : path + [name]
        for case let child as [String: Any] in (node["children"] as? [Any]) ?? [] {
            walk(child, path: next, isRoot: false)
        }
    }

    /// The most specific folder path for any of the item's source domains, capped at two levels.
    public func folder(for item: DownloadItem) -> (path: [String], domain: String)? {
        for domain in item.sourceDomains {
            if let paths = foldersByDomain[domain], let best = paths.max(by: { $0.count < $1.count }) {
                // Skip Tidymark's own usage buckets; they describe habits, not topics.
                let meaningful = best.filter { !["Active", "Occasional", "Someday", "Archive", "Tidymark"].contains($0) }
                guard !meaningful.isEmpty else { continue }
                return (Array(meaningful.suffix(2)), domain)
            }
        }
        return nil
    }
}
