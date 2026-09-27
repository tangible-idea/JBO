import SwiftUI
import TidyCore

/// Tidymark's palette, shared with the extension and the website.
enum Theme {
    static let paper = Color(red: 0.953, green: 0.941, blue: 0.906)
    static let card = Color(red: 1.0, green: 0.992, blue: 0.969)
    static let ink = Color(red: 0.094, green: 0.094, blue: 0.102)
    static let muted = Color(red: 0.361, green: 0.345, blue: 0.314)
    static let line = Color(red: 0.863, green: 0.843, blue: 0.788)
    static let lime = Color(red: 0.784, green: 0.949, blue: 0.353)
    static let sky = Color(red: 0.663, green: 0.847, blue: 1.0)
    static let amber = Color(red: 0.961, green: 0.769, blue: 0.318)
    static let violet = Color(red: 0.796, green: 0.714, blue: 1.0)
    static let danger = Color(red: 0.706, green: 0.137, blue: 0.094)

    static func accent(_ mode: OrganizeMode) -> Color {
        switch mode {
        case .newFolders: return lime
        case .existingFolders: return sky
        case .usage: return amber
        case .projects: return violet
        }
    }
}

extension OrganizeMode {
    var title: String {
        switch self {
        case .newFolders: return L("새 폴더로")
        case .existingFolders: return L("기존 폴더로")
        case .usage: return L("쓰임새로")
        case .projects: return L("프로젝트로")
        }
    }

    var summary: String {
        switch self {
        case .newFolders: return L("종류별로, 또는 북마크해 둔 사이트의 폴더 이름으로 새 폴더를 만들어 나눠 담아요.")
        case .existingFolders: return L("이미 쓰는 폴더는 그대로. 같은 사이트나 이름이 맞는 폴더로 넣어요.")
        case .usage: return L("마지막으로 연 날짜로 Active · Occasional · Someday · Archive로 나눠요.")
        case .projects: return L("몇 시간 안에 몰아서 받은 파일을 날짜와 사이트 이름의 폴더로 묶어요.")
        }
    }
}

extension CheckupKind {
    var title: String {
        switch self {
        case .installers: return L("이미 설치한 앱의 설치 파일")
        case .partial: return L("받다 만 파일")
        case .duplicates: return L("중복 파일")
        case .largeOld: return L("오래 안 연 큰 파일")
        case .screenshots: return L("오래된 스크린샷")
        }
    }

    var symbol: String {
        switch self {
        case .installers: return "shippingbox"
        case .partial: return "arrow.down.circle.dotted"
        case .duplicates: return "doc.on.doc"
        case .largeOld: return "externaldrive"
        case .screenshots: return "camera.viewfinder"
        }
    }
}

struct Pill: View {
    let text: String
    var color: Color = Theme.line
    var body: some View {
        Text(text)
            .font(.system(size: 11, weight: .semibold))
            .padding(.horizontal, 7)
            .padding(.vertical, 2)
            .background(color, in: Capsule())
            .foregroundStyle(Theme.ink)
    }
}

struct FileIcon: View {
    let url: URL
    var size: CGFloat = 20
    var body: some View {
        Image(nsImage: NSWorkspace.shared.icon(forFile: url.path))
            .resizable()
            .frame(width: size, height: size)
    }
}

func formatBytes(_ bytes: Int64) -> String {
    ByteCountFormatter.string(fromByteCount: bytes, countStyle: .file)
}

/// Ink pill button that reads the same whether or not the window is focused
/// (the system prominent style fades to near-invisible in inactive windows).
struct PrimaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled
    var large = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: large ? 14 : 13, weight: .semibold))
            .foregroundStyle(Theme.paper)
            .padding(.horizontal, large ? 16 : 12)
            .padding(.vertical, large ? 9 : 6)
            .background(Theme.ink.opacity(isEnabled ? (configuration.isPressed ? 0.8 : 1) : 0.35), in: RoundedRectangle(cornerRadius: 8))
    }
}

extension ButtonStyle where Self == PrimaryButtonStyle {
    static var primary: PrimaryButtonStyle { PrimaryButtonStyle() }
    static var primaryLarge: PrimaryButtonStyle { PrimaryButtonStyle(large: true) }
}
