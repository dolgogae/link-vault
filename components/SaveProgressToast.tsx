import { useEffect, useRef } from 'react';
import { View, Text, Animated, ActivityIndicator } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useLinkStore } from '@/stores/linkStore';

export function SaveProgressToast() {
  const { isSaving, saveResult, setSaveResult } = useLinkStore();
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const visible = isSaving || !!saveResult;

  useEffect(() => {
    if (visible) {
      // 슬라이드 다운
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 12,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }

    if (!isSaving && saveResult) {
      // 결과 표시 후 자동 숨김 (에러는 5초, 성공은 3초)
      const timeout = saveResult.type === 'error' ? 5000 : 3000;
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: -100,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setSaveResult(null);
        });
      }, timeout);
      return () => clearTimeout(timer);
    }
  }, [visible, isSaving, saveResult]);

  if (!visible) return null;

  const isSuccess = saveResult?.type === 'success';
  const isError = saveResult?.type === 'error';

  return (
    <Animated.View
      style={{
        transform: [{ translateY }],
        opacity,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
      }}
    >
      <View
        className={`mx-4 mt-14 px-4 py-3.5 rounded-2xl flex-row items-center ${
          isError
            ? 'bg-red-500'
            : isSuccess
              ? 'bg-green-500'
              : 'bg-primary'
        }`}
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        {isSaving && (
          <>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text className="text-white text-sm font-semibold ml-3 flex-1">
              링크 저장 중...
            </Text>
          </>
        )}
        {isSuccess && (
          <>
            <FontAwesome name="check-circle" size={18} color="#FFFFFF" />
            <View className="ml-3 flex-1">
              <Text className="text-white text-sm font-semibold">저장 완료</Text>
              <Text className="text-white/80 text-xs mt-0.5" numberOfLines={1}>
                {saveResult.categoryPath.join(' > ')}
              </Text>
            </View>
          </>
        )}
        {isError && (
          <>
            <FontAwesome name="exclamation-circle" size={18} color="#FFFFFF" />
            <Text className="text-white text-sm font-semibold ml-3 flex-1">
              {saveResult.message}
            </Text>
          </>
        )}
      </View>
    </Animated.View>
  );
}
