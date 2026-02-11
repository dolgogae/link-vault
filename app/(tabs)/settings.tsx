import { View, Text, Pressable, Alert, ScrollView, Switch } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuthStore } from '@/stores/authStore';
import { signOut, deleteAccount } from '@/services/auth';

export default function SettingsScreen() {
  const { user } = useAuthStore();
  const colorScheme = useColorScheme();

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
      {/* 프로필 */}
      <View className="items-center pt-6 pb-8">
        <View className="w-16 h-16 rounded-full bg-primary/10 items-center justify-center mb-3">
          <FontAwesome name="user" size={28} color="#2563EB" />
        </View>
        <Text className="text-lg font-semibold text-text dark:text-text-dark">
          {user?.displayName || '사용자'}
        </Text>
        <Text className="text-sm text-text-secondary dark:text-text-dark-secondary mt-0.5">
          {user?.email || ''}
        </Text>
      </View>

      {/* 일반 설정 */}
      <SectionHeader title="일반" />
      <SettingRow
        icon="moon-o"
        label="다크 모드"
        right={
          <Text className="text-sm text-text-secondary dark:text-text-dark-secondary">
            {colorScheme === 'dark' ? '켜짐' : '꺼짐'} (시스템 연동)
          </Text>
        }
      />
      <SettingRow icon="external-link" label="링크 열기 방식" value="인앱 브라우저" />

      {/* 정보 */}
      <SectionHeader title="정보" />
      <SettingRow icon="info-circle" label="버전" value="1.0.0" />
      <SettingRow icon="shield" label="개인정보처리방침" />
      <SettingRow icon="file-text-o" label="이용약관" />

      {/* 계정 */}
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
