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

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
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
