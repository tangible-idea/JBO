# JEV 북마크 분류기

현재 Chrome 탭의 제목, URL, 설명을 TypeSafe JEV로 분류해 기존 북마크 폴더를 추천하는 Manifest V3 확장프로그램입니다. API 키가 노출되지 않도록 JEV 호출은 로컬 Node 백엔드에서만 수행합니다.

## 실행

Node.js 20 이상이 필요합니다.

```bash
npm install
cp .env.example .env
```

`.env`에 `TYPESAFE_API_KEY`를 입력한 뒤 환경변수를 읽어 서버를 실행합니다.

```bash
set -a
source .env
set +a
npm start
```

Chrome에서 `chrome://extensions`를 열고 **개발자 모드 → 압축해제된 확장 프로그램을 로드합니다**를 선택한 다음 이 저장소의 `extension` 폴더를 지정합니다. 툴바의 확장 아이콘을 누르면 현재 페이지를 분류할 수 있습니다.

기본 백엔드 주소는 `http://127.0.0.1:8787`입니다. 배포된 HTTPS 백엔드를 사용할 때는 확장의 설정 화면에서 주소를 바꾸고 접근 권한을 승인하세요.

## 분류 정책

- JEV `Choice`가 기존 폴더와 `no_good_match` 중 하나를 선택합니다.
- 상위 세 후보, 후보별 probability, 전체 confidence를 UI에 표시합니다.
- 자동 저장은 기본적으로 꺼져 있습니다. 설정에서 켜면 confidence 기준 이상일 때만 자동 저장합니다.
- 이미 북마크된 URL이면 중복 생성 대신 기존 북마크를 선택한 폴더로 이동합니다.
- 한 요청에서 최대 100개 폴더를 비교합니다. 그보다 많으면 UI에 제외 개수를 표시합니다.

## 검증

```bash
npm test
npm run check
```

`GET /health`는 서버와 API 키 설정 상태를, `POST /api/classify`는 실제 분류를 제공합니다.
