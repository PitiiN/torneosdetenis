import * as ExpoSecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export async function setItemAsync(key: string, value: string, options?: any) {
    if (Platform.OS === 'web') {
        localStorage.setItem(key, value);
        return Promise.resolve();
    }
    return ExpoSecureStore.setItemAsync(key, value, options);
}

export async function getItemAsync(key: string) {
    if (Platform.OS === 'web') {
        return Promise.resolve(localStorage.getItem(key));
    }
    return ExpoSecureStore.getItemAsync(key);
}

export async function deleteItemAsync(key: string) {
    if (Platform.OS === 'web') {
        localStorage.removeItem(key);
        return Promise.resolve();
    }
    return ExpoSecureStore.deleteItemAsync(key);
}
