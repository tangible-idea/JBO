import Foundation

/// Korean is the source language, as in the Tidymark extension: strings stay in
/// Korean in code and act as keys into the English table.
public enum Language: String, CaseIterable, Sendable {
    case system, ko, en
}

public enum L10n {
    public static let preferenceKey = "uiLanguage"
    /// English strings registered by the app target for its own UI.
    nonisolated(unsafe) public static var appStrings: [String: String] = [:]

    public static var isEnglish: Bool {
        switch Language(rawValue: UserDefaults.standard.string(forKey: preferenceKey) ?? "") ?? .system {
        case .ko: return false
        case .en: return true
        case .system: return !(Locale.preferredLanguages.first ?? "ko").hasPrefix("ko")
        }
    }
}

/// `L("‘{0}’로 옮겨요", name)`: positional placeholders.
public func L(_ source: String, _ args: CustomStringConvertible...) -> String {
    var text = L10n.isEnglish ? (english[source] ?? L10n.appStrings[source] ?? source) : source
    for (index, arg) in args.enumerated() {
        text = text.replacingOccurrences(of: "{\(index)}", with: arg.description)
    }
    return text
}

private let english: [String: String] = [
    // categories
    "문서": "Documents", "스프레드시트": "Spreadsheets", "프레젠테이션": "Presentations", "이미지": "Images",
    "동영상": "Videos", "오디오": "Audio", "압축 파일": "Archives", "설치 파일": "Installers", "코드": "Code",
    "폰트": "Fonts", "폴더": "Folders", "기타": "Other", "스크린샷": "Screenshots",
    // reasons
    "‘{0}’ 파일이라서": "It's a {0} file",
    "북마크 ‘{0}’와 같은 사이트({1})": "Same site ({1}) as your bookmark folder ‘{0}’",
    "같은 사이트({0})에서 받은 파일이 이미 있어요": "Files from the same site ({0}) are already there",
    "폴더 이름 ‘{0}’과 겹쳐요": "Matches the folder name ‘{0}’",
    "맞는 폴더를 찾지 못했어요": "No matching folder",
    "최근 {0}일 안에 받은 파일": "Downloaded in the last {0} days",
    "최근 {0}일 안에 연 것": "Opened in the last {0} days",
    "{0}~{1}일 전에 연 것": "Opened {0}–{1} days ago",
    "받기만 하고 한 번도 안 연 것": "Downloaded but never opened",
    "{0}일 넘게 안 연 것": "Not opened in {0}+ days",
    "{0} 동안 {1}개를 몰아서 받았어요": "{1} files downloaded within {0}",
    "‘{0}’이(가) 이미 설치돼 있어요": "‘{0}’ is already installed",
    "받다 만 파일이에요": "Unfinished download",
    "‘{0}’과 내용이 같아요": "Same content as ‘{0}’",
    "{0}, {1}일 넘게 안 열었어요": "{0}, not opened in {1}+ days",
    "{0}일 지난 스크린샷": "Screenshot older than {0} days",
    // plan labels
    "휴지통": "Trash", "그대로 두기": "Leave in Downloads", "묶음": "Batch",
    // execution
    "‘{0}’을(를) 옮기지 못했어요: {1}": "Couldn't move ‘{0}’: {1}",
    "파일 {0}개를 정리했어요.": "Organized {0} files.",
    "파일 {0}개를 되돌렸어요.": "Restored {0} files.",
]
