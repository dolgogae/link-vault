import { useState } from 'react';
import { View, Text, Pressable, Alert, ActivityIndicator, Platform } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { signInWithGoogle, signInWithApple } from '@/services/auth';

type SocialProvider = 'google' | 'apple' | 'kakao' | 'naver';

export default function LoginScreen() {
  const [loading, setLoading] = useState<SocialProvider | null>(null);

  const handleLogin = async (provider: SocialProvider) => {
    setLoading(provider);
    try {
      switch (provider) {
        case 'google':
          await signInWithGoogle();
          break;
        case 'apple':
          await signInWithApple();
          break;
        case 'kakao':
          // 카카오 SDK 연동은 네이티브 모듈 설정 후 구현
          Alert.alert('안내', '카카오 로그인은 개발자 콘솔 설정 후 사용 가능합니다.');
          break;
        case 'naver':
          // 네이버 SDK 연동은 네이티브 모듈 설정 후 구현
          Alert.alert('안내', '네이버 로그인은 개발자 콘솔 설정 후 사용 가능합니다.');
          break;
      }
    } catch (error: any) {
      Alert.alert('로그인 실패', error.message || '다시 시도해주세요.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <View className="flex-1 bg-background dark:bg-background-dark justify-center px-6">
      {/* 로고 영역 */}
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

      {/* 소셜 로그인 버튼들 */}
      <View className="gap-3">
        {/* 카카오 */}
        <SocialButton
          onPress={() => handleLogin('kakao')}
          loading={loading === 'kakao'}
          bgColor="bg-[#FEE500]"
          textColor="text-[#191919]"
          label="카카오로 시작하기"
          icon="comment"
        />

        {/* 네이버 */}
        <SocialButton
          onPress={() => handleLogin('naver')}
          loading={loading === 'naver'}
          bgColor="bg-[#03C75A]"
          textColor="text-white"
          label="네이버로 시작하기"
          icon="bold"
        />

        {/* 구글 */}
        <SocialButton
          onPress={() => handleLogin('google')}
          loading={loading === 'google'}
          bgColor="bg-white dark:bg-surface-dark"
          textColor="text-text dark:text-text-dark"
          label="Google로 시작하기"
          icon="google"
          bordered
        />

        {/* 애플 (iOS만) */}
        {Platform.OS === 'ios' && (
          <SocialButton
            onPress={() => handleLogin('apple')}
            loading={loading === 'apple'}
            bgColor="bg-black dark:bg-white"
            textColor="text-white dark:text-black"
            label="Apple로 시작하기"
            icon="apple"
          />
        )}
      </View>

      {/* 하단 안내 */}
      <Text className="text-xs text-text-secondary dark:text-text-dark-secondary text-center mt-8">
        로그인 시 이용약관 및 개인정보처리방침에 동의하게 됩니다.
      </Text>
    </View>
  );
}

function SocialButton({
  onPress,
  loading,
  bgColor,
  textColor,
  label,
  icon,
  bordered,
}: {
  onPress: () => void;
  loading: boolean;
  bgColor: string;
  textColor: string;
  label: string;
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  bordered?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      className={`flex-row items-center justify-center py-4 rounded-xl ${bgColor} ${
        bordered ? 'border border-surface dark:border-surface-dark' : ''
      } active:opacity-80`}
    >
      {loading ? (
        <ActivityIndicator size="small" />
      ) : (
        <>
          <FontAwesome name={icon} size={20} className={textColor} style={{ marginRight: 10 }} />
          <Text className={`text-base font-semibold ${textColor}`}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}
