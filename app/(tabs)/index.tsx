import { View, Text } from 'react-native';

export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background dark:bg-background-dark">
      <Text className="text-xl font-bold text-text dark:text-text-dark">
        LinkVault
      </Text>
      <Text className="mt-2 text-text-secondary dark:text-text-dark-secondary">
        모든 링크, 알아서 정리됩니다
      </Text>
    </View>
  );
}
