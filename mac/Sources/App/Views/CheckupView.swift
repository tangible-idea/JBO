import SwiftUI
import TidyCore

struct CheckupView: View {
    @Environment(AppModel.self) private var model
    @State private var confirming = false

    /// Looks rows up by id: findings are replaced after an apply, and an index
    /// binding would read past the end while the old rows are still drawn.
    private func findingBinding(_ id: UUID) -> Binding<PlanItem>? {
        guard let current = model.findings.first(where: { $0.id == id })?.plan else { return nil }
        return Binding(
            get: { model.findings.first(where: { $0.id == id })?.plan ?? current },
            set: { newValue in
                if let index = model.findings.firstIndex(where: { $0.id == id }) { model.findings[index].plan = newValue }
            }
        )
    }

    var body: some View {
        @Bindable var model = model
        let selected = model.findings.filter(\.plan.checked)
        let freed = selected.filter { $0.plan.action == .trash }.reduce(Int64(0)) { $0 + $1.plan.item.size }
        let applyTitle = freed > 0
            ? L("{0}개 처리하기 · {1} 확보", selected.count, formatBytes(freed))
            : L("{0}개 처리하기", selected.count)
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(L("Downloads 폴더 정리")).font(.system(size: 28, weight: .heavy))
                    Text(L("옮기는 대신 지우거나 치울 만한 것을 찾아요. 지운 파일은 휴지통으로 가고, 되돌릴 수 있어요."))
                        .foregroundStyle(Theme.muted)
                }
                HStack(spacing: 12) {
                    ForEach(CheckupKind.allCases) { kind in
                        let found = model.findings.filter { $0.kind == kind }
                        VStack(alignment: .leading, spacing: 6) {
                            Image(systemName: kind.symbol).foregroundStyle(Theme.muted)
                            Text("\(found.count)").font(.system(size: 30, weight: .heavy, design: .rounded))
                            Text(kind.title).font(.callout.weight(.semibold)).fixedSize(horizontal: false, vertical: true)
                            Text(formatBytes(found.reduce(0) { $0 + $1.plan.item.size }))
                                .font(.caption).foregroundStyle(Theme.muted)
                        }
                        .padding(14)
                        .frame(maxWidth: .infinity, minHeight: 130, alignment: .topLeading)
                        .background(found.isEmpty ? Theme.card : Theme.amber.opacity(0.22), in: RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(found.isEmpty ? Theme.line : Theme.amber))
                    }
                }
                HStack {
                    Text(L("{0}개 선택 · {1} 확보", selected.count, formatBytes(freed))).font(.headline)
                    Spacer()
                    Button(applyTitle) { confirming = true }
                        .buttonStyle(.primary)
                        .disabled(selected.isEmpty || model.isScanning || model.isChecking)
                }
                if model.isScanning || model.isChecking {
                    ProgressView().controlSize(.small)
                } else if model.findings.isEmpty {
                    Label(L("치울 것이 없어요."), systemImage: "checkmark.circle").foregroundStyle(Theme.muted)
                }
                ForEach(CheckupKind.allCases) { kind in
                    let ids = model.findings.filter { $0.kind == kind }.map(\.id)
                    if !ids.isEmpty {
                        VStack(alignment: .leading, spacing: 0) {
                            HStack {
                                Label(kind.title, systemImage: kind.symbol).font(.headline)
                                Pill(text: "\(ids.count)")
                                Spacer()
                            }
                            .padding(12)
                            Divider()
                            ForEach(ids, id: \.self) { id in
                                if let row = findingBinding(id) {
                                    PlanRow(item: row)
                                    if id != ids.last { Divider().padding(.leading, 46) }
                                }
                            }
                        }
                        .background(Theme.card, in: RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.line))
                    }
                }
            }
            .padding(24)
        }
        .confirmationDialog(L("{0}개를 처리할까요?", selected.count), isPresented: $confirming) {
            Button(applyTitle) { model.applyCheckup() }
        } message: {
            Text(L("휴지통으로 보낸 파일도 ‘되돌리기’로 원래 자리에 돌려놓을 수 있어요."))
        }
    }
}
