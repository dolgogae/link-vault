import { useState } from 'react';
import { View, Text, Pressable, Alert, ActivityIndicator, Platform, TextInput } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as AppleAuthentication from 'expo-apple-authentication';
import { signInWithGoogle, signInWithApple, signUpWithEmail, signInWithEmail } from '@/services/auth';

export default function LoginScreen() {
  const [loading, setLoading] = useState<'google' | 'apple' | 'email' | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  const handleEmailAuth = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('입력 오류', '이메일과 비밀번호를 입력해주세요.');
      return;
    }
    if (isSignUp && !displayName.trim()) {
      Alert.alert('입력 오류', '닉네임을 입력해주세요.');
      return;
    }

    setLoading('email');
    try {
      if (isSignUp) {
        await signUpWithEmail(email.trim(), password, displayName.trim());
      } else {
        await signInWithEmail(email.trim(), password);
      }
    } catch (error: any) {
      const message = getFirebaseAuthErrorMessage(error.code) || error.message || '다시 시도해주세요.';
      Alert.alert(isSignUp ? '회원가입 실패' : '로그인 실패', message);
    } finally {
      setLoading(null);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading('google');
    try {
      await signInWithGoogle();
    } catch (error: any) {
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
      if (error.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('로그인 실패', error.message || '다시 시도해주세요.');
      }
    } finally {
      setLoading(null);
    }
  };

  return (
    <View className="flex-1 bg-background dark:bg-background-dark justify-center px-6">
      <View className="items-center mb-12">
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

      <View className="gap-3 mb-4">
        {isSignUp && (
          <TextInput
            className="py-3.5 px-4 rounded-xl bg-white dark:bg-surface-dark border border-surface dark:border-surface-dark text-text dark:text-text-dark"
            placeholder="닉네임"
            placeholderTextColor="#9CA3AF"
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="none"
          />
        )}
        <TextInput
          className="py-3.5 px-4 rounded-xl bg-white dark:bg-surface-dark border border-surface dark:border-surface-dark text-text dark:text-text-dark"
          placeholder="이메일"
          placeholderTextColor="#9CA3AF"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <TextInput
          className="py-3.5 px-4 rounded-xl bg-white dark:bg-surface-dark border border-surface dark:border-surface-dark text-text dark:text-text-dark"
          placeholder="비밀번호"
          placeholderTextColor="#9CA3AF"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
        />
        <Pressable
          onPress={handleEmailAuth}
          disabled={loading !== null}
          className="items-center justify-center py-4 rounded-xl bg-primary active:opacity-80"
        >
          {loading === 'email' ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text className="text-base font-semibold text-white">
              {isSignUp ? '회원가입' : '로그인'}
            </Text>
          )}
        </Pressable>

        <Pressable onPress={() => setIsSignUp(!isSignUp)} className="items-center py-2">
          <Text className="text-sm text-text-secondary dark:text-text-dark-secondary">
            {isSignUp ? '이미 계정이 있으신가요? ' : '계정이 없으신가요? '}
            <Text className="text-primary font-semibold">
              {isSignUp ? '로그인' : '회원가입'}
            </Text>
          </Text>
        </Pressable>
      </View>

      <View className="flex-row items-center mb-4">
        <View className="flex-1 h-px bg-surface dark:bg-surface-dark" />
        <Text className="mx-4 text-sm text-text-secondary dark:text-text-dark-secondary">또는</Text>
        <View className="flex-1 h-px bg-surface dark:bg-surface-dark" />
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

function getFirebaseAuthErrorMessage(code: string): string | null {
  switch (code) {
    case 'auth/email-already-in-use':
      return '이미 사용 중인 이메일입니다.';
    case 'auth/invalid-email':
      return '올바른 이메일 형식이 아닙니다.';
    case 'auth/weak-password':
      return '비밀번호는 6자 이상이어야 합니다.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return '이메일 또는 비밀번호가 올바르지 않습니다.';
    case 'auth/too-many-requests':
      return '너무 많은 시도가 있었습니다. 잠시 후 다시 시도해주세요.';
    default:
      return null;
  }
}
