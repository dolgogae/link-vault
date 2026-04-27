import messaging from '@react-native-firebase/messaging';
import { PermissionsAndroid, Platform } from 'react-native';
import { setDoc } from '@react-native-firebase/firestore';
import { getUserRef } from '@/utils/firestore';

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }
  // Android < 13 doesn't need runtime permission
  return true;
}

export async function registerFCMToken(userId: string): Promise<void> {
  try {
    const token = await messaging().getToken();
    if (token) {
      await setDoc(getUserRef(userId), { fcmToken: token }, { merge: true });
    }
  } catch (error) {
    console.warn('FCM 토큰 등록 실패:', error);
  }
}

export function setupTokenRefreshListener(userId: string): () => void {
  return messaging().onTokenRefresh(async (token) => {
    try {
      await setDoc(getUserRef(userId), { fcmToken: token }, { merge: true });
    } catch (error) {
      console.warn('FCM 토큰 갱신 실패:', error);
    }
  });
}

export function setupForegroundMessageHandler(
  onMessage: (title: string, body: string, data?: Record<string, string>) => void,
): () => void {
  return messaging().onMessage(async (remoteMessage) => {
    const title = remoteMessage.notification?.title || '';
    const body = remoteMessage.notification?.body || '';
    const data = remoteMessage.data as Record<string, string> | undefined;
    onMessage(title, body, data);
  });
}
