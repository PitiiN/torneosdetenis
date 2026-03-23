type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const runtimeCache = new Map<string, CacheEntry<unknown>>();

export function getCachedValue<T>(key: string): T | null {
  const entry = runtimeCache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    runtimeCache.delete(key);
    return null;
  }
  return entry.value;
}

export function setCachedValue<T>(key: string, value: T, ttlMs: number) {
  runtimeCache.set(key, {
    value,
    expiresAt: Date.now() + Math.max(500, ttlMs),
  });
}

export function clearCachedValue(key: string) {
  runtimeCache.delete(key);
}
