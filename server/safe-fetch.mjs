import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import process from "node:process";

const MAX_REDIRECTS = 5;

// Public deployments fetch user-supplied URLs, so they must not reach the host's
// private network or the cloud metadata server (169.254.169.254).
function ipv4Blocked(ip) {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

export function isBlockedAddress(ip) {
  if (isIP(ip) === 4) return ipv4Blocked(ip);
  const lower = ip.toLowerCase();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (mapped) return ipv4Blocked(mapped[1]);
  return (
    lower === "::" || lower === "::1" ||
    /^f[cd]/.test(lower) || // unique local
    /^fe[89ab]/.test(lower) || // link-local
    lower.startsWith("ff") // multicast
  );
}

async function assertPublicUrl(url, resolve) {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new TypeError("http(s) 주소만 열 수 있습니다.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [{ address: host }] : await resolve(host, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isBlockedAddress(address))) {
    const error = new TypeError("내부 네트워크 주소는 열 수 없습니다.");
    error.code = "EBLOCKED";
    throw error;
  }
}

// fetch() that re-checks every redirect hop against the blocklist.
export function createSafeFetch({ fetchImpl = fetch, resolve = lookup } = {}) {
  return async function safeFetch(input, init = {}) {
    let url = new URL(input);
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      await assertPublicUrl(url, resolve);
      const response = await fetchImpl(url, { ...init, redirect: "manual" });
      const location = response.headers.get("location");
      if (response.status < 300 || response.status > 399 || !location) return response;
      await response.body?.cancel().catch(() => {});
      url = new URL(location, url);
    }
    throw new TypeError("리디렉션이 너무 많습니다.");
  };
}

const safeFetch = createSafeFetch();

// Local runs keep plain fetch so intranet bookmarks still work. Checked per call
// because index.mjs loads .env after this module is imported.
export function outboundFetch(input, init) {
  return process.env.TIDYMARK_PUBLIC === "1" ? safeFetch(input, init) : fetch(input, init);
}
