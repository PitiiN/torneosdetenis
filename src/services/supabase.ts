import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as SecureStore from '@/utils/SecureStore';

const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const ExpoSecureStoreAdapter = {
    getItem: (key: string) => {
        if (Platform.OS === 'web') return Promise.resolve(localStorage.getItem(key));
        return SecureStore.getItemAsync(key);
    },
    setItem: (key: string, value: string) => {
        if (Platform.OS === 'web') {
            localStorage.setItem(key, value);
            return Promise.resolve();
        }
        return SecureStore.setItemAsync(key, value, SECURE_STORE_OPTIONS);
    },
    removeItem: (key: string) => {
        if (Platform.OS === 'web') {
            localStorage.removeItem(key);
            return Promise.resolve();
        }
        return SecureStore.deleteItemAsync(key);
    },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const supabaseConfigError = isSupabaseConfigured
    ? null
    : 'Missing Supabase environment variables: EXPO_PUBLIC_SUPABASE_URL and/or EXPO_PUBLIC_SUPABASE_ANON_KEY';

// Keep the app alive even if env vars are missing so we can show a controlled
// error screen instead of crashing on startup in production builds.
export const supabase = createClient(
    supabaseUrl || 'https://invalid.supabase.local',
    supabaseAnonKey || 'invalid-anon-key',
    {
    auth: {
        storage: ExpoSecureStoreAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});

const SESSION_ARTIFACT_KEYS = ['selected_org_id', 'selected_org_name', 'app_theme_preference'];

export async function clearSessionArtifacts() {
    await Promise.allSettled(
        SESSION_ARTIFACT_KEYS.map((key) => {
            if (Platform.OS === 'web') {
                localStorage.removeItem(key);
                return Promise.resolve();
            }
            return SecureStore.deleteItemAsync(key);
        })
    );
}

export async function secureSignOut() {
    const response = await supabase.auth.signOut();
    await clearSessionArtifacts();
    return response;
}
