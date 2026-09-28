import CryptoKit
import Foundation

public enum CheckupKind: String, CaseIterable, Identifiable, Sendable {
    case installers, partial, duplicates, largeOld, screenshots
    public var id: String { rawValue }
}

public struct CheckupFinding: Identifiable, Sendable {
    public var id: UUID { plan.id }
    public let kind: CheckupKind
    public var plan: PlanItem
}

/// Things to delete or put away instead of sorting.
public enum Checkup {
    public static let partialExtensions: Set<String> = ["crdownload", "download", "part", "partial", "opdownload"]
    public static let largeBytes: Int64 = 500 * 1024 * 1024
    public static let largeUnusedDays = 90
    public static let screenshotDays = 7

    public static func run(_ items: [DownloadItem], root: URL, installedApps: [String], now: Date = Date()) -> [CheckupFinding] {
        var findings: [CheckupFinding] = []
        var claimed = Set<URL>()
        func add(_ kind: CheckupKind, _ plan: PlanItem) {
            guard claimed.insert(plan.item.url).inserted else { return }
            findings.append(CheckupFinding(kind: kind, plan: plan))
        }

        for item in items where partialExtensions.contains(item.ext) && now.timeIntervalSince(item.dateAdded) > Planner.day {
            add(.partial, PlanItem(item: item, action: .trash, reason: L("받다 만 파일이에요")))
        }
        for item in items where ["dmg", "pkg", "mpkg"].contains(item.ext) {
            if let app = installedApp(for: item.name, installedApps: installedApps) {
                add(.installers, PlanItem(item: item, action: .trash, reason: L("‘{0}’이(가) 이미 설치돼 있어요", app)))
            }
        }
        for (duplicate, original) in duplicates(items) {
            add(.duplicates, PlanItem(item: duplicate, action: .trash, reason: L("‘{0}’과 내용이 같아요", original.name)))
        }
        for item in items where item.isFileLike && item.size >= largeBytes {
            let idle = now.timeIntervalSince(item.lastUsed ?? item.dateAdded) / Planner.day
            if idle > Double(largeUnusedDays) {
                let size = ByteCountFormatter.string(fromByteCount: item.size, countStyle: .file)
                add(.largeOld, PlanItem(item: item, action: .trash, reason: L("{0}, {1}일 넘게 안 열었어요", size, largeUnusedDays), checked: false))
            }
        }
        for item in items where isScreenshot(item.name) && now.timeIntervalSince(item.dateAdded) > Double(screenshotDays) * Planner.day {
            add(.screenshots, PlanItem(item: item, action: .move(to: root.appendingPathComponent(L("스크린샷"))),
                                       reason: L("{0}일 지난 스크린샷", screenshotDays), checked: false))
        }
        return findings
    }

    // MARK: installers whose app is already in /Applications

    public static func installedAppNames(folders: [URL] = [
        URL(fileURLWithPath: "/Applications"),
        FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Applications"),
    ]) -> [String] {
        folders.flatMap { folder in
            ((try? FileManager.default.contentsOfDirectory(atPath: folder.path)) ?? [])
                .filter { $0.hasSuffix(".app") }
                .map { String($0.dropLast(4)) }
        }
    }

    static func compact(_ text: String) -> String {
        text.lowercased().unicodeScalars.filter { CharacterSet.alphanumerics.contains($0) }.map(String.init).joined()
    }

    /// "Figma-124.3.1-arm64.dmg" matches "Figma"; "googlechrome.dmg" matches "Google Chrome".
    /// The longest matching app wins so "Visual Studio Code" beats "Visual".
    public static func installedApp(for installerName: String, installedApps: [String]) -> String? {
        let base = compact((installerName as NSString).deletingPathExtension)
        return installedApps
            .filter { compact($0).count >= 3 && base.hasPrefix(compact($0)) }
            .max { compact($0).count < compact($1).count }
    }

    // MARK: identical files

    /// Pairs of (extra copy, copy to keep). Only files with equal sizes are hashed.
    public static func duplicates(_ items: [DownloadItem]) -> [(DownloadItem, DownloadItem)] {
        let files = items.filter { !$0.isDirectory && $0.size > 0 }
        var result: [(DownloadItem, DownloadItem)] = []
        for (_, sameSize) in Dictionary(grouping: files, by: \.size) where sameSize.count > 1 {
            guard !Task.isCancelled else { return [] }
            var byHash: [String: [DownloadItem]] = [:]
            for item in sameSize {
                guard !Task.isCancelled else { return [] }
                if let digest = hash(item.url) { byHash[digest, default: []].append(item) }
            }
            for (_, copies) in byHash where copies.count > 1 {
                let keep = copies.min { rank($0) < rank($1) }!
                result += copies.filter { $0.url != keep.url }.map { ($0, keep) }
            }
        }
        return result
    }

    /// Prefer the copy without a " (1)" / "-1" suffix, then the oldest.
    static func rank(_ item: DownloadItem) -> (Int, Date) {
        let base = (item.name as NSString).deletingPathExtension
        let isCopy = base.range(of: #"( \(\d+\)|-\d+| copy( \d+)?)$"#, options: .regularExpression) != nil
        return (isCopy ? 1 : 0, item.dateAdded)
    }

    static func hash(_ url: URL) -> String? {
        guard let handle = try? FileHandle(forReadingFrom: url) else { return nil }
        defer { try? handle.close() }
        var hasher = SHA256()
        do {
            while true {
                guard !Task.isCancelled else { return nil }
                guard let chunk = try handle.read(upToCount: 1024 * 1024), !chunk.isEmpty else { break }
                hasher.update(data: chunk)
            }
        } catch {
            return nil // A partial read must never count as a matching file.
        }
        return hasher.finalize().map { String(format: "%02x", $0) }.joined()
    }

    // MARK: screenshots

    public static func isScreenshot(_ name: String) -> Bool {
        name.range(of: #"^(Screenshot|Screen Shot|스크린샷|화면 캡처|CleanShot)"#, options: [.regularExpression, .caseInsensitive]) != nil
    }
}
