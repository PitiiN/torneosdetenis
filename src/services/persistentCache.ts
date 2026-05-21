import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const CACHE_KEY_PREFIX = '@sweetspot_cache:';

type PersistentEntry<T> = {
  value: T;
  expiresAt: number;
};

export async function setPersistedValue<T>(key: string, value: T, ttlMs: number): Promise<void> {
  const expiresAt = Date.now() + Math.max(500, ttlMs);
  const entry: PersistentEntry<T> = { value, expiresAt };
  const serialized = JSON.stringify(entry);
  const fullKey = CACHE_KEY_PREFIX + key;

  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(fullKey, serialized);
    } else {
      await AsyncStorage.setItem(fullKey, serialized);
    }
  } catch (error) {
    console.error(`Error setting persistent cache for key ${key}:`, error);
  }
}

export async function getPersistedValue<T>(key: string): Promise<T | null> {
  const fullKey = CACHE_KEY_PREFIX + key;
  try {
    let serialized: string | null = null;
    if (Platform.OS === 'web') {
      serialized = localStorage.getItem(fullKey);
    } else {
      serialized = await AsyncStorage.getItem(fullKey);
    }

    if (!serialized) return null;

    const entry = JSON.parse(serialized) as PersistentEntry<T>;
    if (entry.expiresAt < Date.now()) {
      await deletePersistedValue(key);
      return null;
    }
    return entry.value;
  } catch (error) {
    console.error(`Error getting persistent cache for key ${key}:`, error);
    return null;
  }
}

export async function deletePersistedValue(key: string): Promise<void> {
  const fullKey = CACHE_KEY_PREFIX + key;
  try {
    if (Platform.OS === 'web') {
      localStorage.removeItem(fullKey);
    } else {
      await AsyncStorage.removeItem(fullKey);
    }
  } catch (error) {
    console.error(`Error deleting persistent cache key ${key}:`, error);
  }
}

export async function clearAllPersistedValues(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      const keysToClear: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(CACHE_KEY_PREFIX)) {
          keysToClear.push(k);
        }
      }
      for (const k of keysToClear) {
        localStorage.removeItem(k);
      }
    } else {
      const allKeys = await (AsyncStorage as any).getAllKeys();
      const appKeys = allKeys.filter((k: string) => k.startsWith(CACHE_KEY_PREFIX));
      if (appKeys.length > 0) {
        await (AsyncStorage as any).multiRemove(appKeys);
      }
    }
  } catch (error) {
    console.error('Error clearing all persistent cache values:', error);
  }
}
