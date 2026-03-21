import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { isNative } from './platform';

/**
 * Inicializa push notifications y registra el dispositivo.
 * Solo funciona cuando la app corre dentro de Capacitor (nativo).
 * 
 * @param onTokenReceived - Callback con el token FCM para guardar en Supabase
 * @param onNotificationReceived - Callback cuando llega una notificación con la app abierta
 * @param onNotificationTapped - Callback cuando el usuario toca una notificación
 */
export async function initPushNotifications({
    onTokenReceived,
    onNotificationReceived,
    onNotificationTapped,
}: {
    onTokenReceived: (token: string) => void;
    onNotificationReceived?: (notification: { title?: string; body?: string; data?: Record<string, unknown> }) => void;
    onNotificationTapped?: (notification: { data?: Record<string, unknown> }) => void;
}) {
    if (!isNative()) {
        console.log('[Push] No es plataforma nativa, saltando inicialización');
        return;
    }

    // Solicitar permisos
    const permResult = await PushNotifications.requestPermissions();
    if (permResult.receive !== 'granted') {
        console.warn('[Push] Permisos no concedidos:', permResult.receive);
        return;
    }

    // Registrar el dispositivo para recibir push
    await PushNotifications.register();

    // Listener: Token recibido (enviar a backend)
    PushNotifications.addListener('registration', (token) => {
        console.log('[Push] Token registrado:', token.value);
        onTokenReceived(token.value);
    });

    // Listener: Error de registro
    PushNotifications.addListener('registrationError', (error) => {
        console.error('[Push] Error de registro:', error);
    });

    // Listener: Notificación recibida con la app abierta (foreground)
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('[Push] Notificación recibida (foreground):', notification);
        onNotificationReceived?.({
            title: notification.title ?? undefined,
            body: notification.body ?? undefined,
            data: notification.data as Record<string, unknown> | undefined,
        });
    });

    // Listener: Usuario toca la notificación
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('[Push] Notificación tocada:', action);
        onNotificationTapped?.({
            data: action.notification.data as Record<string, unknown> | undefined,
        });
    });
}

/**
 * Programa una notificación local (ej: recordatorio offline)
 */
export async function scheduleLocalNotification({
    title,
    body,
    scheduleAt,
    id,
}: {
    title: string;
    body: string;
    scheduleAt: Date;
    id: number;
}) {
    if (!isNative()) return;

    await LocalNotifications.schedule({
        notifications: [
            {
                id,
                title,
                body,
                schedule: { at: scheduleAt },
                sound: 'default',
            },
        ],
    });
}

/**
 * Cancela todas las notificaciones locales pendientes
 */
export async function cancelAllLocalNotifications() {
    if (!isNative()) return;
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
        await LocalNotifications.cancel(pending);
    }
}
