import { useState } from 'react';
import { View, Text, Pressable, Alert, ActivityIndicator, Platform } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as AppleAuthentication from 'expo-apple-authentication';
import { signInWithGoogle, signInWithApple } from '@/services/auth';

export default function LoginScreen() {
  const [loading, setLoading] = useState<'google' | 'apple' | null>(null);

  const handleGoogleLogin = async () => {
    setLoading('google');
    try {
      await signInWithGoogle();
    } catch (error: any) {
      // 사용자가 취소한 경우는 무시
      if (error.code !== 'SIGN_IN_CANCELLED' && error.code !== '12501') {
        Alert.alert('로그인 실패', error.message || '다시 시도해주세요.');
      }
    } finally {
      setLoading(null);
    }
  };

  const handleAppleLogin = async () => {
    setLoading('apple');
    try {
      await signInWithApple();
    } catch (error: any) {
      // 사용자가 취소한 경우는 무시
      if (error.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('로그인 실패', error.message || '다시 시도해주세요.');
      }
    } finally {
      setLoading(null);
    }
  };

  return (
    <View className="flex-1 bg-background dark:bg-background-dark justify-center px-6">
      <View className="items-center mb-16">
        <View className="w-20 h-20 rounded-2xl bg-primary items-center justify-center mb-4">
          <FontAwesome name="link" size={36} color="#FFFFFF" />
        </View>
        <Text className="text-3xl font-bold text-text dark:text-text-dark">
          LinkVault
        </Text>
        <Text className="mt-2 text-base text-text-secondary dark:text-text-dark-secondary">
          모든 링크, 알아서 정리됩니다
        </Text>
      </View>

      <View className="gap-3">
        <Pressable
          onPress={handleGoogleLogin}
          disabled={loading !== null}
          className="flex-row items-center justify-center py-4 rounded-xl bg-white dark:bg-surface-dark border border-surface dark:border-surface-dark active:opacity-80"
        >
          {loading === 'google' ? (
            <ActivityIndicator size="small" color="#111827" />
          ) : (
            <>
              <FontAwesome name="google" size={20} color="#4285F4" style={{ marginRight: 10 }} />
              <Text className="text-base font-semibold text-text dark:text-text-dark">
                Google로 시작하기
              </Text>
            </>
          )}
        </Pressable>

        {Platform.OS === 'ios' && (
          <Pressable
            onPress={handleAppleLogin}
            disabled={loading !== null}
            className="flex-row items-center justify-center py-4 rounded-xl bg-black dark:bg-white active:opacity-80"
          >
            {loading === 'apple' ? (
              <ActivityIndicator size="small" color={Platform.OS === 'ios' ? '#FFFFFF' : '#000000'} />
            ) : (
              <>
                <FontAwesome name="apple" size={22} color="#FFFFFF" style={{ marginRight: 10 }} />
                <Text className="text-base font-semibold text-white dark:text-black">
                  Apple로 시작하기
                </Text>
              </>
            )}
          </Pressable>
        )}
      </View>

      <Text className="text-xs text-text-secondary dark:text-text-dark-secondary text-center mt-8 leading-4">
        로그인 시 이용약관 및 개인정보처리방침에 동의하게 됩니다.
      </Text>
    </View>
  );
}
