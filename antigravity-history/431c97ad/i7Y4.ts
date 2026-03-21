import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.clubf2.arriendocanchas',
    appName: 'ArriendoCanchas',
    webDir: 'out',

    // Live URL: carga la web de producción dentro del contenedor nativo
    server: {
        url: 'https://arriendocanchas.clubf2.com',
        cleartext: false,
    },

    plugins: {
        SplashScreen: {
            launchShowDuration: 2000,
            launchAutoHide: true,
            backgroundColor: '#1a1a2e',
            showSpinner: true,
            spinnerColor: '#16a34a',
            splashFullScreen: true,
            splashImmersive: true,
        },
        PushNotifications: {
            presentationOptions: ['badge', 'sound', 'alert'],
        },
        StatusBar: {
            style: 'DARK',
            backgroundColor: '#1a1a2e',
        },
    },

    // Configuraciones específicas por plataforma
    android: {
        allowMixedContent: false,
        backgroundColor: '#1a1a2e',
    },
    ios: {
        contentInset: 'automatic',
        backgroundColor: '#1a1a2e',
    },
};

export default config;
