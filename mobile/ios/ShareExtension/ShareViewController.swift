import UIKit

final class ShareViewController: UIViewController, UIPickerViewDataSource, UIPickerViewDelegate {
    private let group = "group.net.tangibleidea.mobile"
    private var endpoint = ""
    private var token = ""
    private var sharedURL = ""
    private var folders: [[String: String]] = []
    private let titleLabel = UILabel()
    private let statusLabel = UILabel()
    private let picker = UIPickerView()
    private let saveButton = UIButton(type: .system)

    override func viewDidLoad() {
        super.viewDidLoad()
        preferredContentSize = CGSize(width: 360, height: 340)
        view.backgroundColor = .systemBackground
        titleLabel.font = .preferredFont(forTextStyle: .headline)
        titleLabel.text = "Tidymark에 저장"
        statusLabel.numberOfLines = 3
        statusLabel.textColor = .secondaryLabel
        statusLabel.text = "공유한 링크를 읽는 중…"
        picker.dataSource = self
        picker.delegate = self
        picker.heightAnchor.constraint(equalToConstant: 140).isActive = true
        saveButton.setTitle("이 폴더에 저장", for: .normal)
        saveButton.titleLabel?.font = .preferredFont(forTextStyle: .headline)
        saveButton.isEnabled = false
        saveButton.addTarget(self, action: #selector(save), for: .touchUpInside)
        let stack = UIStackView(arrangedSubviews: [titleLabel, statusLabel, picker, saveButton])
        stack.axis = .vertical
        stack.spacing = 12
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 16),
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 22),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -22),
            stack.bottomAnchor.constraint(lessThanOrEqualTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -12),
        ])
        loadSharedLink()
    }

    private func loadSharedLink() {
        let attachments = (extensionContext?.inputItems as? [NSExtensionItem])?.flatMap { $0.attachments ?? [] } ?? []
        guard let provider = attachments.first(where: { $0.hasItemConformingToTypeIdentifier("public.url") || $0.hasItemConformingToTypeIdentifier("public.text") }) else {
            statusLabel.text = "공유한 내용에 웹 주소가 없습니다."
            return
        }
        let type = provider.hasItemConformingToTypeIdentifier("public.url") ? "public.url" : "public.text"
        provider.loadItem(forTypeIdentifier: type, options: nil) { [weak self] item, _ in
            let raw = (item as? URL)?.absoluteString ?? (item as? String) ?? ""
            let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue)
            let match = detector?.firstMatch(in: raw, range: NSRange(raw.startIndex..., in: raw))
            let url = match?.url?.absoluteString ?? ""
            DispatchQueue.main.async {
                guard let self else { return }
                guard url.hasPrefix("https://") || url.hasPrefix("http://") else {
                    self.statusLabel.text = "공유한 내용에 웹 주소가 없습니다."
                    return
                }
                self.sharedURL = url
                self.statusLabel.text = url
                self.loadConnection()
            }
        }
    }

    private func loadConnection() {
        guard let defaults = UserDefaults(suiteName: group),
              let endpoint = defaults.string(forKey: "endpoint"),
              let token = defaults.string(forKey: "token"),
              !endpoint.isEmpty, !token.isEmpty else {
            statusLabel.text = "먼저 Tidymark 앱에서 맥 연결을 설정하세요."
            return
        }
        self.endpoint = endpoint.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        self.token = token
        request("/api/mobile/folders", method: "GET") { [weak self] data in
            guard let self else { return }
            let folders = data?["folders"] as? [[String: Any]] ?? []
            self.folders = folders.compactMap { item in
                guard let id = item["id"] as? String, let path = item["path"] as? String else { return nil }
                return ["id": id, "path": path]
            }
            self.picker.reloadAllComponents()
            self.saveButton.isEnabled = !self.folders.isEmpty
            if self.folders.isEmpty {
                self.statusLabel.text = "서버에 연결할 수 없거나 저장할 폴더가 없습니다."
            } else {
                self.statusLabel.text = "추천 폴더를 찾는 중…"
                self.recommend()
            }
        }
    }

    private func recommend() {
        request("/api/mobile/classify", method: "POST", body: ["page": ["url": sharedURL]]) { [weak self] data in
            guard let self else { return }
            let recommendation = data?["recommendation"] as? [String: Any]
            let id = recommendation?["id"] as? String
            if let index = self.folders.firstIndex(where: { $0["id"] == id }) {
                self.picker.selectRow(index, inComponent: 0, animated: true)
                self.statusLabel.text = "추천 폴더를 확인하고 저장하세요."
            } else {
                self.statusLabel.text = "저장할 폴더를 선택하세요."
            }
        }
    }

    @objc private func save() {
        let index = picker.selectedRow(inComponent: 0)
        guard folders.indices.contains(index), let folderId = folders[index]["id"] else { return }
        saveButton.isEnabled = false
        statusLabel.text = "저장 요청을 보내는 중…"
        request("/api/mobile/saves", method: "POST", body: ["url": sharedURL, "folderId": folderId]) { [weak self] data in
            guard let self else { return }
            if data?["item"] != nil {
                self.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
            } else {
                self.statusLabel.text = "저장하지 못했습니다. 맥 연결을 확인하세요."
                self.saveButton.isEnabled = true
            }
        }
    }

    private func request(_ path: String, method: String, body: [String: Any]? = nil, completion: @escaping ([String: Any]?) -> Void) {
        guard let url = URL(string: endpoint + path) else { completion(nil); return }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 25
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        }
        URLSession.shared.dataTask(with: request) { data, response, _ in
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            let value = data.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }
            DispatchQueue.main.async { completion((200..<300).contains(status) ? value : nil) }
        }.resume()
    }

    func numberOfComponents(in pickerView: UIPickerView) -> Int { 1 }
    func pickerView(_ pickerView: UIPickerView, numberOfRowsInComponent component: Int) -> Int { folders.count }
    func pickerView(_ pickerView: UIPickerView, titleForRow row: Int, forComponent component: Int) -> String? { folders[row]["path"] }
}
