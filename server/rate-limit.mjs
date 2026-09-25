// Fixed one-minute window per client. perMinute <= 0 turns limiting off.
export function createRateLimiter({ perMinute = 0, now = () => Date.now() } = {}) {
  const windows = new Map();
  return {
    allow(key) {
      if (perMinute <= 0) return true;
      const minute = Math.floor(now() / 60_000);
      const entry = windows.get(key);
      if (!entry || entry.minute !== minute) {
        if (windows.size > 10_000) windows.clear();
        windows.set(key, { minute, count: 1 });
        return true;
      }
      entry.count += 1;
      return entry.count <= perMinute;
    },
  };
}
