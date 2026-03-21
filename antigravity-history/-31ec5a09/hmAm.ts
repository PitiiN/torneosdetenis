import { supabase } from '../lib/supabase';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const pushService = {
    // Register push token
    async registerPushToken(userId: string, organizationId: string) {
        if (Platform.OS === 'web') return; // Push not supported on web MVP

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            console.log('Failed to get push token for push notification!');
            return;
        }

        try {
            const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID; // Need to set this usually
            const token = (await Notifications.getExpoPushTokenAsync({
                projectId: projectId ?? 'your-project-id',
            })).data;

            console.log('Push token:', token);

            // Save to Supabase
            const { error } = await supabase
                .from('push_tokens')
                .upsert({
                    user_id: userId,
                    organization_id: organizationId,
                    platform: Platform.OS,
                    token: token,
                    enabled: true,
                    last_seen_at: new Date().toISOString()
                }, {
                    onConflict: 'platform,token'
                });

            if (error) throw error;

        } catch (e) {
            console.error('Error getting or saving push token:', e);
        }
    },

    // Send a push notification by calling Edge Function
    async sendPushNotification(payload: {
        organization_id: string;
        title: string;
        body: string;
        type: string;
        deep_link?: string;
    }) {
        const { data, error } = await supabase.functions.invoke('send_push', {
            body: payload
        });

        if (error) throw error;
        return data;
    }
};
