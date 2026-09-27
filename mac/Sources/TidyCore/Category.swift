import Foundation

/// What kind of file this is, from its extension alone.
public enum FileCategory: String, CaseIterable, Sendable {
    case documents, spreadsheets, presentations, images, videos, audio, archives, installers, code, fonts, folders, other

    public var folderName: String {
        switch self {
        case .documents: return L("문서")
        case .spreadsheets: return L("스프레드시트")
        case .presentations: return L("프레젠테이션")
        case .images: return L("이미지")
        case .videos: return L("동영상")
        case .audio: return L("오디오")
        case .archives: return L("압축 파일")
        case .installers: return L("설치 파일")
        case .code: return L("코드")
        case .fonts: return L("폰트")
        case .folders: return L("폴더")
        case .other: return L("기타")
        }
    }

    private static let byExtension: [String: FileCategory] = {
        var map: [String: FileCategory] = [:]
        let groups: [(FileCategory, [String])] = [
            (.documents, ["pdf", "doc", "docx", "txt", "rtf", "pages", "md", "hwp", "hwpx", "odt", "epub"]),
            (.spreadsheets, ["xls", "xlsx", "csv", "tsv", "numbers", "ods"]),
            (.presentations, ["ppt", "pptx", "key", "odp"]),
            (.images, ["jpg", "jpeg", "png", "gif", "heic", "webp", "svg", "tif", "tiff", "bmp", "raw", "psd", "ai", "fig", "sketch"]),
            (.videos, ["mp4", "mov", "avi", "mkv", "webm", "m4v"]),
            (.audio, ["mp3", "wav", "m4a", "aac", "flac", "ogg", "aiff"]),
            (.archives, ["zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz"]),
            (.installers, ["dmg", "pkg", "mpkg", "app"]),
            (.code, ["json", "js", "ts", "py", "swift", "java", "c", "cpp", "h", "html", "css", "xml", "yml", "yaml", "sh", "ipynb", "sql"]),
            (.fonts, ["ttf", "otf", "woff", "woff2"]),
        ]
        for (category, extensions) in groups { for ext in extensions { map[ext] = category } }
        return map
    }()

    public static func of(_ item: DownloadItem) -> FileCategory {
        if item.isDirectory && !item.isPackage { return .folders }
        return byExtension[item.ext] ?? .other
    }
}
