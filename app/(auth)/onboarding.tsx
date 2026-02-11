import { useState, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  Dimensions,
  ViewToken,
} from 'react-native';
import { router } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

const { width } = Dimensions.get('window');

const slides = [
  {
    id: '1',
    icon: 'share-alt' as const,
    title: '링크를 공유하면\nAI가 알아서 정리합니다',
    subtitle: '브라우저, SNS 어디서든 공유 한 번으로 저장',
  },
  {
    id: '2',
    icon: 'folder-open' as const,
    title: '폴더처럼 깔끔하게\n탐색하세요',
    subtitle: 'AI가 자동으로 분류한 카테고리를 한눈에',
  },
  {
    id: '3',
    icon: 'globe' as const,
    title: '어디서든, 무엇이든\n아카이빙',
    subtitle: '인스타, 유튜브, 뉴스, 논문까지 모두 저장',
  },
];

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
  ).current;

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      router.replace('/(auth)/login');
    }
  };

  const handleSkip = () => {
    router.replace('/(auth)/login');
  };

  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      {/* Skip 버튼 */}
      <View className="absolute top-14 right-6 z-10">
        <Pressable onPress={handleSkip}>
          <Text className="text-text-secondary dark:text-text-dark-secondary text-base">
            건너뛰기
          </Text>
        </Pressable>
      </View>

      {/* 슬라이드 */}
      <FlatList
        ref={flatListRef}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View
            style={{ width }}
            className="flex-1 items-center justify-center px-10"
          >
            <View className="w-24 h-24 rounded-full bg-primary/10 items-center justify-center mb-10">
              <FontAwesome name={item.icon} size={40} color="#2563EB" />
            </View>
            <Text className="text-2xl font-bold text-text dark:text-text-dark text-center leading-9">
              {item.title}
            </Text>
            <Text className="mt-4 text-base text-text-secondary dark:text-text-dark-secondary text-center">
              {item.subtitle}
            </Text>
          </View>
        )}
      />

      {/* 인디케이터 + 버튼 */}
      <View className="pb-16 px-6 items-center">
        {/* 도트 인디케이터 */}
        <View className="flex-row gap-2 mb-8">
          {slides.map((_, index) => (
            <View
              key={index}
              className={`h-2 rounded-full ${
                index === currentIndex
                  ? 'w-6 bg-primary'
                  : 'w-2 bg-text-secondary/30'
              }`}
            />
          ))}
        </View>

        {/* 다음/시작 버튼 */}
        <Pressable
          onPress={handleNext}
          className="w-full bg-primary py-4 rounded-xl items-center active:bg-primary-dark"
        >
          <Text className="text-white text-lg font-semibold">
            {currentIndex === slides.length - 1 ? '시작하기' : '다음'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
