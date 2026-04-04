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
};
