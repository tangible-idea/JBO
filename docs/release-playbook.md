# Chrome Web Store 출시 플레이북

- 퍼블리셔 ID: `3b3bdeb2-dba1-4488-b44d-72afecefc090`
- 항목 ID: `nglhhhkgognkifklfokjakljcopimcjg`
- 대시보드: https://chrome.google.com/webstore/devconsole/3b3bdeb2-dba1-4488-b44d-72afecefc090/nglhhhkgognkifklfokjakljcopimcjg/edit

## 시도 기록

### 2026-09-25 — 브라우저 자동화(Claude in Chrome) 실패

- `chrome.google.com/webstore/devconsole/...` → `The extensions gallery cannot be scripted.`
- `chromewebstore.google.com/devconsole/...` → `Permission denied for this action on this domain`
- 원인: Chrome은 보안상 모든 확장 프로그램이 Web Store 도메인에서 스크립트를 실행하거나 화면을 캡처하지 못하게 막습니다. 로그인 여부와 상관없으므로 **브라우저 자동화로는 출시할 수 없습니다.**
- 기존 루트의 `extension.zip`은 쓰지 않습니다. `extension/` 폴더째 압축돼 manifest가 zip 루트에 없고, `__MACOSX/`와 `*.test.mjs`도 들어 있어 업로드가 거부됩니다.
- 대시보드 목록 페이지(`/devconsole/<퍼블리셔 ID>`)도 같은 이유로 막혔습니다. 페이지를 여는 것만 되고, 텍스트 읽기·스크린샷·클릭은 모두 안 됩니다.
- 같은 날 사용자가 대시보드에서 zip을 직접 업로드했습니다.
- 대안: 아래의 Chrome Web Store API v2 경로(`scripts/cws.mjs`).

## 최초 1회 설정: API 인증 정보

1. Google Cloud Console에서 프로젝트를 만들고 **Chrome Web Store API**를 사용 설정합니다.
2. OAuth 동의 화면을 설정합니다(외부, 테스트 사용자에 본인 계정 추가).
3. **사용자 인증 정보 → OAuth 클라이언트 ID**를 만듭니다. 유형은 "데스크톱 앱"입니다. Client ID와 Secret을 복사합니다.
4. refresh token 발급:
   - 브라우저에서 아래 URL을 엽니다(`CLIENT_ID` 치환).
     `https://accounts.google.com/o/oauth2/auth?response_type=code&scope=https://www.googleapis.com/auth/chromewebstore&access_type=offline&prompt=consent&redirect_uri=http://localhost:8818&client_id=CLIENT_ID`
   - 승인하면 `http://localhost:8818/?code=...`로 이동합니다(페이지 오류는 무시). 주소창의 `code` 값을 복사합니다.
   - 교환:
     ```bash
     curl -s https://oauth2.googleapis.com/token \
       -d client_id=CLIENT_ID -d client_secret=CLIENT_SECRET \
       -d code=CODE -d grant_type=authorization_code \
       -d redirect_uri=http://localhost:8818
     ```
   - 응답의 `refresh_token`을 저장합니다.
   - 참고: 동의 화면이 "테스트" 상태면 refresh token은 7일 뒤 만료됩니다. 계속 쓰려면 앱을 "프로덕션"으로 게시하세요.
5. `.env`에 추가합니다(`.env`는 git에서 제외됨).
   ```
   CWS_CLIENT_ID=...
   CWS_CLIENT_SECRET=...
   CWS_REFRESH_TOKEN=...
   ```
6. `make cws-status`로 인증과 항목 상태를 확인합니다.

## 최초 1회 설정: 대시보드에서 직접 채워야 하는 항목

API는 zip 업로드와 검토 제출만 합니다. 아래는 대시보드에서 사람이 입력해야 합니다. 비어 있으면 publish 호출이 실패합니다.

- **스토어 등록정보**: 상세 설명, 카테고리, 언어, 128×128 아이콘, 스크린샷 1장 이상(1280×800 또는 640×400), 작은 프로모션 타일(440×280)
- **개인정보처리방침 탭**: 단일 목적 설명, 권한별 사유(`activeTab`, `bookmarks`, `scripting`, `storage`, `favicon`, 선택 권한 `history`, 호스트 권한), 원격 코드 사용 여부(아니요), 데이터 사용 공개, 개인정보처리방침 URL(페이지 URL·제목을 서버로 보내므로 필요함)
- **배포 탭**: 공개 범위(공개/비공개/그룹), 지역
- **계정**: 개발자 이메일 인증

### 등록정보 입력값 (2026-09-25 v0.3.0 기준)

파일은 `dist/store-assets/`에 있습니다(`dist/`는 git 제외).

| 대시보드 항목 | 값 / 파일 |
|---|---|
| Description | `description.txt` 내용 전체 붙여넣기 |
| Category | Productivity → Tools (없으면 Productivity) |
| Language | 한국어 (Korean) |
| Store icon | `store-icon-128.png` (= `extension/icons/icon128.png`) |
| Global promo video | 선택. `promo/tidymark-promo.mp4`를 YouTube에 올린 뒤 URL |
| Screenshots | `screenshot-1.png` ~ `screenshot-5.png` (1280×800, 알파 없음) |
| Small promo tile | `promo-small.png` (440×280) |
| Marquee promo tile | `promo-marquee.png` (1400×560) |

### 개인정보처리방침 탭 입력값

`dist/store-assets/privacy-practices.txt`에 칸별로 정리했습니다. 권한 사유는 코드 기준입니다. 권한이 바뀌면 이 파일도 고쳐야 합니다.
- Remote code는 **"No"** 를 선택합니다. "Yes"를 고르면 사유를 요구하는 오류가 납니다.
- Homepage / Support URL은 **실제로 열리는 주소**여야 합니다. 열리지 않으면 "not reachable" 오류가 납니다. 소개 사이트(`site/`)를 배포한 주소를 쓰고, Support에는 공개 저장소의 Issues 페이지를 써도 됩니다.
- 첫 제출(2026-09-25)에서 난 오류: 권한 8개의 사유 누락, 단일 목적 설명 누락, 데이터 사용 인증 누락, Homepage/Support URL 접속 불가.

재생성 방법:
- 스크린샷: 홍보 영상 `promo/tidymark-promo.mp4`의 11 / 15.5 / 19.5 / 23 / 27초 프레임을 씁니다. 가운데 기준으로 1728×1080 크롭 후 1280×800으로 줄이고, `-pix_fmt rgb24`로 알파를 없앱니다. 19.5초 프레임은 좌우가 잘리므로 1280×720으로 줄이고 위아래를 `#efeee4`로 40px씩 채웁니다.
  `ffmpeg -ss 11 -i promo/tidymark-promo.mp4 -frames:v 1 -vf "crop=1728:1080,scale=1280:800" -pix_fmt rgb24 screenshot-1.png`
- 프로모션 타일: 로고 SVG와 Pretendard로 HTML을 만들고, 헤드리스 Chrome으로 캡처한 뒤 ffmpeg로 rgb24 변환합니다.
  `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --hide-scrollbars --window-size=440,280 --screenshot=out.png file://…/small.html`

## 매 출시 절차

1. `extension/manifest.json`의 `version`을 올립니다. 스토어는 같거나 낮은 버전을 거부합니다.
2. 커밋합니다.
3. `make release`를 실행합니다. 순서: 테스트·검사 → `dist/tidymark-<version>.zip` 생성 → 업로드 → 검토 제출
   - 업로드만 하려면: `set -a; source .env; set +a; node scripts/cws.mjs upload`
   - zip만 만들려면: `make package`
4. `make cws-status`나 대시보드에서 검토 상태를 확인합니다. 보통 수시간에서 수일 걸립니다.

## 알려진 위험

- 확장이 기본적으로 `http://127.0.0.1:8787` 로컬 백엔드를 호출합니다. 스토어 사용자는 이 서버가 없으므로 검토에서 "기능하지 않음"으로 거절될 수 있습니다. 공개 출시 전에 HTTPS 백엔드를 배포하고 기본 endpoint를 바꾸거나, 등록정보에 설정 방법을 분명히 적으세요.
