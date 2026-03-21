import { Capacitor } from '@capacitor/core';

/**
 * Detecta si la app está corriendo dentro de Capacitor (nativo) o en un browser
 */
export const isNative = (): boolean => {
    return Capacitor.isNativePlatform();
};

/**
 * Obtiene la plataforma actual: 'ios', 'android', o 'web'
 */
export const getPlatform = (): string => {
    return Capacitor.getPlatform();
};

/**
 * Verifica si la app está corriendo en iOS
 */
export const isIOS = (): boolean => {
    return Capacitor.getPlatform() === 'ios';
};

/**
 * Verifica si la app está corriendo en Android
 */
export const isAndroid = (): boolean => {
    return Capacitor.getPlatform() === 'android';
};

/**
 * Verifica si la app está corriendo en un navegador web
 */
export const isWeb = (): boolean => {
    return Capacitor.getPlatform() === 'web';
};
