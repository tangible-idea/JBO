# Tidymark 소개 웹사이트

Vite + React로 만든 영문 랜딩 페이지입니다. 스토어 등록정보의 개인정보처리방침 URL로 `#privacy` 섹션을 쓸 수 있습니다.

```bash
make site        # 개발 서버 (http://localhost:5173)
make site-build  # site/dist 에 정적 빌드
```

- 문구와 예시 데이터: `src/content.jsx`
- 섹션 구성: `src/App.jsx`
- 팝업 데모: `src/components/PopupDemo.jsx`
- 스타일(색 토큰, 다크 모드 포함): `src/styles.css`

`vite.config.js`의 `base: "./"` 덕분에 빌드 결과는 GitHub Pages, Netlify, Cloudflare Pages 등 어느 정적 호스팅이나 하위 경로에 그대로 올릴 수 있습니다.
