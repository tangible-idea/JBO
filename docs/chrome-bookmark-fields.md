# Chrome 북마크에서 얻을 수 있는 정보

`chrome.bookmarks` API의 `BookmarkTreeNode`에 들어 있는 필드입니다.
출처: <https://developer.chrome.com/docs/extensions/reference/api/bookmarks>

| 필드 | 내용 | 비고 |
|---|---|---|
| `dateAdded` | 북마크를 저장한 시각 (1970년 기준 밀리초) | 북마크·폴더 모두 |
| `dateLastUsed` | 북마크를 마지막으로 연 시각 | Chrome 114+, 폴더에는 없음 |
| `dateGroupModified` | 폴더 안 내용이 마지막으로 바뀐 시각 | 폴더만 |
| `id`, `parentId`, `index` | 고유 ID, 상위 폴더, 폴더 안 순서 | |
| `title`, `url` | 제목, 주소 | 폴더에는 `url` 없음 |
| `folderType` | Chrome이 만든 기본 폴더인지 (`bookmarks-bar`, `other`, `mobile`, `managed`) | Chrome 134+ |
| `syncing` | 계정 동기화 대상인지 | Chrome 134+ |
| `unmodifiable` | 관리자가 지정해서 수정할 수 없는 북마크인지 | |

## 북마크 API에 없는 정보

방문 횟수와 마지막 방문 시각은 없습니다. `history` 권한을 추가하면 `chrome.history`로 URL별로 다음 값을 얻을 수 있습니다.

- `visitCount`: 방문 횟수
- `lastVisitTime`: 마지막 방문 시각
- `typedCount`: 주소창에 직접 입력한 횟수

다만 설치할 때 "방문 기록 읽기" 권한 경고가 뜹니다.
