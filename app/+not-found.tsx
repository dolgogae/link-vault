import { Link, Stack } from 'expo-router';
import { View, Text } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: '페이지를 찾을 수 없습니다' }} />
      <View className="flex-1 items-center justify-center p-5 bg-background dark:bg-background-dark">
        <Text className="text-xl font-bold text-text dark:text-text-dark">
          페이지를 찾을 수 없습니다
        </Text>
        <Link href="/" className="mt-4 py-4">
          <Text className="text-sm text-primary">홈으로 돌아가기</Text>
        </Link>
      </View>
    </>
  );
}
