import SwiftUI
import TidyCore

struct SettingsView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        Form {
            Section(L("정리 폴더")) {
                LabeledContent(L("새 폴더를 만들 곳")) {
                    HStack {
                        Text(model.rootURL.path.replacingOccurrences(of: NSHomeDirectory(), with: "~"))
                            .lineLimit(1).truncationMode(.middle)
                        Button(L("변경…")) { chooseRoot() }
                    }
                }
                Text(L("A·C·D 방식과 스크린샷 정리는 이 폴더 안에만 폴더를 만들어요."))
                    .font(.caption).foregroundStyle(Theme.muted)
            }
            Section(L("B · 기존 폴더로")) {
                TargetFoldersEditor()
            }
            Section(L("정리 규칙")) {
                Stepper(L("최근 {0}일 안에 받은 파일은 건드리지 않기", model.graceDays), value: $model.graceDays, in: 0...30)
                Toggle(L("Chrome 북마크 폴더 참고하기"), isOn: $model.useBookmarks)
                Text(L("받은 파일의 사이트가 북마크의 ‘여행 / 포르투갈’ 폴더에 있으면 같은 이름의 폴더를 제안해요. 북마크는 이 Mac 안에서만 읽어요."))
                    .font(.caption).foregroundStyle(Theme.muted)
            }
            Section(L("새 다운로드")) {
                Toggle(L("Downloads 폴더 감시"), isOn: $model.watchEnabled)
                Toggle(L("받은 파일마다 옮길 곳 알림"), isOn: $model.notifyEnabled)
                    .disabled(!model.watchEnabled)
                Toggle(L("로그인할 때 실행"), isOn: Binding(get: { model.launchAtLogin }, set: { model.launchAtLogin = $0 }))
            }
            Section(L("언어")) {
                Picker(L("언어"), selection: $model.language) {
                    Text(L("시스템 언어")).tag(Language.system)
                    Text("한국어").tag(Language.ko)
                    Text("English").tag(Language.en)
                }
                .pickerStyle(.segmented)
            }
            Section(L("개인정보")) {
                Text(L("파일 내용은 읽지 않아요. 파일 이름, 종류, 받은 날짜, 마지막으로 연 날짜, 받은 사이트 주소만 이 Mac 안에서 사용하고, 어디로도 보내지 않아요."))
                    .font(.callout)
                Button(L("파일 접근 권한 설정 열기")) { model.openPrivacySettings() }
            }
        }
        .formStyle(.grouped)
        .scrollContentBackground(.hidden)
    }

    private func chooseRoot() {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.canCreateDirectories = true
        panel.directoryURL = model.rootURL.deletingLastPathComponent()
        panel.prompt = L("선택")
        if panel.runModal() == .OK, let url = panel.url { model.rootURL = url }
    }
}

/// First launch: say what the app needs before macOS shows its own prompt.
struct OnboardingView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            HStack(spacing: 14) {
                Image(nsImage: NSApp.applicationIconImage).resizable().frame(width: 64, height: 64)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Tidymark for Mac").font(.system(size: 30, weight: .heavy))
                    Text(L("받아 둔 파일도 제자리를 찾아요")).font(.title3).foregroundStyle(Theme.muted)
                }
            }
            VStack(alignment: .leading, spacing: 14) {
                step("1", L("Downloads 폴더를 읽어요"), L("다음 단계에서 macOS가 ‘다운로드 폴더 접근’을 물어보면 허용을 눌러 주세요. 파일 내용은 읽지 않고, 어디로도 보내지 않아요."))
                step("2", L("정리 폴더를 정해요"), L("새 폴더는 {0} 안에만 만들어요. 설정에서 바꿀 수 있어요.", model.rootURL.path.replacingOccurrences(of: NSHomeDirectory(), with: "~")))
                step("3", L("적용하기 전엔 아무것도 바뀌지 않아요"), L("항상 이동 예정표를 먼저 보여 주고, 지운 파일은 휴지통으로 보내고, 되돌릴 수 있어요."))
            }
            Button {
                model.onboarded = true
                model.start()
            } label: {
                Text(L("Downloads 접근 허용하고 시작하기")).padding(.horizontal, 10).padding(.vertical, 4)
            }
            .buttonStyle(.primaryLarge)
            Spacer()
        }
        .padding(40)
        .frame(maxWidth: 640, alignment: .leading)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func step(_ number: String, _ title: String, _ detail: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Text(number)
                .font(.system(size: 14, weight: .heavy, design: .monospaced))
                .frame(width: 28, height: 28)
                .background(Theme.lime, in: Circle())
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.headline)
                Text(detail).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}
