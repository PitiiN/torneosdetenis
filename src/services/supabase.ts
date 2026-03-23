import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const ExpoSecureStoreAdapter = {
    getItem: (key: string) => SecureStore.getItemAsync(key),
    setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value, SECURE_STORE_OPTIONS),
    removeItem: (key: string) => SecureStore.deleteItemAsync(key),
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

const SESSION_ARTIFACT_KEYS = ['selected_org_id', 'selected_org_name'];

export async function clearSessionArtifacts() {
    await Promise.allSettled(
        SESSION_ARTIFACT_KEYS.map((key) => SecureStore.deleteItemAsync(key))
    );
}

export async function secureSignOut() {
    const response = await supabase.auth.signOut();
    await clearSessionArtifacts();
    return response;
}
