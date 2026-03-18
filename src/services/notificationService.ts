import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Alert } from 'react-native';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const notificationService = {
  /**
   * Register for push notifications and save the token to the user's profile
   */
  registerForPushNotifications: async (userId: string) => {
    if (!Device.isDevice) {
      console.log('Must use physical device for Push Notifications');
      return null;
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return null;
      }

      const token = (await Notifications.getExpoPushTokenAsync({
        projectId: 'YOUR_PROJECT_ID', // Replace with your actual Expo project ID
      })).data;

      console.log('Expo Push Token:', token);

      // Save token to Supabase
      const { error } = await supabase
        .from('profiles')
        .update({ expo_push_token: token })
        .eq('id', userId);

      if (error) {
        console.error('Error saving push token to profile:', error);
      }

      if (Platform.OS === 'android') {
        Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      return token;
    } catch (error) {
      console.error('Error in registerForPushNotifications:', error);
      return null;
    }
  },

  /**
   * Set up notification listeners
   */
  addNotificationListeners: (
    onNotificationReceived: (notification: Notifications.Notification) => void,
    onNotificationResponse: (response: Notifications.NotificationResponse) => void
  ) => {
    const notificationListener = Notifications.addNotificationReceivedListener(onNotificationReceived);
    const responseListener = Notifications.addNotificationResponseReceivedListener(onNotificationResponse);

    return () => {
      Notifications.removeNotificationSubscription(notificationListener);
      Notifications.removeNotificationSubscription(responseListener);
    };
  },
};
