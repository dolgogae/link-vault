import { useState } from 'react';
import { View, Text, Pressable, Alert, ScrollView, ActivityIndicator, Linking } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { signOut, deleteAccount } from '@/services/auth';
import { purchaseSubscription, ErrorCode } from '@/services/subscription';
import { runCleanupManual } from '@/services/categories';
import Constants from 'expo-constants';

export default function SettingsScreen() {
  const { user } = useAuthStore();
  const { plan, monthlyLinksSaved } = useSubscriptionStore();
  const [isCleaning, setIsCleaning] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);

  const handleCleanup = async () => {
    setIsCleaning(true);
    try {
      const result = await runCleanupManual();
      Alert.alert(
        '정리 완료',
        `이모지 제거: ${result.cleanedCount}건\n중복 병합: ${result.mergedCount}건`,
      );
    } catch (error: any) {
      Alert.alert('오류', error.message || '데이터 정리에 실패했습니다.');
    } finally {
      setIsCleaning(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('로그아웃', '정말 로그아웃하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        onPress: async () => {
          await signOut();
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      '계정 삭제',
      '계정을 삭제하면 모든 데이터가 영구적으로 삭제됩니다. 계속하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount();
            } catch (error: any) {
              Alert.alert('오류', error.message || '계정 삭제에 실패했습니다.');
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView className="flex-1 bg-background dark:bg-background-dark">
      <View className="items-center pt-6 pb-8">
        <View className="w-16 h-16 rounded-full bg-primary/10 items-center justify-center mb-3">
          <FontAwesome name="user" size={28} color="#8000C8" />
        </View>
        <Text className="text-lg font-semibold text-text dark:text-text-dark">
          {user?.displayName || '사용자'}
        </Text>
        <Text className="text-sm text-text-secondary dark:text-text-dark-secondary mt-0.5">
          {user?.email || ''}
        </Text>
      </View>

      <SectionHeader title="구독" />
      {plan === 'premium' ? (
        <>
          <SettingRow
            icon="star"
            label="현재 플랜"
            value="프리미엄"
          />
          <SettingRow
            icon="cog"
            label="구독 관리"
            onPress={() => Linking.openURL('https://play.google.com/store/account/subscriptions')}
          />
        </>
      ) : (
        <>
          <SettingRow
            icon="star-o"
            label="현재 플랜"
            value="무료"
          />
          <SettingRow
            icon="bar-chart"
            label="이번 달 저장"
            value={`${monthlyLinksSaved} / 30`}
          />
          <SettingRow
            icon="diamond"
            label="프리미엄으로 업그레이드"
            onPress={async () => {
              if (isPurchasing) return;
              setIsPurchasing(true);
              try {
                await purchaseSubscription();
              } catch (error: any) {
                if (error.code !== ErrorCode.UserCancelled) {
                  Alert.alert('오류', error.message || '구매 처리에 실패했습니다.');
                }
              } finally {
                setIsPurchasing(false);
              }
            }}
            right={
              isPurchasing ? (
                <ActivityIndicator size="small" color="#8000C8" />
              ) : undefined
            }
          />
        </>
      )}

      <SectionHeader title="정보" />
      <SettingRow
        icon="info-circle"
        label="버전"
        value={Constants.expoConfig?.version ?? '1.0.0'}
      />
      <SettingRow
        icon="shield"
        label="개인정보처리방침"
        onPress={() => router.push('/privacy')}
      />
      <SettingRow
        icon="file-text-o"
        label="이용약관"
        onPress={() => router.push('/terms')}
      />

      <SectionHeader title="데이터" />
      <SettingRow
        icon="magic"
        label="폴더 데이터 정리"
        onPress={handleCleanup}
        right={
          isCleaning ? (
            <ActivityIndicator size="small" color="#8000C8" />
          ) : undefined
        }
      />

      <SectionHeader title="계정" />
      <SettingRow icon="sign-out" label="로그아웃" onPress={handleSignOut} />
      <SettingRow
        icon="trash"
        label="계정 삭제"
        onPress={handleDeleteAccount}
        destructive
      />

      <View className="h-20" />
    </ScrollView>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="text-xs font-semibold text-text-secondary dark:text-text-dark-secondary uppercase tracking-wider px-4 pt-6 pb-2">
      {title}
    </Text>
  );
}

function SettingRow({
  icon,
  label,
  value,
  right,
  onPress,
  destructive,
}: {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  label: string;
  value?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-4 py-3.5 bg-background dark:bg-background-dark border-b border-surface dark:border-surface-dark active:bg-surface dark:active:bg-surface-dark"
    >
      <FontAwesome
        name={icon}
        size={18}
        color={destructive ? '#EF4444' : '#6B7280'}
        style={{ width: 28 }}
      />
      <Text
        className={`flex-1 text-base ${
          destructive
            ? 'text-red-500'
            : 'text-text dark:text-text-dark'
        }`}
      >
        {label}
      </Text>
      {right || (
        value ? (
          <Text className="text-sm text-text-secondary dark:text-text-dark-secondary">
            {value}
          </Text>
        ) : onPress ? (
          <FontAwesome name="chevron-right" size={12} color="#9CA3AF" />
        ) : null
      )}
    </Pressable>
  );
}
