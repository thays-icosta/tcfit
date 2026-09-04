import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabaseClient';

// Must match the public half of the VAPID key pair the send-message-push
// edge function signs with — see that function's VAPID_PUBLIC_KEY.
const VAPID_PUBLIC_KEY = 'BBG-pkKsXvatt8CsDfreH8lNqybc-4S8zoRfLt22Kv-UawepAROQ5RhAGuNFr-Hl6nZ9axCPmq2KlUFwBXvY_p0';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Both TcFit surfaces (Android and iOS) install as a browser PWA now, so Web
// Push — subscribe via the service worker's PushManager, save the
// subscription — is the real delivery path.
async function registerWebPush(userId) {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') return;

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') return;

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }
  await supabase.from('users').update({ web_push_subscription: subscription.toJSON() }).eq('id', userId);
}

// Requests permission and saves this device's push registration on the
// signed-in user's row so the `messages` DB trigger can reach them. The Expo
// push token path below is kept as a dormant fallback in case a native build
// ever comes back — it simply won't run while every user is on the PWA.
export async function registerPushToken(userId) {
  if (!userId) return;

  if (Platform.OS === 'web') {
    try {
      await registerWebPush(userId);
    } catch (e) {
      console.log('registerWebPush failed', e?.message);
    }
    return;
  }

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
// Native only — the web path routes through a notificationclick URL instead
// (see app/(tabs)/index.tsx reading chatPersonalId/chatStudentId params).
export function extractChatTarget(response) {
  const data = response?.notification?.request?.content?.data;
  if (!data || data.type !== 'chat') return null;
  return { personalId: data.personalId || null, studentId: data.studentId || null };
}
