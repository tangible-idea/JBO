import CoreServices
import Foundation

/// One entry at the top level of the Downloads folder, with the metadata macOS
/// already records for it: when it arrived, when it was last opened, and where
/// it was downloaded from.
public struct DownloadItem: Identifiable, Hashable, Sendable {
    public var id: URL { url }
    public let url: URL
    public let name: String
    /// Lowercased extension without the dot. Empty for folders and extensionless files.
    public let ext: String
    public let isDirectory: Bool
    public let isPackage: Bool
    public let size: Int64
    /// When the item landed in Downloads (Finder's "Date Added").
    public let dateAdded: Date
    /// Last time the user opened it, from Spotlight. Nil when never opened or not indexed.
    public let lastUsed: Date?
    /// Download URL and, usually, the page it was downloaded from.
    public let whereFroms: [String]

    public init(url: URL, name: String? = nil, ext: String? = nil, isDirectory: Bool = false, isPackage: Bool = false,
                size: Int64 = 0, dateAdded: Date, lastUsed: Date? = nil, whereFroms: [String] = []) {
        self.url = url
        self.name = name ?? url.lastPathComponent
        self.ext = (ext ?? url.pathExtension).lowercased()
        self.isDirectory = isDirectory
        self.isPackage = isPackage
        self.size = size
        self.dateAdded = dateAdded
        self.lastUsed = lastUsed
        self.whereFroms = whereFroms
    }

    /// Registrable domains the file came from, most specific source first:
    /// the referring page, then the download URL itself (often a CDN).
    public var sourceDomains: [String] {
        var seen = Set<String>()
        let ordered = whereFroms.count > 1 ? [whereFroms[1], whereFroms[0]] : whereFroms
        return ordered.compactMap { Domain.registrable(fromURL: $0) }.filter { seen.insert($0).inserted }
    }

    public var primaryDomain: String? { sourceDomains.first }

    /// A plain file or an app bundle; excludes ordinary folders.
    public var isFileLike: Bool { !isDirectory || isPackage }
}

public enum DownloadScanner {
    public static let defaultDownloadsURL = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Downloads")

    /// Lists the top level of `folder`. Throws when macOS denies access, so the UI
    /// can ask the user to allow it.
    public static func scan(_ folder: URL) throws -> [DownloadItem] {
        let keys: [URLResourceKey] = [.isDirectoryKey, .isPackageKey, .fileSizeKey, .totalFileAllocatedSizeKey,
                                      .addedToDirectoryDateKey, .creationDateKey, .isHiddenKey]
        let urls = try FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: keys,
                                                               options: [.skipsHiddenFiles])
        return urls.compactMap { load($0) }
    }

    public static func load(_ url: URL) -> DownloadItem? {
        guard let values = try? url.resourceValues(forKeys: [.isDirectoryKey, .isPackageKey, .fileSizeKey,
                                                              .totalFileAllocatedSizeKey, .addedToDirectoryDateKey,
                                                              .creationDateKey, .isHiddenKey]),
              values.isHidden != true else { return nil }
        let isDirectory = values.isDirectory ?? false
        return DownloadItem(
            url: url,
            isDirectory: isDirectory,
            isPackage: values.isPackage ?? false,
            size: Int64(values.fileSize ?? values.totalFileAllocatedSize ?? 0),
            dateAdded: (useCreationDates ? values.creationDate : values.addedToDirectoryDate) ?? values.creationDate ?? Date(),
            lastUsed: lastUsedDate(url),
            whereFroms: whereFroms(url)
        )
    }

    /// Test fixtures can't fake Finder's "Date Added", so debug builds can read
    /// creation dates instead (set with `touch -t`) via TIDYMARK_FIXTURE_DATES=1.
    #if DEBUG
    static let useCreationDates = ProcessInfo.processInfo.environment["TIDYMARK_FIXTURE_DATES"] == "1"
    #else
    static let useCreationDates = false
    #endif

    /// `kMDItemLastUsedDate` from Spotlight.
    static func lastUsedDate(_ url: URL) -> Date? {
        guard let item = MDItemCreateWithURL(kCFAllocatorDefault, url as CFURL) else { return nil }
        return MDItemCopyAttribute(item, kMDItemLastUsedDate) as? Date
    }

    /// Browsers store the source URLs as a binary plist in this extended attribute.
    static func whereFroms(_ url: URL) -> [String] {
        let name = "com.apple.metadata:kMDItemWhereFroms"
        let length = getxattr(url.path, name, nil, 0, 0, 0)
        guard length > 0 else { return [] }
        var data = Data(count: length)
        let read = data.withUnsafeMutableBytes { getxattr(url.path, name, $0.baseAddress, length, 0, 0) }
        guard read == length,
              let list = try? PropertyListSerialization.propertyList(from: data, format: nil) as? [String] else { return [] }
        return list.filter { !$0.isEmpty }
    }
}

public enum Domain {
    private static let secondLevel: Set<String> = ["co", "com", "ac", "go", "or", "ne", "gov", "edu", "org", "net", "re", "pe"]

    /// `https://www.shop.coupang.com/x` → `coupang.com`, `https://mail.naver.co.kr` → `naver.co.kr`.
    public static func registrable(fromURL string: String) -> String? {
        guard let host = URL(string: string)?.host?.lowercased(), !host.isEmpty else { return nil }
        return registrable(host: host)
    }

    public static func registrable(host: String) -> String? {
        let labels = host.split(separator: ".").map(String.init).filter { !$0.isEmpty }
        guard labels.count >= 2, !labels.allSatisfy({ Int($0) != nil }) else { return nil }
        let take = labels.count >= 3 && labels.last!.count == 2 && secondLevel.contains(labels[labels.count - 2]) ? 3 : 2
        return labels.suffix(take).joined(separator: ".")
    }
}
