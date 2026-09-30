import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:receive_sharing_intent/receive_sharing_intent.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

void main() => runApp(const TidymarkApp());

class TidymarkApp extends StatefulWidget {
  const TidymarkApp({super.key});
  @override
  State<TidymarkApp> createState() => _TidymarkAppState();
}

class _TidymarkAppState extends State<TidymarkApp> {
  final endpoint = TextEditingController();
  final token = TextEditingController();
  final query = TextEditingController();
  final link = TextEditingController();
  final title = TextEditingController();
  StreamSubscription<List<SharedMediaFile>>? shareSubscription;
  Timer? debounce;
  List<Map<String, dynamic>> results = [];
  List<Map<String, dynamic>> folders = [];
  List<Map<String, dynamic>> candidates = [];
  String? selectedFolder;
  String? notice;
  bool connected = false;
  bool busy = false;
  int tab = 0;
  int total = 0;

  @override
  void initState() {
    super.initState();
    _loadSettings();
    shareSubscription = ReceiveSharingIntent.instance.getMediaStream().listen(_receiveShare);
    ReceiveSharingIntent.instance.getInitialMedia().then((items) {
      if (items.isNotEmpty) _receiveShare(items);
      ReceiveSharingIntent.instance.reset();
    });
  }

  @override
  void dispose() {
    shareSubscription?.cancel();
    debounce?.cancel();
    for (final controller in [endpoint, token, query, link, title]) { controller.dispose(); }
    super.dispose();
  }

  Future<void> _loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    endpoint.text = prefs.getString('endpoint') ?? '';
    token.text = prefs.getString('token') ?? '';
    if (endpoint.text.isNotEmpty && token.text.isNotEmpty) _connect();
  }

  void _receiveShare(List<SharedMediaFile> items) {
    for (final item in items) {
      final match = RegExp(r'https?://[^\s<>]+').firstMatch(item.path);
      if (match == null) continue;
      final url = match.group(0)!.replaceFirst(RegExp(r'[.,;)]$'), '');
      if (Uri.tryParse(url)?.hasAuthority != true) continue;
      setState(() {
        link.text = url;
        title.text = item.path.substring(0, match.start).trim();
        candidates = [];
        selectedFolder = null;
        tab = 1;
        notice = null;
      });
      if (connected) _classify();
      return;
    }
    if (mounted) setState(() { tab = 1; notice = '공유된 내용에 웹 주소가 없습니다.'; });
  }

  Future<Map<String, dynamic>> _request(String method, String path, [Map<String, dynamic>? body]) async {
    final base = Uri.parse(endpoint.text.trim().replaceFirst(RegExp(r'/$'), ''));
    if (!['http', 'https'].contains(base.scheme) || base.host.isEmpty) throw const FormatException('서버 주소를 확인하세요.');
    final client = HttpClient()..connectionTimeout = const Duration(seconds: 8);
    try {
      final request = await client.openUrl(method, base.resolve(path)).timeout(const Duration(seconds: 10));
      request.headers.set(HttpHeaders.authorizationHeader, 'Bearer ${token.text.trim()}');
      request.headers.set(HttpHeaders.acceptHeader, 'application/json');
      if (body != null) {
        request.headers.contentType = ContentType.json;
        request.write(jsonEncode(body));
      }
      final response = await request.close().timeout(const Duration(seconds: 30));
      final data = jsonDecode(await utf8.decoder.bind(response).join()) as Map<String, dynamic>;
      if (response.statusCode >= 400) throw Exception(data['error'] ?? '서버 오류 ${response.statusCode}');
      return data;
    } finally { client.close(); }
  }

  List<Map<String, dynamic>> _maps(dynamic value) =>
      (value as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().toList();

  String _error(Object error) => error.toString().replaceFirst(RegExp(r'^(Exception|FormatException): '), '');

  Future<void> _connect() async {
    setState(() { busy = true; notice = null; });
    try {
      final data = await _request('GET', '/api/mobile/folders');
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('endpoint', endpoint.text.trim());
      await prefs.setString('token', token.text.trim());
      if (Platform.isIOS) {
        await const MethodChannel('net.tangibleidea.mobile/config').invokeMethod('saveConnection', {
          'endpoint': endpoint.text.trim(), 'token': token.text.trim(),
        });
      }
      if (!mounted) return;
      setState(() { folders = _maps(data['folders']); connected = true; notice = '맥과 연결됐어요.'; });
      await _search();
    } catch (error) {
      if (mounted) setState(() { connected = false; notice = _error(error); });
    } finally { if (mounted) setState(() => busy = false); }
  }

  Future<void> _search() async {
    if (!connected) return;
    try {
      final data = await _request('GET', '/api/mobile/search?q=${Uri.encodeQueryComponent(query.text.trim())}');
      if (mounted) setState(() { results = _maps(data['results']); total = data['total'] as int? ?? 0; });
    } catch (error) { if (mounted) setState(() => notice = _error(error)); }
  }

  Future<void> _classify() async {
    final url = Uri.tryParse(link.text.trim());
    if (url == null || !['http', 'https'].contains(url.scheme) || url.host.isEmpty) {
      setState(() => notice = 'http 또는 https 웹 주소를 입력하세요.'); return;
    }
    setState(() { busy = true; candidates = []; selectedFolder = null; notice = null; });
    try {
      final data = await _request('POST', '/api/mobile/classify', {'page': {'url': url.toString(), 'title': title.text.trim()}});
      if (!mounted) return;
      setState(() {
        if (title.text.trim().isEmpty) title.text = '${data['pageTitle'] ?? ''}';
        candidates = _maps(data['candidates']);
        selectedFolder = (data['recommendation'] as Map<String, dynamic>?)?['id'] as String?;
        if (candidates.isEmpty) notice = '어울리는 폴더를 직접 고르세요.';
      });
    } catch (error) {
      if (mounted) setState(() => notice = '${_error(error)} 폴더를 직접 선택할 수 있습니다.');
    } finally { if (mounted) setState(() => busy = false); }
  }

  Future<void> _save() async {
    if (selectedFolder == null) return;
    setState(() { busy = true; notice = null; });
    try {
      await _request('POST', '/api/mobile/saves', {
        'url': link.text.trim(), 'title': title.text.trim().isEmpty ? link.text.trim() : title.text.trim(),
        'folderId': selectedFolder,
      });
      if (!mounted) return;
      setState(() { notice = '저장 요청을 보냈어요. 맥의 Chrome 확장이 곧 북마크에 반영합니다.'; link.clear(); title.clear(); candidates = []; selectedFolder = null; });
      _search();
    } catch (error) { if (mounted) setState(() => notice = _error(error));
    } finally { if (mounted) setState(() => busy = false); }
  }

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Tidymark',
    theme: ThemeData(useMaterial3: true, colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xff307564)), scaffoldBackgroundColor: const Color(0xfff7f9f5)),
    home: Builder(builder: (context) => Scaffold(
      appBar: AppBar(title: const Text('Tidymark', style: TextStyle(fontWeight: FontWeight.w800)), actions: [IconButton(tooltip: '연결 설정', icon: const Icon(Icons.settings_outlined), onPressed: () => _showSettings(context))]),
      body: SafeArea(child: Column(children: [
        if (notice != null) MaterialBanner(content: Text(notice!), actions: [TextButton(onPressed: () => setState(() => notice = null), child: const Text('닫기'))]),
        Expanded(child: connected ? (tab == 0 ? _searchView() : _saveView()) : _connectionView()),
      ])),
      bottomNavigationBar: connected ? NavigationBar(selectedIndex: tab, onDestinationSelected: (index) => setState(() => tab = index), destinations: const [NavigationDestination(icon: Icon(Icons.search), label: '통합 검색'), NavigationDestination(icon: Icon(Icons.bookmark_add_outlined), label: '링크 저장')]) : null,
    )),
  );

  Widget _connectionView() => ListView(padding: const EdgeInsets.all(24), children: [
    const SizedBox(height: 40), const Icon(Icons.hub_outlined, size: 64, color: Color(0xff307564)), const SizedBox(height: 20),
    const Text('맥과 연결하기', textAlign: TextAlign.center, style: TextStyle(fontSize: 25, fontWeight: FontWeight.bold)),
    const SizedBox(height: 8), const Text('맥의 Tidymark 서버 주소와 연결 토큰을 입력하세요. 휴대폰과 맥이 같은 네트워크에 있어야 합니다.', textAlign: TextAlign.center),
    const SizedBox(height: 28), _settingsFields(),
  ]);

  Widget _settingsFields() => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
    TextField(controller: endpoint, keyboardType: TextInputType.url, decoration: const InputDecoration(labelText: '서버 주소', hintText: 'http://192.168.1.10:8787', border: OutlineInputBorder())),
    const SizedBox(height: 12), TextField(controller: token, obscureText: true, decoration: const InputDecoration(labelText: '연결 토큰', border: OutlineInputBorder())),
    const SizedBox(height: 16), FilledButton(onPressed: busy ? null : _connect, child: const Text('연결 확인')),
  ]);

  void _showSettings(BuildContext context) => showModalBottomSheet<void>(context: context, isScrollControlled: true, showDragHandle: true, builder: (context) => Padding(
    padding: EdgeInsets.fromLTRB(24, 12, 24, MediaQuery.viewInsetsOf(context).bottom + 32),
    child: SingleChildScrollView(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const Text('연결 설정', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)), const SizedBox(height: 16), _settingsFields(),
    ])),
  ));

  Widget _searchView() => Column(children: [
    Padding(padding: const EdgeInsets.fromLTRB(16, 14, 16, 8), child: TextField(controller: query, decoration: InputDecoration(prefixIcon: const Icon(Icons.search), hintText: '북마크·파일 이름·폴더 검색', suffixIcon: IconButton(icon: const Icon(Icons.refresh), tooltip: '새로고침', onPressed: _search), border: const OutlineInputBorder()), onChanged: (_) { debounce?.cancel(); debounce = Timer(const Duration(milliseconds: 250), _search); })),
    Padding(padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6), child: Align(alignment: Alignment.centerLeft, child: Text('$total개 결과${total > results.length ? ' · 상위 ${results.length}개 표시' : ''}', style: const TextStyle(color: Colors.black54)))),
    Expanded(child: RefreshIndicator(onRefresh: _search, child: ListView.builder(itemCount: results.length, itemBuilder: (context, index) {
      final item = results[index]; final isLink = item['type'] == 'bookmark';
      return Card(margin: const EdgeInsets.symmetric(horizontal: 14, vertical: 4), child: ListTile(
        leading: CircleAvatar(child: Icon(isLink ? Icons.bookmark_outline : Icons.insert_drive_file_outlined)),
        title: Text('${item['title'] ?? ''}', maxLines: 2, overflow: TextOverflow.ellipsis),
        subtitle: Text(isLink ? '${item['path'] ?? ''}\n${item['url'] ?? ''}' : '${item['collection'] ?? ''} / ${item['path'] ?? ''}', maxLines: 2, overflow: TextOverflow.ellipsis),
        isThreeLine: true, trailing: isLink ? const Icon(Icons.open_in_new, size: 18) : null,
        onTap: isLink ? () async { final uri = Uri.tryParse('${item['url']}'); if (uri != null) await launchUrl(uri, mode: LaunchMode.externalApplication); } : () => showDialog<void>(context: context, builder: (_) => AlertDialog(title: Text('${item['title']}'), content: Text('맥의 ${item['collection']} / ${item['path']}'), actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('확인'))])),
      ));
    }))),
  ]);

  Widget _saveView() => ListView(padding: const EdgeInsets.all(18), children: [
    const Text('링크 저장', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
    const SizedBox(height: 6), const Text('다른 앱의 공유 메뉴에서 Tidymark를 선택하거나 주소를 붙여 넣으세요.'),
    const SizedBox(height: 20), TextField(controller: link, keyboardType: TextInputType.url, decoration: const InputDecoration(labelText: '웹 주소', border: OutlineInputBorder()), onChanged: (_) => setState(() { candidates = []; selectedFolder = null; })),
    const SizedBox(height: 12), TextField(controller: title, decoration: const InputDecoration(labelText: '제목 (선택)', border: OutlineInputBorder())),
    const SizedBox(height: 14), OutlinedButton.icon(onPressed: busy ? null : _classify, icon: const Icon(Icons.auto_awesome_outlined), label: const Text('폴더 추천받기')),
    if (candidates.isNotEmpty) ...[
      const SizedBox(height: 18), const Text('추천 폴더', style: TextStyle(fontWeight: FontWeight.bold)),
      for (final candidate in candidates) ListTile(
        leading: Icon(selectedFolder == candidate['id'] ? Icons.radio_button_checked : Icons.radio_button_unchecked),
        title: Text('${candidate['path']}'),
        subtitle: Text('적합도 ${((candidate['probability'] as num? ?? 0) * 100).round()}%'),
        onTap: () => setState(() => selectedFolder = '${candidate['id']}'),
      ),
    ],
    const SizedBox(height: 14), DropdownButtonFormField<String>(key: ValueKey(selectedFolder), initialValue: folders.any((f) => f['id'] == selectedFolder) ? selectedFolder : null, isExpanded: true, decoration: const InputDecoration(labelText: '저장할 폴더', border: OutlineInputBorder()), items: folders.map((f) => DropdownMenuItem(value: '${f['id']}', child: Text('${f['path']}', overflow: TextOverflow.ellipsis))).toList(), onChanged: (value) => setState(() => selectedFolder = value)),
    const SizedBox(height: 18), FilledButton.icon(onPressed: busy || selectedFolder == null || link.text.trim().isEmpty ? null : _save, icon: const Icon(Icons.bookmark_add), label: const Text('이 폴더에 저장 요청')),
    const SizedBox(height: 12), const Text('맥의 Chrome 확장이 실행 중일 때 북마크에 반영됩니다.', textAlign: TextAlign.center, style: TextStyle(color: Colors.black54)),
  ]);
}
