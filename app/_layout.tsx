import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { LogBox } from 'react-native';
import 'react-native-reanimated';

// nativewind(react-native-css-interop)이 deprecated RN SafeAreaView를 참조하는 라이브러리 이슈
LogBox.ignoreLogs(['SafeAreaView has been deprecated']);

import { useColorScheme } from '@/components/useColorScheme';
import { Colors } from '@/constants/theme';
import { useAuthStore } from '@/stores/authStore';
import { onAuthStateChanged, initializeGoogleSignIn } from '@/services/auth';
import { useShareIntentHandler } from '@/hooks/useShareIntent';

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

  // 인증 상태에 따른 리다이렉트
  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.replace('/(auth)/onboarding');
    } else {
      router.replace('/(tabs)');
    }
  }, [user, isLoading]);

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
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
