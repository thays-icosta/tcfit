import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabaseClient';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Requests permission, grabs this device's Expo push token and saves it on
// the signed-in user's row so the `messages` DB trigger can reach them.
export async function registerPushToken(userId) {
  if (!userId || Platform.OS === 'web') return;

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    if (token) {
      await supabase.from('users').update({ expo_push_token: token }).eq('id', userId);
    }
  } catch (e) {
    console.log('registerPushToken failed', e?.message);
  }
}

// Reads a notification response's data payload (chat type only, for now)
// into the shape the home screens expect to auto-open a conversation.
export function extractChatTarget(response) {
  const data = response?.notification?.request?.content?.data;
  if (!data || data.type !== 'chat') return null;
  return { personalId: data.personalId || null, studentId: data.studentId || null };
}
