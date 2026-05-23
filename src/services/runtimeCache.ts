import { getPersistedValue, setPersistedValue, deletePersistedValue, deletePersistedValuesByPrefix } from './persistentCache';

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

export async function clearCachedValue(key: string) {
  runtimeCache.delete(key);
  await deletePersistedValue(key);
}

export async function clearCachedValuesByPrefix(prefix: string) {
  for (const k of runtimeCache.keys()) {
    if (k.startsWith(prefix)) {
      runtimeCache.delete(k);
    }
  }
  await deletePersistedValuesByPrefix(prefix);
}

export function clearAllCachedValues() {
  runtimeCache.clear();
}

/**
 * Resolves data from the fastest available cache layer (memory -> persistent -> network).
 */
export async function resolveCachedData<T>({
  key,
  ttlMs,
  fetchFn,
  persist = true,
}: {
  key: string;
  ttlMs: number;
  fetchFn: () => Promise<T>;
  persist?: boolean;
}): Promise<T> {
  // 1. Check in-memory runtime cache first
  const memoryValue = getCachedValue<T>(key);
  if (memoryValue !== null) {
    return memoryValue;
  }

  // 2. Check persistent cache if enabled
  if (persist) {
    const persistedValue = await getPersistedValue<T>(key);
    if (persistedValue !== null) {
      // Warm up the runtime cache in memory
      setCachedValue(key, persistedValue, ttlMs);
      return persistedValue;
    }
  }

  // 3. Fallback to executing the fetch function (network call)
  const freshData = await fetchFn();

  // Save to caches
  setCachedValue(key, freshData, ttlMs);
  if (persist) {
    await setPersistedValue(key, freshData, ttlMs);
  }

  return freshData;
}


