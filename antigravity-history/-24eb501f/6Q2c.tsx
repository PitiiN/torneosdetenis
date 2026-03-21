'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { initNativeApp } from '@/lib/capacitor/native';
import { initPushNotifications } from '@/lib/capacitor/pushNotifications';
import { isNative, getPlatform } from '@/lib/capacitor/platform';

/**
 * Componente que inicializa todas las funciones nativas de Capacitor.
 * Se monta una sola vez en el layout principal.
 * Solo actúa cuando la app corre en un dispositivo nativo.
 */
export default function CapacitorInit() {
    const initialized = useRef(false);

    useEffect(() => {
        if (initialized.current) return;
        if (!isNative()) return;

        initialized.current = true;

        const setup = async () => {
            // 1. Inicializar funciones nativas (StatusBar, Back button, Splash)
            await initNativeApp();

            // 2. Inicializar Push Notifications
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                await initPushNotifications({
                    onTokenReceived: async (token) => {
                        // Guardar token en Supabase
                        const { error } = await supabase
                            .from('push_tokens')
                            .upsert(
                                {
                                    user_id: user.id,
                                    token,
                                    platform: getPlatform(),
                                    is_active: true,
                                    device_info: {
                                        userAgent: navigator.userAgent,
                                        language: navigator.language,
                                    },
                                },
                                { onConflict: 'user_id,token' }
                            );

                        if (error) {
                            console.error('[CapacitorInit] Error guardando push token:', error);
                        } else {
                            console.log('[CapacitorInit] Push token guardado exitosamente');
                        }
                    },
                    onNotificationReceived: (notification) => {
                        // Notificación recibida en foreground — podría mostrar un toast
                        console.log('[CapacitorInit] Notificación foreground:', notification);
                    },
                    onNotificationTapped: (notification) => {
                        // El usuario tocó la notificación — navegar según data
                        console.log('[CapacitorInit] Notificación tocada:', notification);
                        const data = notification.data;
                        if (data?.url && typeof data.url === 'string') {
                            window.location.href = data.url;
                        }
                    },
                });
            }
        };

        setup().catch(console.error);
    }, []);

    // Este componente no renderiza nada visible
    return null;
}
