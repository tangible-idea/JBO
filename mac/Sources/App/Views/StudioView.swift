import SwiftUI
import TidyCore

enum StudioTab: String, CaseIterable, Identifiable {
    case organize, checkup, settings
    var id: String { rawValue }
    var title: String {
        switch self {
        case .organize: return L("정리하기")
        case .checkup: return L("점검")
        case .settings: return L("설정")
        }
    }
}

struct StudioView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        let _ = model.languageRevision
        @Bindable var model = model
        VStack(spacing: 0) {
            if model.onboarded {
                topBar
                Divider()
                if model.accessDenied {
                    AccessDeniedBanner().padding(20)
                    Spacer()
                } else {
                    switch model.studioTab {
                    case .organize: OrganizeView()
                    case .checkup: CheckupView()
                    case .settings: SettingsView()
                    }
                }
            } else {
                OnboardingView()
            }
        }
        .background(Theme.paper)
        .onAppear { StudioOpener.openWindow = openWindow }
    }

    private var topBar: some View {
        HStack(spacing: 16) {
            Picker("", selection: Bindable(model).studioTab) {
                ForEach(StudioTab.allCases) { Text($0.title).tag($0) }
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            .frame(width: 300)
            Spacer()
            if let status = model.status {
                Text(status.text)
                    .font(.callout)
                    .foregroundStyle(status.isError ? Theme.danger : Theme.muted)
                    .lineLimit(1)
            }
            if let undo = model.lastUndo {
                Button {
                    model.undo()
                } label: {
                    Label(L("되돌리기"), systemImage: "arrow.uturn.backward")
                }
                .help(undo.summary)
            }
            Button {
                model.refresh()
            } label: {
                Label(L("새로고침"), systemImage: "arrow.clockwise")
            }
            .disabled(model.isScanning)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
    }
}

// MARK: - Organize

struct OrganizeView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(L("Downloads, 어떻게 정리할까요?"))
                        .font(.system(size: 28, weight: .heavy))
                    Text(L("파일 {0}개 · {1}. 적용하기 전까지는 아무것도 바뀌지 않아요.", model.items.count, formatBytes(model.totalSize)))
                        .foregroundStyle(Theme.muted)
                }
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 16), GridItem(.flexible(), spacing: 16)], spacing: 16) {
                    ForEach(OrganizeMode.allCases) { mode in ModeCard(mode: mode, selected: model.mode == mode) { model.mode = mode } }
                }
                modeOptions
                HStack {
                    Button {
                        model.analyze()
                    } label: {
                        Label(L("예정표 만들기"), systemImage: "sparkles").padding(.horizontal, 6)
                    }
                    .buttonStyle(.primaryLarge)
                    .disabled(model.isAnalyzing || model.items.isEmpty || (model.mode == .existingFolders && model.targetFolders.isEmpty))
                    Text(L("최근 {0}일 안에 받은 파일은 그대로 둬요.", model.graceDays))
                        .font(.callout)
                        .foregroundStyle(Theme.muted)
                }
                if model.isAnalyzing { ProgressView().controlSize(.small) }
                if model.planMode != nil {
                    PlanList(items: $model.plan, root: model.rootURL,
                             applyTitle: { L("{0}개 옮기기", $0) }) { model.applyPlan() }
                        .disabled(model.isAnalyzing)
                }
            }
            .padding(24)
        }
    }

    @ViewBuilder private var modeOptions: some View {
        @Bindable var model = model
        switch model.mode {
        case .existingFolders:
            TargetFoldersEditor()
        case .usage:
            Toggle(L("구간 안에서 종류별로 한 번 더 나누기"), isOn: $model.splitUsageByKind)
        case .newFolders, .projects:
            HStack(spacing: 6) {
                Image(systemName: "folder")
                Text(L("만들 위치: {0}", model.rootURL.path.replacingOccurrences(of: NSHomeDirectory(), with: "~")))
                if model.mode == .newFolders && model.useBookmarks {
                    Pill(text: L("Chrome 북마크 참고"), color: Theme.lime)
                }
            }
            .font(.callout)
            .foregroundStyle(Theme.muted)
        }
    }
}

struct ModeCard: View {
    let mode: OrganizeMode
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(mode.letter)
                        .font(.system(size: 13, weight: .heavy, design: .monospaced))
                        .frame(width: 26, height: 22)
                        .background(Theme.accent(mode), in: RoundedRectangle(cornerRadius: 6))
                    Text(mode.title).font(.system(size: 18, weight: .bold))
                    Spacer()
                    if selected { Image(systemName: "checkmark.circle.fill").foregroundStyle(Theme.ink) }
                }
                Text(mode.summary)
                    .font(.callout)
                    .foregroundStyle(Theme.muted)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .topLeading)
            .background(selected ? Theme.accent(mode).opacity(0.22) : Theme.card, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(selected ? Theme.ink : Theme.line, lineWidth: selected ? 1.5 : 1))
            .contentShape(RoundedRectangle(cornerRadius: 14))
        }
        .buttonStyle(.plain)
    }
}

struct TargetFoldersEditor: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(L("넣을 수 있는 폴더")).font(.headline)
            if model.targetFolders.isEmpty {
                Text(L("파일을 넣을 기존 폴더를 추가하세요. 추가한 폴더에만 접근해요."))
                    .font(.callout).foregroundStyle(Theme.muted)
            }
            ForEach(model.targetFolders, id: \.self) { folder in
                HStack {
                    FileIcon(url: folder, size: 18)
                    Text(folder.path.replacingOccurrences(of: NSHomeDirectory(), with: "~")).lineLimit(1).truncationMode(.middle)
                    Spacer()
                    Button {
                        model.targetFolders.removeAll { $0 == folder }
                    } label: { Image(systemName: "minus.circle") }
                        .buttonStyle(.borderless)
                }
            }
            Button {
                let panel = NSOpenPanel()
                panel.canChooseDirectories = true
                panel.canChooseFiles = false
                panel.allowsMultipleSelection = true
                panel.prompt = L("추가")
                if panel.runModal() == .OK {
                    model.targetFolders += panel.urls.filter { !model.targetFolders.contains($0) }
                }
            } label: {
                Label(L("폴더 추가…"), systemImage: "plus")
            }
        }
        .padding(14)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.line))
    }
}

// MARK: - Plan list (shared by Organize and Checkup)

struct PlanList: View {
    @Binding var items: [PlanItem]
    let root: URL
    let applyTitle: (Int) -> String
    let onApply: () -> Void
    @State private var confirming = false

    private var groups: [(label: String, ids: [UUID])] {
        var order: [String] = []
        var byLabel: [String: [UUID]] = [:]
        for item in items {
            let label = item.destinationLabel(root: root)
            if byLabel[label] == nil { order.append(label) }
            byLabel[label, default: []].append(item.id)
        }
        // Moves first, then Trash, then what stays.
        let keep = L("그대로 두기"), trash = L("휴지통")
        let sorted = order.filter { $0 != keep && $0 != trash } + order.filter { $0 == trash } + order.filter { $0 == keep }
        return sorted.map { ($0, byLabel[$0]!) }
    }

    var body: some View {
        let checked = items.filter(\.checked).count
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text(L("이동 예정표")).font(.title3.weight(.bold))
                Pill(text: L("{0}개 선택", checked))
                Spacer()
                Button(applyTitle(checked)) { confirming = true }
                    .buttonStyle(.primary)
                    .disabled(checked == 0)
            }
            if items.isEmpty {
                Text(L("정리할 파일이 없어요.")).foregroundStyle(Theme.muted)
            }
            ForEach(groups, id: \.label) { group in
                PlanGroup(label: group.label, ids: group.ids, items: $items)
            }
        }
        .confirmationDialog(L("{0}개를 적용할까요?", checked), isPresented: $confirming) {
            Button(applyTitle(checked), action: onApply)
        } message: {
            Text(L("휴지통으로 보낸 파일도 ‘되돌리기’로 원래 자리에 돌려놓을 수 있어요."))
        }
    }
}

struct PlanGroup: View {
    let label: String
    let ids: [UUID]
    @Binding var items: [PlanItem]
    @State private var expanded = true

    var body: some View {
        let movable = items.filter { ids.contains($0.id) && $0.action != .keep }.map(\.id)
        let allChecked = !movable.isEmpty && items.filter { movable.contains($0.id) }.allSatisfy(\.checked)
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 10) {
                if !movable.isEmpty {
                    Toggle("", isOn: Binding(get: { allChecked }, set: { value in
                        for index in items.indices where movable.contains(items[index].id) { items[index].checked = value }
                    }))
                        .labelsHidden()
                }
                Image(systemName: label == L("휴지통") ? "trash" : label == L("그대로 두기") ? "tray" : "folder.fill")
                    .foregroundStyle(label == L("휴지통") ? Theme.danger : Theme.muted)
                Text(label).font(.headline).lineLimit(1).truncationMode(.middle)
                Pill(text: "\(ids.count)")
                Spacer()
                Button { expanded.toggle() } label: { Image(systemName: expanded ? "chevron.up" : "chevron.down") }
                    .buttonStyle(.borderless)
            }
            .padding(12)
            if expanded {
                Divider()
                ForEach(ids, id: \.self) { id in
                    if let row = $items.element(id) {
                        PlanRow(item: row)
                        if id != ids.last { Divider().padding(.leading, 46) }
                    }
                }
            }
        }
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.line))
    }
}

struct PlanRow: View {
    @Binding var item: PlanItem

    var body: some View {
        HStack(spacing: 10) {
            Toggle("", isOn: $item.checked)
                .labelsHidden()
                .disabled(item.action == .keep)
                .opacity(item.action == .keep ? 0 : 1)
            FileIcon(url: item.item.url)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(item.item.name).lineLimit(1).truncationMode(.middle)
                    if item.needsReview { Pill(text: L("검토 필요"), color: Theme.amber) }
                }
                Text([item.reason, item.item.primaryDomain].compactMap { $0 }.joined(separator: " · "))
                    .font(.caption).foregroundStyle(Theme.muted).lineLimit(1)
            }
            Spacer()
            Text(formatBytes(item.item.size)).font(.caption.monospacedDigit()).foregroundStyle(Theme.muted)
            Button {
                NSWorkspace.shared.activateFileViewerSelecting([item.item.url])
            } label: { Image(systemName: "magnifyingglass") }
                .buttonStyle(.borderless)
                .help(L("Finder에서 보기"))
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }
}

extension Binding where Value == [PlanItem] {
    /// Binds one element by id rather than index. After an apply the array is
    /// replaced while rows are still on screen; an index binding would then read
    /// past the end and crash, while this one simply stops finding the row.
    func element(_ id: UUID) -> Binding<PlanItem>? {
        guard let current = wrappedValue.first(where: { $0.id == id }) else { return nil }
        return Binding<PlanItem>(
            get: { wrappedValue.first(where: { $0.id == id }) ?? current },
            set: { newValue in
                if let index = wrappedValue.firstIndex(where: { $0.id == id }) { wrappedValue[index] = newValue }
            }
        )
    }
}
