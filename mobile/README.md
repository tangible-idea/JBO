# Tidymark 모바일 앱

Flutter iOS·Android 앱입니다. 다른 앱의 공유 메뉴에서 받은 웹 주소를 기존 Chrome 북마크 폴더로 저장하고, 맥의 Chrome 북마크와 Downloads·Tidymark 정리 폴더를 함께 검색합니다.

## 개인 서버 연결

현재 버전은 **맥과 휴대폰이 같은 Wi-Fi에 있고 맥의 서버가 실행 중일 때** 동작합니다. 공개 분류 API에는 모바일 검색 자료를 저장하지 않습니다.

1. 프로젝트 루트 `.env`에 `HOST=0.0.0.0`과 `MOBILE_TOKEN=`을 추가합니다. 토큰은 `openssl rand -hex 24`로 만듭니다. `.env`에 기존 `TYPESAFE_API_KEY`도 필요합니다.
2. 프로젝트 루트에서 `make`로 서버를 실행합니다. 맥 IP는 `ipconfig getifaddr en0` 등으로 확인합니다.
3. Chrome 확장 프로그램을 새로고침하고, **정리 스튜디오 → 설정 → 모바일 앱 연결**에 `http://<맥 IP>:8787`과 같은 토큰을 입력합니다. 현재 북마크 저장은 Chrome **Default 프로필**의 폴더를 대상으로 합니다.
4. 앱을 실행해 같은 주소와 토큰을 입력합니다.

맥 앱에서 정리 폴더를 기본값(`~/Documents/Tidymark`)에서 바꿨다면 `.env`에 `MOBILE_TIDY_ROOT`를 설정합니다. 검색은 파일 이름과 경로를 보여 주며 파일 자체를 휴대폰으로 전송하지 않습니다. 링크 저장 요청은 서버에 대기했다가 Chrome 확장이 최대 약 1분 간격으로 반영합니다.

## 실행

```sh
cd mobile
flutter pub get
flutter run
```

iOS 공유 확장은 `ios/ShareExtension` 타깃으로 포함되어 있고 공유 창 안에서 추천 폴더를 선택해 저장합니다. 실제 iPhone에 설치할 때는 Xcode에서 Runner와 ShareExtension에 같은 Apple 팀으로 서명하고 `group.net.tangibleidea.mobile` App Group을 두 타깃에 활성화해야 합니다. Android는 `ACTION_SEND text/*`를 받아 앱의 저장 화면을 엽니다.

공용 네트워크나 인터넷에 `HOST=0.0.0.0` 서버를 그대로 노출하지 마세요. 원격 접속에는 HTTPS와 영구 저장소를 갖춘 별도 배포가 필요합니다.
