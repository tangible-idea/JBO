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

### 2026-09-25 — Orca 내장 브라우저(`orca` CLI) 성공

Orca 브라우저는 CDP로 페이지를 제어하므로 스토어 도메인 차단을 받지 않습니다. 개인정보처리방침 탭을 이 방법으로 입력하고 저장했습니다.

1. `orca tab create --url <대시보드 URL> --json`으로 탭을 엽니다. 탭은 현재 작업 공간(JBO / master)에 생기므로, 사용자에게 Orca에서 그 작업 공간을 선택하라고 안내합니다.
2. Orca 브라우저는 Chrome과 로그인을 공유하지 않습니다. 사용자가 그 탭에서 직접 Google 로그인을 해야 합니다. 로그인한 상태는 Default 프로필에 남습니다.
3. `orca snapshot`으로 ref를 얻고, `orca fill --element @eNN --value ...`로 텍스트 칸을, `orca check --element @eNN`로 체크박스를 채웁니다.
4. **라디오 버튼(Remote code)은 `orca click`이 먹히지 않습니다.** `orca eval`로 `input[type=radio][value=false]`의 좌표를 구한 뒤, `orca mouse move --x --y` → `mouse down` → `mouse up`으로 실제 마우스 클릭을 해야 바뀝니다.
5. 상단의 `Save draft`를 누르고, `orca reload` 후 다시 snapshot해서 글자 수와 체크 상태가 유지되는지 확인합니다.
6. `Why can't I submit?` 버튼을 누르면 남은 차단 사유가 대화상자로 나옵니다.
7. `Submit for review`는 사용자 확인을 받은 뒤에만 누릅니다.

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

## 사이트와 URL (2026-09-25 확정)

- 소개 사이트: `site/` (Vite + React). **Vercel**에서 `https://tidy.tmtt.link`로 서비스합니다. master에 푸시하면 1분 안에 반영됩니다.
- 개인정보처리방침: `https://tidy.tmtt.link/privacypolicy` (`site/privacypolicy/index.html` 엔트리 → `src/PrivacyPolicy.jsx`). 권한이나 데이터 흐름이 바뀌면 `site/src/content.jsx`의 `privacy`와 `PRIVACY_UPDATED`를 고칩니다.
- 대시보드 입력값:
  - Store listing → Homepage URL: `https://tidy.tmtt.link/`
  - Store listing → Support URL: `https://github.com/tangible-idea/JBO/issues`
  - Privacy → Privacy policy URL: `https://tidy.tmtt.link/privacypolicy`
- URL 칸에는 반드시 `https://`까지 넣습니다. `tidy.tmtt.link`만 넣었을 때 "not reachable" 오류가 났습니다.
- 모든 항목을 채운 뒤 "Why can't I submit?" 버튼이 사라지고 `Submit for review`가 활성화되는 것을 확인했습니다.

## 공개 API 서버 (Cloud Run, 2026-09-25)

- 서비스: `tidymark-api` / 프로젝트 `tangibly-1f5ab` / 리전 `asia-northeast3`
- URL: `https://tidymark-api-133930666159.asia-northeast3.run.app` (확장의 기본 endpoint이자 manifest `host_permissions`)
- 배포: `make deploy-api` (`.env`의 `GCP_PROJECT`, `GCP_REGION`, API 키를 사용). 처음 한 번은 `gcloud auth login`이 필요하고, 결제 계정이 **열린(open) 상태**로 프로젝트에 연결되어 있어야 합니다. 닫힌 결제 계정에 연결하면 `billingEnabled: false`로 남습니다.
- 컨테이너는 `TIDYMARK_PUBLIC=1`로 실행됩니다:
  - 사용자 URL fetch 시 사설망과 메타데이터 서버를 차단합니다(`server/safe-fetch.mjs`).
  - CORS는 스토어 확장 ID만 허용합니다(`ALLOWED_ORIGINS`).
  - IP당 분당 120회로 요청을 제한합니다(`RATE_LIMIT_PER_MIN`).
  - 디스크에 쓰지 않고, `/api/profile/latest`는 끕니다.
- 비용 상한: 인스턴스 최대 2개, 요청이 없으면 0으로 줄어듭니다. 실제 비용은 대부분 TypeSafe와 Poe 호출입니다.
- 서버 주소가 바뀌면 `extension/popup.js`와 `extension/options.js`의 `DEFAULT_SETTINGS.endpoint`, `manifest.json`의 `host_permissions`, `dist/store-assets/privacy-practices.txt`, 사이트 개인정보처리방침을 함께 고칩니다.

## 다국어 (0.3.1부터)

- 확장 UI: 한국어 원문 문장을 키로 쓰고, 영어는 `extension/i18n-en.js`에 둡니다(`t("‘{0}’에 저장", name)`). 브라우저 언어가 `ko`가 아니면 영어로 나옵니다. manifest 이름과 설명은 `_locales/{en,ko}`에 있습니다.
- 문구를 추가하면 `i18n-en.js`에도 넣습니다. 빠진 키는 한국어로 그대로 보입니다.
- 스토어 등록정보: 한국어는 `dist/store-assets/`, 영어는 `dist/store-assets/en/`에 있습니다. 영어 스크린샷은 가짜 Chrome API로 영어 UI를 띄워 1280×800으로 찍은 것입니다.
