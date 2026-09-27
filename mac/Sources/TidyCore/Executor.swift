import Foundation

/// What one apply did, so it can be reversed exactly.
public struct UndoRecord: Codable, Sendable {
    public struct Move: Codable, Sendable {
        public let from: URL
        public let to: URL
        public let trashed: Bool
    }
    public var moves: [Move] = []
    public var createdFolders: [URL] = []
    public var createdAt = Date()
    /// Source sentence and count, translated when shown (see L()).
    public var summaryKey = "파일 {0}개를 정리했어요."
    public var count: Int { moves.count }
    public var summary: String { L(summaryKey, count) }
}

public struct ApplyResult: Sendable {
    public let record: UndoRecord
    public let failures: [String]
}

public enum Executor {
    /// Applies the checked items. Moves never overwrite: a clash becomes "name 2.ext".
    /// Deleting always goes through the Trash.
    public static func apply(_ items: [PlanItem], fileManager: FileManager = .default) -> ApplyResult {
        var record = UndoRecord()
        var failures: [String] = []
        for plan in items where plan.checked {
            let source = plan.item.url
            do {
                switch plan.action {
                case .keep:
                    continue
                case .trash:
                    var trashed: NSURL?
                    try fileManager.trashItem(at: source, resultingItemURL: &trashed)
                    if let trashed = trashed as URL? { record.moves.append(.init(from: source, to: trashed, trashed: true)) }
                case .move(let folder):
                    try createFolder(folder, record: &record, fileManager: fileManager)
                    let target = uniqueURL(folder.appendingPathComponent(source.lastPathComponent), fileManager: fileManager)
                    try fileManager.moveItem(at: source, to: target)
                    record.moves.append(.init(from: source, to: target, trashed: false))
                }
            } catch {
                failures.append(L("‘{0}’을(를) 옮기지 못했어요: {1}", source.lastPathComponent, error.localizedDescription))
            }
        }
        return ApplyResult(record: record, failures: failures)
    }

    /// Puts everything back, newest first, then removes folders this apply created if they are empty.
    @discardableResult
    public static func undo(_ record: UndoRecord, fileManager: FileManager = .default) -> [String] {
        var failures: [String] = []
        for move in record.moves.reversed() {
            do {
                try fileManager.createDirectory(at: move.from.deletingLastPathComponent(), withIntermediateDirectories: true)
                try fileManager.moveItem(at: move.to, to: uniqueURL(move.from, fileManager: fileManager))
            } catch {
                failures.append(L("‘{0}’을(를) 옮기지 못했어요: {1}", move.from.lastPathComponent, error.localizedDescription))
            }
        }
        for folder in record.createdFolders.sorted(by: { $0.path.count > $1.path.count }) {
            if let contents = try? fileManager.contentsOfDirectory(atPath: folder.path),
               contents.allSatisfy({ $0 == ".DS_Store" }) {
                try? fileManager.removeItem(at: folder)
            }
        }
        return failures
    }

    static func createFolder(_ folder: URL, record: inout UndoRecord, fileManager: FileManager) throws {
        var missing: [URL] = []
        var cursor = folder
        while !fileManager.fileExists(atPath: cursor.path) && cursor.path != "/" {
            missing.append(cursor)
            cursor.deleteLastPathComponent()
        }
        try fileManager.createDirectory(at: folder, withIntermediateDirectories: true)
        record.createdFolders += missing
    }

    public static func uniqueURL(_ url: URL, fileManager: FileManager = .default) -> URL {
        guard fileManager.fileExists(atPath: url.path) else { return url }
        let folder = url.deletingLastPathComponent()
        let ext = url.pathExtension
        let base = url.deletingPathExtension().lastPathComponent
        var n = 2
        while true {
            let candidate = folder.appendingPathComponent(ext.isEmpty ? "\(base) \(n)" : "\(base) \(n).\(ext)")
            if !fileManager.fileExists(atPath: candidate.path) { return candidate }
            n += 1
        }
    }
}

/// The last apply, kept on disk so Undo survives a restart.
public enum UndoStore {
    public static var file: URL {
        let folder = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Tidymark", isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder.appendingPathComponent("last-undo.json")
    }

    public static func load() -> UndoRecord? {
        guard let data = try? Data(contentsOf: file) else { return nil }
        return try? JSONDecoder().decode(UndoRecord.self, from: data)
    }

    public static func save(_ record: UndoRecord?) {
        guard let record, record.count > 0 else { try? FileManager.default.removeItem(at: file); return }
        try? JSONEncoder().encode(record).write(to: file, options: .atomic)
    }
}
