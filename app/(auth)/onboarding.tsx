import { View, Text } from 'react-native';

export default function OnboardingScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
      <Text className="text-2xl font-bold text-primary">LinkVault</Text>
      <Text className="mt-4 text-text-secondary dark:text-text-dark-secondary">
        온보딩 화면 (Phase 1에서 구현)
      </Text>
    </View>
  );
}
