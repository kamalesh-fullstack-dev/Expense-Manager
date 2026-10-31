// Fixed-window limiter held in memory, so it covers one server process.
// Use a shared store such as Redis if the app ever runs on several instances.
const windows = new Map<string, { count: number; resetAt: number }>();

export function isRateLimited(key: string, limit: number, windowMs: number, now = Date.now()) {
  if (windows.size > 10_000) {
    windows.forEach((entry, entryKey) => {
      if (entry.resetAt <= now) windows.delete(entryKey);
    });
  }

  const entry = windows.get(key);

  if (!entry || entry.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  entry.count += 1;
  return entry.count > limit;
}

export const clearRateLimit = (key: string) => {
  windows.delete(key);
};
