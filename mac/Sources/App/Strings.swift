import TidyCore

extension AppModel {
    /// English for the app's own UI; TidyCore carries the strings it produces itself.
    func registerAppStrings() {
        L10n.appStrings = [
            // modes and tabs
            "새 폴더로": "Into new folders", "기존 폴더로": "Into your folders", "쓰임새로": "By usage", "프로젝트로": "Into projects",
            "종류별로, 또는 북마크해 둔 사이트의 폴더 이름으로 새 폴더를 만들어 나눠 담아요.": "Sorts files into new folders by kind, or by the folder where you bookmarked the site they came from.",
            "이미 쓰는 폴더는 그대로. 같은 사이트나 이름이 맞는 폴더로 넣어요.": "Keeps your folders as they are and files things where the site or the name matches.",
            "마지막으로 연 날짜로 Active · Occasional · Someday · Archive로 나눠요.": "Splits by the last time you opened each file: Active, Occasional, Someday, Archive.",
            "몇 시간 안에 몰아서 받은 파일을 날짜와 사이트 이름의 폴더로 묶어요.": "Groups files downloaded together within a few hours into a folder named by date and site.",
            "정리하기": "Organize", "점검": "Checkup", "설정": "Settings",
            // checkup
            "이미 설치한 앱의 설치 파일": "Installers for apps you have", "받다 만 파일": "Unfinished downloads", "중복 파일": "Duplicates",
            "오래 안 연 큰 파일": "Large, long-unopened files", "오래된 스크린샷": "Old screenshots",
            "Downloads 폴더 정리": "Clean up Downloads",
            "옮기는 대신 지우거나 치울 만한 것을 찾아요. 지운 파일은 휴지통으로 가고, 되돌릴 수 있어요.": "Finds things to delete or put away instead of sorting. Deleted files go to the Trash and can be restored.",
            "{0}개 선택 · {1} 확보": "{0} selected · frees {1}", "{0}개 처리하기": "Fix {0}", "{0}개를 처리할까요?": "Fix {0} items?",
            "치울 것이 없어요.": "Nothing to clean up.",
            // organize
            "Downloads, 어떻게 정리할까요?": "How should we sort Downloads?",
            "파일 {0}개 · {1}. 적용하기 전까지는 아무것도 바뀌지 않아요.": "{0} files · {1}. Nothing changes until you apply.",
            "예정표 만들기": "Build move plan", "최근 {0}일 안에 받은 파일은 그대로 둬요.": "Files downloaded in the last {0} days stay put.",
            "구간 안에서 종류별로 한 번 더 나누기": "Split each bucket by file kind", "만들 위치: {0}": "Creates folders in {0}",
            "Chrome 북마크 참고": "Uses Chrome bookmarks", "넣을 수 있는 폴더": "Target folders",
            "파일을 넣을 기존 폴더를 추가하세요. 추가한 폴더에만 접근해요.": "Add the folders files may go into. Tidymark only touches folders you add.",
            "추가": "Add", "폴더 추가…": "Add folder…", "이동 예정표": "Move plan", "{0}개 선택": "{0} selected",
            "{0}개 옮기기": "Move {0}", "{0}개를 적용할까요?": "Apply {0} changes?", "정리할 파일이 없어요.": "Nothing to sort.",
            "휴지통으로 보낸 파일도 ‘되돌리기’로 원래 자리에 돌려놓을 수 있어요.": "Even files sent to the Trash go back where they were with Undo.",
            "검토 필요": "Needs review", "Finder에서 보기": "Show in Finder", "되돌리기": "Undo", "새로고침": "Refresh",
            // menu bar
            "처음 한 번 설정이 필요해요.": "A one-time setup is needed.", "시작하기": "Get started",
            "Downloads · 파일 {0}개 · {1}": "Downloads · {0} files · {1}",
            "치울 수 있는 것 {0}개 · {1} 확보": "{0} things to clean up · frees {1}",
            "정리 스튜디오 열기": "Open studio", "방금 받은 파일": "Just downloaded", "옮기기": "Move",
            "새 다운로드 감시": "Watch new downloads", "종료": "Quit",
            "Downloads 폴더에 접근할 수 없어요.": "Tidymark can't access Downloads.",
            "시스템 설정 › 개인정보 보호 및 보안 › 파일 및 폴더에서 Tidymark의 ‘다운로드 폴더’를 켜 주세요.": "Turn on ‘Downloads Folder’ for Tidymark in System Settings › Privacy & Security › Files and Folders.",
            "시스템 설정 열기": "Open System Settings", "다시 확인": "Check again",
            // settings
            "정리 폴더": "Tidymark folder", "새 폴더를 만들 곳": "Create new folders in", "변경…": "Change…",
            "A·C·D 방식과 스크린샷 정리는 이 폴더 안에만 폴더를 만들어요.": "Modes A, C and D and screenshot cleanup only create folders inside this one.",
            "B · 기존 폴더로": "B · Into your folders", "정리 규칙": "Rules",
            "최근 {0}일 안에 받은 파일은 건드리지 않기": "Leave files downloaded in the last {0} days alone",
            "Chrome 북마크 폴더 참고하기": "Use Chrome bookmark folders",
            "받은 파일의 사이트가 북마크의 ‘여행 / 포르투갈’ 폴더에 있으면 같은 이름의 폴더를 제안해요. 북마크는 이 Mac 안에서만 읽어요.": "If a file came from a site you bookmarked under ‘Travel / Portugal’, it suggests a folder of that name. Bookmarks are read on this Mac only.",
            "새 다운로드": "New downloads", "Downloads 폴더 감시": "Watch the Downloads folder",
            "받은 파일마다 옮길 곳 알림": "Suggest a destination for each download", "로그인할 때 실행": "Open at login",
            "언어": "Language", "시스템 언어": "System", "개인정보": "Privacy",
            "파일 내용은 읽지 않아요. 파일 이름, 종류, 받은 날짜, 마지막으로 연 날짜, 받은 사이트 주소만 이 Mac 안에서 사용하고, 어디로도 보내지 않아요.": "Tidymark never reads file contents. It uses only names, kinds, download dates, last-opened dates and source addresses, on this Mac, and sends nothing anywhere.",
            "파일 접근 권한 설정 열기": "Open file access settings", "선택": "Choose",
            // onboarding
            "받아 둔 파일도 제자리를 찾아요": "Every download in its place",
            "Downloads 폴더를 읽어요": "Tidymark reads your Downloads folder",
            "다음 단계에서 macOS가 ‘다운로드 폴더 접근’을 물어보면 허용을 눌러 주세요. 파일 내용은 읽지 않고, 어디로도 보내지 않아요.": "When macOS asks for access to your Downloads folder next, choose Allow. File contents are never read or sent anywhere.",
            "정리 폴더를 정해요": "Pick a home for sorted files",
            "새 폴더는 {0} 안에만 만들어요. 설정에서 바꿀 수 있어요.": "New folders are created only inside {0}. You can change this in Settings.",
            "적용하기 전엔 아무것도 바뀌지 않아요": "Nothing changes until you apply",
            "항상 이동 예정표를 먼저 보여 주고, 지운 파일은 휴지통으로 보내고, 되돌릴 수 있어요.": "You always see a move plan first, deletions go to the Trash, and everything can be undone.",
            "Downloads 접근 허용하고 시작하기": "Allow Downloads access and start",
        ]
    }
}
