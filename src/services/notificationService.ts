import type { Notification, NotificationResponse } from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

const isExpoGo = Constants.appOwnership === 'expo';

let notificationsModule: typeof import('expo-notifications') | null = null;
let notificationHandlerConfigured = false;

const getNotificationsModule = () => {
  if (isExpoGo) return null;
  if (!notificationsModule) {
    notificationsModule = require('expo-notifications');
  }
  return notificationsModule;
};

const ensureNotificationHandler = () => {
  const Notifications = getNotificationsModule();
  if (!Notifications || notificationHandlerConfigured) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  notificationHandlerConfigured = true;
};

export const notificationService = {
  /**
   * Register for push notifications and save the token to the user's profile
   */
  registerForPushNotifications: async (userId: string) => {
    if (!Device.isDevice || isExpoGo) {
      return null;
    }

    const Notifications = getNotificationsModule();
    if (!Notifications) {
      return null;
    }

    ensureNotificationHandler();

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      const hasPushPermission = String(finalStatus) === 'granted' || String(finalStatus) === 'provisional';
      if (!hasPushPermission) {
        return null;
      }

      const projectId =
        Constants.easConfig?.projectId ||
        (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ||
        process.env.EXPO_PUBLIC_EXPO_PROJECT_ID;

      if (!projectId) {
        return null;
      }

      const token = (await Notifications.getExpoPushTokenAsync({
        projectId,
      })).data;

      if (!token) {
        return null;
      }

      await supabase
        .from('profiles')
        .update({ expo_push_token: token })
        .eq('id', userId);

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      return token;
    } catch {
      return null;
    }
  },

  /**
   * Set up notification listeners
   */
  addNotificationListeners: (
    onNotificationReceived: (notification: Notification) => void,
    onNotificationResponse: (response: NotificationResponse) => void
  ) => {
    const Notifications = getNotificationsModule();
    if (!Notifications) {
      return () => {};
    }

    ensureNotificationHandler();

    const notificationListener = Notifications.addNotificationReceivedListener(onNotificationReceived);
    const responseListener = Notifications.addNotificationResponseReceivedListener(onNotificationResponse);

    return () => {
      notificationListener.remove();
      responseListener.remove();
    };
  },

  scheduleMatchReminders: async (matches: Array<{
    id: string;
    tournament_id: string;
    scheduled_at: string;
    tournamentName?: string | null;
    opponentLabel?: string | null;
  }>) => {
    const Notifications = getNotificationsModule();
    if (!Notifications || isExpoGo) return;

    ensureNotificationHandler();

    try {
      const { status } = await Notifications.getPermissionsAsync();
      const hasPermission = String(status) === 'granted' || String(status) === 'provisional';
      if (!hasPermission) return;

      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      await Promise.allSettled(
        scheduled
          .filter((notification: any) => String(notification?.content?.data?.type || '') === 'match_reminder_24h')
          .map((notification: any) => Notifications.cancelScheduledNotificationAsync(notification.identifier))
      );

      const now = Date.now();
      await Promise.allSettled(
        (matches || []).map((match) => {
          const matchTime = new Date(match.scheduled_at).getTime();
          const reminderTime = matchTime - 24 * 60 * 60 * 1000;
          if (!Number.isFinite(matchTime) || reminderTime <= now) return Promise.resolve();

          return Notifications.scheduleNotificationAsync({
            content: {
              title: 'Tu proximo partido se acerca',
              body: `${match.tournamentName || 'Torneo'}: juegas contra ${match.opponentLabel || 'rival por definir'} en 24 horas.`,
              sound: 'default',
              data: {
                type: 'match_reminder_24h',
                tournamentId: match.tournament_id,
                matchId: match.id,
              },
            },
            trigger: new Date(reminderTime) as any,
          });
        })
      );
    } catch (error) {
      console.warn('[notificationService] scheduleMatchReminders error:', error);
    }
  },
};
