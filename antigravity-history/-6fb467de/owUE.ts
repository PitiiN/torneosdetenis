import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Share } from '@capacitor/share';
import { isNative, isAndroid } from './platform';

/**
 * Inicializa las funciones nativas de la app.
 * Llamar una vez al cargar la aplicación.
 */
export async function initNativeApp() {
    if (!isNative()) return;

    // Configurar status bar
    try {
        await StatusBar.setStyle({ style: Style.Dark });
        if (isAndroid()) {
            await StatusBar.setBackgroundColor({ color: '#1a1a2e' });
        }
    } catch (e) {
        console.warn('[Native] Error configurando StatusBar:', e);
    }

    // Escuchar botón "Atrás" en Android
    if (isAndroid()) {
        App.addListener('backButton', ({ canGoBack }) => {
            if (canGoBack) {
                window.history.back();
            } else {
                App.exitApp();
            }
        });
    }

    // Ocultar splash screen después de que cargue la web
    try {
        await SplashScreen.hide();
    } catch (e) {
        console.warn('[Native] Error ocultando SplashScreen:', e);
    }
}

/**
 * Vibración háptica al realizar una acción importante (ej: confirmar reserva)
 */
export async function hapticFeedback(style: 'light' | 'medium' | 'heavy' = 'medium') {
    if (!isNative()) return;

    const impactMap = {
        light: ImpactStyle.Light,
        medium: ImpactStyle.Medium,
        heavy: ImpactStyle.Heavy,
    };

    await Haptics.impact({ style: impactMap[style] });
}

/**
 * Compartir contenido nativo (ej: compartir horarios de canchas)
 */
export async function shareContent({
    title,
    text,
    url,
}: {
    title: string;
    text: string;
    url?: string;
}) {
    await Share.share({
        title,
        text,
        url: url ?? 'https://arriendocanchas.clubf2.com',
        dialogTitle: 'Compartir desde ArriendoCanchas',
    });
}
