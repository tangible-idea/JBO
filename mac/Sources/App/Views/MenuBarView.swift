import SwiftUI
import TidyCore

/// The window that drops down from the menu bar icon.
struct MenuBarView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        let _ = model.languageRevision
        VStack(alignment: .leading, spacing: 14) {
            header
            if !model.onboarded {
                Text(L("처음 한 번 설정이 필요해요."))
                    .font(.callout)
                Button(L("시작하기")) { StudioOpener.open() }
                    .buttonStyle(.primary)
            } else if model.accessDenied {
                AccessDeniedBanner()
            } else {
                checkupSummary
                if !model.suggestions.isEmpty { suggestions }
            }
            if let status = model.status {
                Text(status.text)
                    .font(.caption)
                    .foregroundStyle(status.isError ? Theme.danger : Theme.muted)
                    .lineLimit(3)
            }
            Divider()
            footer
        }
        .padding(16)
        .frame(width: 360)
        .onAppear {
            StudioOpener.openWindow = openWindow
            if model.onboarded { model.refresh() }
        }
    }

    private var header: some View {
        HStack(spacing: 10) {
            Image("MenuBarIcon").renderingMode(.template).foregroundStyle(Theme.ink)
            VStack(alignment: .leading, spacing: 2) {
                Text("Tidymark").font(.headline)
                Text(model.onboarded && !model.accessDenied
                     ? L("Downloads · 파일 {0}개 · {1}", model.items.count, formatBytes(model.totalSize))
                     : "Downloads")
                    .font(.caption)
                    .foregroundStyle(Theme.muted)
            }
            Spacer()
            if model.isScanning { ProgressView().controlSize(.small) }
        }
    }

    private var checkupSummary: some View {
        let count = model.findings.count
        let bytes = model.findings.filter { $0.plan.action == .trash }.reduce(Int64(0)) { $0 + $1.plan.item.size }
        return VStack(alignment: .leading, spacing: 8) {
            if count == 0 {
                Label(L("치울 것이 없어요."), systemImage: "checkmark.circle")
                    .foregroundStyle(Theme.muted)
            } else {
                Label(L("치울 수 있는 것 {0}개 · {1} 확보", count, formatBytes(bytes)), systemImage: "sparkles")
                    .font(.callout.weight(.semibold))
            }
            HStack {
                Button(L("정리 스튜디오 열기")) { StudioOpener.open() }
                    .buttonStyle(.primary)
                Button(L("새로고침")) { model.refresh() }
            }
        }
    }

    private var suggestions: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(L("방금 받은 파일")).font(.caption.weight(.semibold)).foregroundStyle(Theme.muted)
            ForEach(model.suggestions.prefix(4)) { suggestion in
                HStack(spacing: 8) {
                    FileIcon(url: suggestion.item.url)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(suggestion.item.name).lineLimit(1).truncationMode(.middle)
                        Text("→ " + suggestion.destinationLabel(root: model.rootURL))
                            .font(.caption).foregroundStyle(Theme.muted).lineLimit(1)
                    }
                    Spacer()
                    Button(L("옮기기")) { model.acceptSuggestion(path: suggestion.item.url.path) }
                        .controlSize(.small)
                    Button {
                        model.dismissSuggestion(path: suggestion.item.url.path)
                    } label: { Image(systemName: "xmark") }
                        .buttonStyle(.borderless)
                        .help(L("그대로 두기"))
                }
            }
        }
    }

    private var footer: some View {
        @Bindable var model = model
        return HStack {
            Toggle(L("새 다운로드 감시"), isOn: $model.watchEnabled)
                .toggleStyle(.switch)
                .controlSize(.mini)
                .disabled(!model.onboarded)
            Spacer()
            if let undo = model.lastUndo {
                Button(L("되돌리기")) { model.undo() }
                    .help(undo.summary)
            }
            Button(L("종료")) { NSApp.terminate(nil) }
        }
        .font(.callout)
    }
}

struct AccessDeniedBanner: View {
    @Environment(AppModel.self) private var model
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(L("Downloads 폴더에 접근할 수 없어요."), systemImage: "lock")
                .font(.callout.weight(.semibold))
            Text(L("시스템 설정 › 개인정보 보호 및 보안 › 파일 및 폴더에서 Tidymark의 ‘다운로드 폴더’를 켜 주세요."))
                .font(.caption)
                .foregroundStyle(Theme.muted)
                .fixedSize(horizontal: false, vertical: true)
            HStack {
                Button(L("시스템 설정 열기")) { model.openPrivacySettings() }
                Button(L("다시 확인")) { model.refresh() }
            }
        }
        .padding(12)
        .background(Theme.amber.opacity(0.25), in: RoundedRectangle(cornerRadius: 10))
    }
}
