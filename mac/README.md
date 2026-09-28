# Tidymark for Mac

Downloads 폴더를 정리하는 메뉴바 앱입니다. Tidymark 확장의 네 가지 정리 방식과 점검을 파일에 그대로 적용합니다. 정리 분류에는 macOS가 이미 기록해 둔 정보만 이 Mac 안에서 씁니다. 중복 점검은 같은 크기의 파일 내용을 읽어 비교합니다. 파일 이름, 종류, 추가된 날짜, 마지막으로 연 날짜, 받은 사이트 주소(`kMDItemWhereFroms`)입니다.

## 기능

- **A 새 폴더로**: 종류별 폴더로 나눕니다. 받은 사이트가 Chrome 북마크의 "여행 / 포르투갈"에 있으면 같은 이름의 폴더로 보냅니다.
- **B 기존 폴더로**: 사용자가 추가한 폴더로만 보냅니다. 같은 사이트에서 받은 파일이 이미 있거나(자동 선택), 폴더 이름이 겹치면(검토 필요) 제안합니다.
- **C 쓰임새로**: 마지막으로 연 날짜로 Active / Occasional / Someday / Archive로 나누고, 원하면 종류별로 한 번 더 나눕니다.
- **D 프로젝트로**: 3시간 간격 안에 몰아서 받은 3개 이상의 파일을 `Projects/날짜 · 사이트` 폴더로 묶습니다. 공통점이 없으면 묶지 않습니다.
- **점검**: 이미 설치한 앱의 `.dmg`/`.pkg`, 받다 만 파일, 내용이 같은 중복 파일, 90일 넘게 안 연 500MB 이상 파일, 7일 지난 스크린샷을 찾습니다.
- **새 다운로드 감시**: 파일이 들어오면 옮길 곳을 알림으로 제안합니다(옮기기 / 그대로 두기).
- **안전장치**
  - 최근 N일(기본 2일) 안에 받은 파일은 건드리지 않습니다.
  - 항상 이동 예정표를 먼저 보여줍니다.
  - 같은 이름이 있으면 덮어쓰지 않고 "이름 2"로 옮깁니다.
  - 삭제는 휴지통으로만 보냅니다.
  - 마지막 적용은 되돌릴 수 있습니다(`~/Library/Application Support/Tidymark/last-undo.json`).
- 한국어·영어를 지원합니다(설정에서 시스템 언어 / 한국어 / English). 라이트 모드로 고정됩니다.

## 구조

- `Sources/TidyCore`: 스캔, 분류(`Planner`), 점검(`Checkup`), 실행과 되돌리기(`Executor`), 북마크 색인, 문구 번역(`L()`)
- `Sources/App`: SwiftUI 메뉴바 앱, 정리 스튜디오(정리 / 점검 / 설정), 첫 실행 안내, 폴더 감시, 알림, 로그인 시 실행
- `Tests/TidyCoreTests`: 네 가지 방식, 점검, 적용↔되돌리기 왕복, 덮어쓰기 방지, 영어 문구 테스트

## 빌드와 실행

```bash
cd mac
xcodegen generate
xcodebuild -project TidymarkMac.xcodeproj -scheme TidymarkMac -derivedDataPath build test   # 테스트
xcodebuild -project TidymarkMac.xcodeproj -scheme TidymarkMac -derivedDataPath build build  # 빌드
open build/Build/Products/Debug/Tidymark.app
```

### 실제 Downloads 대신 테스트 폴더로 실행

```bash
TIDYMARK_FIXTURE_DATES=1 build/Build/Products/Debug/Tidymark.app/Contents/MacOS/Tidymark \
  --downloads /path/to/fixture/Downloads --root /path/to/fixture/Tidymark --chrome /path/to/fixture/chrome \
  --skip-onboarding --open-studio
```

- `TIDYMARK_FIXTURE_DATES=1`(디버그 빌드 전용): Finder의 "추가된 날짜" 대신 생성 날짜를 씁니다. 테스트 파일은 `touch -t`로 날짜를 맞춥니다.
- `--snapshot <폴더>`(디버그 빌드 전용): 화면을 PNG로 저장하고 종료합니다. 화면 기록 권한이 필요 없습니다.
- 테스트 실행도 앱 설정(`defaults`의 `net.tangibleidea.tidymark.mac`)을 저장합니다. 끝나면 `defaults delete net.tangibleidea.tidymark.mac`으로 지우세요.

## 권한

- Downloads: 첫 실행 안내에서 버튼을 누르면 macOS가 한 번 묻습니다. 취소되면 앱이 "시스템 설정 열기"를 안내합니다.
- 옮길 곳: 정리 폴더(기본 `~/Documents/Tidymark`)와 B 방식에 추가한 폴더에만 씁니다. Documents와 Desktop은 처음 한 번 macOS가 묻습니다.
- 전체 디스크 접근은 쓰지 않습니다.

## 배포 전에 남은 일

- 지금은 ad-hoc 서명입니다. 다른 Mac에 배포하려면 Developer ID 서명과 공증(notarization)이 필요합니다.
- 실제 Downloads에서 새 다운로드 알림 흐름(감시 → 알림 → 옮기기)을 직접 한 번 확인해야 합니다.

## 반응 속도

- 메뉴바를 다시 열면 저장된 결과를 먼저 표시합니다. 60초 안에는 열기만으로 재검사하지 않습니다. 폴더 변경 감시와 수동 새로고침은 즉시 갱신을 요청합니다.
- 파일 목록을 먼저 갱신하고, 중복 파일 점검은 낮은 우선순위의 백그라운드 작업으로 진행합니다. 새 검사가 시작되면 이전 중복 검사는 취소합니다.
- 정리 예정표 생성도 백그라운드에서 실행합니다. 검사 도중 들어온 폴더 변경은 합쳐서 다음 스캔에 반영합니다.
- 실제 사용용 최적화 빌드: `xcodebuild -project TidymarkMac.xcodeproj -scheme TidymarkMac -configuration Release -derivedDataPath build build`. 결과는 `build/Build/Products/Release/Tidymark.app`입니다.
