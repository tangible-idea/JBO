import XCTest
@testable import TidyCore

final class TidyCoreTests: XCTestCase {
    let now = Date(timeIntervalSince1970: 1_790_000_000)
    let root = URL(fileURLWithPath: "/tmp/Tidymark")
    var day: TimeInterval { Planner.day }

    override func setUp() {
        UserDefaults.standard.set("ko", forKey: L10n.preferenceKey)
    }

    func item(_ name: String, daysAgo: Double = 10, usedDaysAgo: Double? = nil, from: [String] = [], size: Int64 = 100) -> DownloadItem {
        DownloadItem(url: URL(fileURLWithPath: "/tmp/Downloads/\(name)"), size: size,
                     dateAdded: now.addingTimeInterval(-daysAgo * day),
                     lastUsed: usedDaysAgo.map { now.addingTimeInterval(-$0 * day) }, whereFroms: from)
    }

    func folder(of plan: PlanItem) -> String? {
        if case .move(let url) = plan.action { return url.path.replacingOccurrences(of: root.path + "/", with: "") }
        return nil
    }

    func testRegistrableDomain() {
        XCTAssertEqual(Domain.registrable(fromURL: "https://www.shop.coupang.com/x"), "coupang.com")
        XCTAssertEqual(Domain.registrable(fromURL: "https://mail.naver.co.kr/a"), "naver.co.kr")
        XCTAssertNil(Domain.registrable(fromURL: "https://192.168.0.1/file"))
        XCTAssertNil(Domain.registrable(fromURL: "not a url"))
    }

    func testSourceDomainsPreferReferrer() {
        let file = item("a.pdf", from: ["https://cdn.example-cdn.net/a.pdf", "https://www.hometax.go.kr/page"])
        XCTAssertEqual(file.sourceDomains, ["hometax.go.kr", "example-cdn.net"])
    }

    func testModeAUsesBookmarkFolderThenKind() {
        var bookmarks = BookmarkIndex()
        let chrome = #"{"roots":{"bookmark_bar":{"name":"Bookmarks bar","children":[{"name":"여행","children":[{"name":"포르투갈","children":[{"url":"https://www.visitlisboa.com/"}]}]}]}}}"#
        bookmarks.merge(chromeJSON: Data(chrome.utf8))
        let options = PlannerOptions(root: root, bookmarks: bookmarks, now: now)
        let plan = Planner.plan(.newFolders, items: [
            item("lisbon-map.pdf", from: ["https://cdn.visitlisboa.com/map.pdf"]),
            item("invoice.pdf"),
            item("photo.HEIC"),
            item("new.zip", daysAgo: 0.5),
        ], options: options)
        XCTAssertEqual(plan.map(folder), ["여행/포르투갈", "문서", "이미지", nil])
        XCTAssertEqual(plan[3].action, .keep, "fresh downloads stay")
    }

    func testModeBMatchesTargetFolderByNameOrSite() throws {
        let base = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        let taxes = base.appendingPathComponent("Taxes")
        let recipes = base.appendingPathComponent("Recipes")
        try FileManager.default.createDirectory(at: taxes, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: recipes, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: base) }
        let options = PlannerOptions(root: root, targetFolders: [taxes, recipes], now: now)
        let plan = Planner.plan(.existingFolders, items: [item("2025 taxes summary.pdf"), item("random.bin")], options: options)
        XCTAssertEqual(plan[0].action, .move(to: taxes))
        XCTAssertTrue(plan[0].needsReview, "a name match alone is only a suggestion")
        XCTAssertFalse(plan[0].checked)
        XCTAssertEqual(plan[1].action, .keep)
    }

    func testModeCBuckets() {
        let options = PlannerOptions(root: root, splitUsageByKind: false, now: now)
        let plan = Planner.plan(.usage, items: [
            item("a.pdf", usedDaysAgo: 3), item("b.pdf", usedDaysAgo: 90), item("c.pdf", usedDaysAgo: 400), item("d.pdf"),
        ], options: options)
        XCTAssertEqual(plan.map(folder), ["Active", "Occasional", "Archive", "Someday"])
    }

    func testModeDGroupsBurstsSharingASite() {
        let options = PlannerOptions(root: root, now: now)
        let site = ["https://files.visitlisboa.com/x", "https://www.visitlisboa.com/plan"]
        let plan = Planner.plan(.projects, items: [
            item("lisbon-1.pdf", daysAgo: 20, from: site),
            item("lisbon-2.pdf", daysAgo: 20 - 0.02, from: site),
            item("lisbon-3.pdf", daysAgo: 20 - 0.04, from: site),
            item("lonely.pdf", daysAgo: 40),
            // three unrelated downloads close together stay put
            item("cat.png", daysAgo: 60), item("tax.pdf", daysAgo: 60 - 0.01), item("song.mp3", daysAgo: 60 - 0.02),
        ], options: options)
        let lisbon = plan.filter { $0.item.name.hasPrefix("lisbon") }.compactMap(folder)
        XCTAssertEqual(Set(lisbon).count, 1)
        XCTAssertTrue(lisbon[0].hasPrefix("Projects/") && lisbon[0].hasSuffix("· visitlisboa.com"), lisbon[0])
        XCTAssertTrue(plan.filter { !$0.item.name.hasPrefix("lisbon") }.allSatisfy { $0.action == .keep })
    }

    func testInstallerMatching() {
        let apps = ["Figma", "Google Chrome", "Visual", "Visual Studio Code", "Go"]
        XCTAssertEqual(Checkup.installedApp(for: "Figma-124.3.1-arm64.dmg", installedApps: apps), "Figma")
        XCTAssertEqual(Checkup.installedApp(for: "googlechrome.dmg", installedApps: apps), "Google Chrome")
        XCTAssertEqual(Checkup.installedApp(for: "VisualStudioCode.dmg", installedApps: apps), "Visual Studio Code")
        XCTAssertNil(Checkup.installedApp(for: "Notion-2.3.dmg", installedApps: apps))
        XCTAssertNil(Checkup.installedApp(for: "Gopher.dmg", installedApps: ["Go"]), "names shorter than 3 are ignored")
    }

    func testCheckupFindsDuplicatesPartialAndScreenshots() throws {
        let base = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: base) }
        func file(_ name: String, _ text: String, daysAgo: Double) -> DownloadItem {
            let url = base.appendingPathComponent(name)
            try? Data(text.utf8).write(to: url)
            return DownloadItem(url: url, size: Int64(text.utf8.count), dateAdded: now.addingTimeInterval(-daysAgo * day))
        }
        let items = [
            file("report.pdf", "same", daysAgo: 5), file("report (1).pdf", "same", daysAgo: 9),
            file("other.pdf", "diff", daysAgo: 5),
            file("movie.mp4.crdownload", "x", daysAgo: 3),
            file("Screenshot 2026-09-01 at 10.00.00.png", "shot", daysAgo: 20),
        ]
        let findings = Checkup.run(items, root: root, installedApps: [], now: now)
        let byKind = Dictionary(grouping: findings, by: \.kind)
        XCTAssertEqual(byKind[.duplicates]?.map(\.plan.item.name), ["report (1).pdf"], "the ' (1)' copy goes, even though it is older")
        XCTAssertEqual(byKind[.partial]?.count, 1)
        XCTAssertEqual(byKind[.screenshots]?.first?.plan.checked, false)
    }

    func testCancelledDuplicateScanProducesNoDeletionCandidates() async throws {
        let base = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: base) }
        let files = try ["original.bin", "copy.bin"].map { name in
            let url = base.appendingPathComponent(name)
            try Data(repeating: 42, count: 2 * 1024 * 1024).write(to: url)
            return DownloadItem(url: url, size: 2 * 1024 * 1024, dateAdded: now)
        }
        XCTAssertEqual(Checkup.duplicates(files).count, 1)
        let result = await Task.detached {
            withUnsafeCurrentTask { $0?.cancel() }
            return (Checkup.hash(files[0].url), Checkup.duplicates(files).count)
        }.value
        XCTAssertNil(result.0)
        XCTAssertEqual(result.1, 0)
    }

    func testUnreadableFilesAreNotReportedAsDuplicates() {
        let base = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        let files = ["missing.bin", "also-missing.bin"].map {
            DownloadItem(url: base.appendingPathComponent($0), size: 128, dateAdded: now)
        }
        XCTAssertTrue(Checkup.duplicates(files).isEmpty)
    }

    func testApplyAndUndoRoundTrip() throws {
        let base = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        let downloads = base.appendingPathComponent("Downloads")
        let tidy = base.appendingPathComponent("Tidymark")
        try FileManager.default.createDirectory(at: downloads, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: base) }
        let a = downloads.appendingPathComponent("a.pdf"), b = downloads.appendingPathComponent("b.pdf")
        try Data("a".utf8).write(to: a)
        try Data("b".utf8).write(to: b)
        // A file with the same name already sits in the destination: it must not be overwritten.
        try FileManager.default.createDirectory(at: tidy.appendingPathComponent("문서"), withIntermediateDirectories: true)
        try Data("old".utf8).write(to: tidy.appendingPathComponent("문서/a.pdf"))

        let plan = [a, b].map { PlanItem(item: DownloadItem(url: $0, dateAdded: now), action: .move(to: tidy.appendingPathComponent("문서/2026")), reason: "") }
        let result = Executor.apply(plan)
        XCTAssertTrue(result.failures.isEmpty)
        XCTAssertEqual(result.record.count, 2)
        XCTAssertTrue(FileManager.default.fileExists(atPath: tidy.appendingPathComponent("문서/2026/a.pdf").path))
        XCTAssertFalse(FileManager.default.fileExists(atPath: a.path))

        XCTAssertTrue(Executor.undo(result.record).isEmpty)
        XCTAssertEqual(try String(contentsOf: a, encoding: .utf8), "a")
        XCTAssertEqual(try String(contentsOf: b, encoding: .utf8), "b")
        XCTAssertFalse(FileManager.default.fileExists(atPath: tidy.appendingPathComponent("문서/2026").path), "created folder removed")
        XCTAssertEqual(try String(contentsOf: tidy.appendingPathComponent("문서/a.pdf"), encoding: .utf8), "old", "pre-existing file untouched")
    }

    func testUniqueURLNeverOverwrites() throws {
        let base = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: base) }
        try Data().write(to: base.appendingPathComponent("x.pdf"))
        try Data().write(to: base.appendingPathComponent("x 2.pdf"))
        XCTAssertEqual(Executor.uniqueURL(base.appendingPathComponent("x.pdf")).lastPathComponent, "x 3.pdf")
    }

    func testEnglishLabels() {
        UserDefaults.standard.set("en", forKey: L10n.preferenceKey)
        defer { UserDefaults.standard.set("ko", forKey: L10n.preferenceKey) }
        XCTAssertEqual(FileCategory.documents.folderName, "Documents")
        XCTAssertEqual(L("‘{0}’이(가) 이미 설치돼 있어요", "Figma"), "‘Figma’ is already installed")
    }
}

final class UndoStoreTests: XCTestCase {
    var original: URL!

    override func setUp() {
        original = UndoStore.directory
        UndoStore.directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    }

    override func tearDown() {
        try? FileManager.default.removeItem(at: UndoStore.directory)
        UndoStore.directory = original
    }

    func record(_ name: String) -> UndoRecord {
        var record = UndoRecord()
        record.moves = [.init(from: URL(fileURLWithPath: "/tmp/\(name)"), to: URL(fileURLWithPath: "/tmp/x/\(name)"), trashed: true)]
        return record
    }

    func testReplacingOrClearingKeepsEarlierRecordsInHistory() {
        UndoStore.save(record("first"))
        UndoStore.save(record("second"))
        UndoStore.save(nil)
        XCTAssertNil(UndoStore.load())
        let archived = UndoStore.history().compactMap { try? JSONDecoder().decode(UndoRecord.self, from: Data(contentsOf: $0)) }
        XCTAssertEqual(Set(archived.map { $0.moves[0].from.lastPathComponent }), ["first", "second"])
    }

    func testHistoryIsCapped() {
        for index in 0..<(UndoStore.historyLimit + 5) {
            UndoStore.save(record("r\(index)"))
            usleep(2_000)
        }
        XCTAssertEqual(UndoStore.history().count, UndoStore.historyLimit)
    }
}
