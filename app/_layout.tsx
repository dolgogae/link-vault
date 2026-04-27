import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import { Stack, Redirect } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { Colors } from '@/constants/theme';
import { useAuthStore } from '@/stores/authStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { onAuthStateChanged, initializeGoogleSignIn } from '@/services/auth';
import {
  initIAP, endIAP, verifyAndActivate, subscribeToUserPlan,
  setupPurchaseListeners, finishTransaction, ErrorCode,
} from '@/services/subscription';
import type { Purchase, PurchaseError } from '@/services/subscription';
import { useShareIntentHandler } from '@/hooks/useShareIntent';
import { SaveProgressToast } from '@/components/SaveProgressToast';
import {
  requestNotificationPermission,
  registerFCMToken,
  setupTokenRefreshListener,
  setupForegroundMessageHandler,
} from '@/services/notifications';
import { useLinkStore } from '@/stores/linkStore';

import '../global.css';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    initializeGoogleSignIn();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged((user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, [setUser, setLoading]);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { user, isLoading } = useAuthStore();

  // Share Extension 핸들러
  useShareIntentHandler();

  // IAP 초기화 + 구매 리스너
  useEffect(() => {
    initIAP();

    const { purchaseSub, errorSub } = setupPurchaseListeners(
      async (purchase: Purchase) => {
        const token = purchase.purchaseToken;
        const productId = purchase.productId;
        if (token && productId) {
          try {
            await verifyAndActivate(productId, token);
            await finishTransaction({ purchase });
          } catch (error) {
            console.error('Purchase verification failed:', error);
          }
        }
      },
      (error: PurchaseError) => {
        if (error.code !== ErrorCode.UserCancelled) {
          console.error('Purchase error:', error);
        }
      },
    );

    return () => {
      purchaseSub.remove();
      errorSub.remove();
      endIAP();
    };
  }, []);

  // FCM 알림 초기화
  useEffect(() => {
    const userId = user?.uid;
    if (!userId) return;

    let tokenRefreshUnsub: (() => void) | undefined;
    let foregroundUnsub: (() => void) | undefined;

    (async () => {
      const granted = await requestNotificationPermission();
      if (!granted) return;

      await registerFCMToken(userId);
      tokenRefreshUnsub = setupTokenRefreshListener(userId);
      foregroundUnsub = setupForegroundMessageHandler((title, body, data) => {
        if (data?.type === 'save_complete') {
          const categoryPath = data.categoryPath ? JSON.parse(data.categoryPath) as string[] : [];
          useLinkStore.getState().setSaveResult({ type: 'success', categoryPath });
        }
      });
    })();

    return () => {
      tokenRefreshUnsub?.();
      foregroundUnsub?.();
    };
  }, [user?.uid]);

  // 구독 상태 실시간 동기화
  useEffect(() => {
    const userId = user?.uid;
    if (!userId) return;

    const unsubscribe = subscribeToUserPlan(userId, (plan, monthlyUsage) => {
      useSubscriptionStore.getState().setPlan(plan);
      if (monthlyUsage) {
        useSubscriptionStore.getState().setUsage(monthlyUsage.period, monthlyUsage.linksSaved);
      }
      useSubscriptionStore.getState().setLoading(false);
    });

    return unsubscribe;
  }, [user?.uid]);

  const navigationTheme =
    colorScheme === 'dark'
      ? {
          ...DarkTheme,
          colors: {
            ...DarkTheme.colors,
            primary: Colors.dark.tint,
            background: Colors.dark.background,
            card: Colors.dark.surface,
            text: Colors.dark.text,
            border: Colors.dark.border,
          },
        }
      : {
          ...DefaultTheme,
          colors: {
            ...DefaultTheme.colors,
            primary: Colors.light.tint,
            background: Colors.light.background,
            card: Colors.light.surface,
            text: Colors.light.text,
            border: Colors.light.border,
          },
        };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={navigationTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack>
        {!isLoading && !user && <Redirect href="/(auth)/onboarding" />}
        <SaveProgressToast />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
