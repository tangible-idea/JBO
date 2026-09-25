// Server messages are written in Korean; English callers get these instead.
const en = new Map(Object.entries({
  "요청이 너무 큽니다.": "The request is too large.",
  "요청이 너무 많습니다. 잠시 후 다시 시도하세요.": "Too many requests. Try again in a minute.",
  "분류 요청에 실패했습니다. 서버 로그와 API 키를 확인하세요.": "Classification failed. Check the server logs and API key.",
  "일괄 분류 요청에 실패했습니다. 서버 로그와 API 키를 확인하세요.": "Batch classification failed. Check the server logs and API key.",
  "페이지 메타정보를 읽지 못했습니다.": "Couldn't read page info.",
  "관심사 분석에 실패했습니다. 서버 로그와 POE_API_KEY를 확인하세요.": "Interest analysis failed. Check the server logs and POE_API_KEY.",
  "폴더 이름을 변경하지 못했습니다. 서버 로그와 POE_API_KEY를 확인하세요.": "Couldn't rename folders. Check the server logs and POE_API_KEY.",
  "프로젝트 묶음 분석에 실패했습니다. 서버 로그와 POE_API_KEY를 확인하세요.": "Project analysis failed. Check the server logs and POE_API_KEY.",
  "링크를 확인하지 못했습니다.": "Couldn't check links.",
  "아직 분석한 관심사 리포트가 없습니다.": "No interest report yet.",
  "확인할 북마크가 없습니다.": "No bookmarks to check.",
  "요청 본문은 객체여야 합니다.": "The request body must be an object.",
  "페이지 제목 또는 URL이 필요합니다.": "A page title or URL is required.",
  "분류할 북마크 폴더가 없습니다.": "No bookmark folders to classify into.",
  "일괄 정리 카테고리는 두 개 이상 필요합니다.": "At least two categories are required.",
  "분류할 북마크가 없습니다.": "No bookmarks to classify.",
  "묶음 후보가 없습니다.": "No candidate groups.",
  "LLM 응답에서 JSON을 찾지 못했습니다.": "The LLM response contained no JSON.",
  "메타정보를 읽을 북마크가 없습니다.": "No bookmarks to read.",
  "관심사를 분석하려면 북마크가 3개 이상 필요합니다.": "At least 3 bookmarks are needed to analyze interests.",
  "폴더 이름 언어를 선택하세요.": "Choose a folder name language.",
  "변경할 폴더 구조가 올바르지 않습니다.": "The folder structure to rename is invalid.",
  "번역된 폴더 이름의 개수가 맞지 않습니다.": "The number of translated folder names doesn't match.",
  "폴더 이름을 선택한 언어로 변환하지 못했습니다.": "Couldn't convert folder names to the chosen language.",
  "번역된 폴더 이름이 중복됩니다.": "Translated folder names are duplicated.",
  "LLM이 폴더 구조를 충분히 제안하지 않았습니다.": "The LLM didn't suggest enough folders.",
  "POE_API_KEY가 설정되지 않았습니다.": "POE_API_KEY is not set.",
  "Poe API가 빈 응답을 반환했습니다.": "The Poe API returned an empty response.",
  // link check reasons
  "웹 주소가 아니에요": "Not a web address",
  "내부 네트워크 주소예요": "Private network address",
  "도메인이 없어요": "Domain doesn't exist",
  "응답 없음": "No response",
  "연결 실패": "Connection failed",
}));

const patterns = [
  [/^페이지 없음 \((\d+)\)$/, "Page not found ($1)"],
  [/^응답 (\d+)$/, "Response $1"],
  [/^Poe API 오류: /, "Poe API error: "],
  [/^LLM 응답이 길이 한도\((\d+) 토큰\)에서 잘렸습니다\.$/, "The LLM response was cut off at the $1-token limit."],
];

export function requestLanguage(request) {
  const header = String(request.headers["accept-language"] || "ko").trim().toLowerCase();
  return header.startsWith("ko") || header === "" ? "ko" : "en";
}

export function translate(language, message) {
  if (language !== "en" || typeof message !== "string") return message;
  if (en.has(message)) return en.get(message);
  for (const [pattern, replacement] of patterns) if (pattern.test(message)) return message.replace(pattern, replacement);
  return message;
}
