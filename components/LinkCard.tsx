import { useRef } from 'react';
import { View, Text, Pressable, Image, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Link } from '@/types';
import { getTimeAgo } from '@/utils/time';

interface LinkCardProps {
  link: Link;
  onPress: (link: Link) => void;
  onFavoritePress?: (link: Link) => void;
  onDeletePress?: (link: Link) => void;
  onMovePress?: (link: Link) => void;
  onLongPress?: (link: Link) => void;
  viewMode?: 'list' | 'card';
  selected?: boolean;
}

export function LinkCard({
  link,
  onPress,
  onFavoritePress,
  onDeletePress,
  onMovePress,
  onLongPress,
  viewMode = 'list',
  selected = false,
}: LinkCardProps) {
  const timeAgo = getTimeAgo(link.savedAt);
  const swipeableRef = useRef<Swipeable>(null);

  if (viewMode === 'card') {
    return (
      <Pressable
        onPress={() => onPress(link)}
        onLongPress={() => (onLongPress ?? onDeletePress)?.(link)}
        className={`bg-surface dark:bg-surface-dark rounded-2xl overflow-hidden mb-4 ${
          selected ? 'border-2 border-primary' : ''
        } active:opacity-80`}
      >
        <View>
          {link.ogImage ? (
            <Image
              source={{ uri: link.ogImage }}
              className="w-full h-40"
              resizeMode="cover"
            />
          ) : (
            <View className="w-full h-40 bg-primary/10 items-center justify-center">
              <FontAwesome name="link" size={36} color="#8000C8" />
            </View>
          )}
        </View>
        <View className="p-4">
          <Text
            className="text-base font-semibold text-text dark:text-text-dark"
            numberOfLines={2}
          >
            {link.title}
          </Text>
          {link.description ? (
            <Text
              className="text-sm text-text-secondary dark:text-text-dark-secondary mt-1"
              numberOfLines={2}
            >
              {link.description}
            </Text>
          ) : null}
          <View className="flex-row items-center justify-between mt-3">
            <View className="flex-row items-center flex-1">
              {link.favicon ? (
                <Image
                  source={{ uri: link.favicon }}
                  className="w-4 h-4 rounded mr-1.5"
                />
              ) : null}
              <Text className="text-xs text-text-secondary dark:text-text-dark-secondary">
                {link.domain}
              </Text>
              <Text className="text-xs text-text-secondary/50 ml-2">{timeAgo}</Text>
            </View>
            <Pressable onPress={() => onFavoritePress?.(link)} hitSlop={12} className="p-1">
              <FontAwesome
                name={link.isFavorite ? 'star' : 'star-o'}
                size={18}
                color={link.isFavorite ? '#F59E0B' : '#9CA3AF'}
              />
            </Pressable>
          </View>
        </View>
      </Pressable>
    );
  }

  // List mode — 스와이프로 이동/삭제
  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-160, -80, 0],
      outputRange: [1, 1, 0.5],
      extrapolate: 'clamp',
    });

    return (
      <View className="flex-row">
        {onMovePress && (
          <Pressable
            onPress={() => {
              swipeableRef.current?.close();
              onMovePress(link);
            }}
            className="bg-blue-500 w-20 items-center justify-center"
          >
            <Animated.View style={{ transform: [{ scale }] }} className="items-center">
              <FontAwesome name="folder-open-o" size={18} color="#FFFFFF" />
              <Text className="text-white text-xs mt-1 font-medium">이동</Text>
            </Animated.View>
          </Pressable>
        )}
        <Pressable
          onPress={() => {
            swipeableRef.current?.close();
            onDeletePress?.(link);
          }}
          className="bg-red-500 w-20 items-center justify-center"
        >
          <Animated.View style={{ transform: [{ scale }] }} className="items-center">
            <FontAwesome name="trash-o" size={20} color="#FFFFFF" />
            <Text className="text-white text-xs mt-1 font-medium">삭제</Text>
          </Animated.View>
        </Pressable>
      </View>
    );
  };

  const listContent = (
    <Pressable
      onPress={() => onPress(link)}
      onLongPress={() => (onLongPress ?? onDeletePress)?.(link)}
      className={`flex-row items-center px-5 py-3.5 bg-background dark:bg-background-dark ${
        selected ? 'bg-primary/8' : 'active:bg-surface dark:active:bg-surface-dark'
      }`}
    >
      {/* Thumbnail */}
      {link.ogImage ? (
        <Image
          source={{ uri: link.ogImage }}
          className="w-16 h-16 rounded-xl mr-3.5"
          resizeMode="cover"
        />
      ) : (
        <View className="w-16 h-16 rounded-xl bg-primary/8 dark:bg-primary/15 items-center justify-center mr-3.5">
          <FontAwesome name="link" size={22} color="#8000C8" />
        </View>
      )}

      {/* Content */}
      <View className="flex-1 mr-3">
        <Text
          className="text-[15px] font-semibold text-text dark:text-text-dark leading-5"
          numberOfLines={2}
        >
          {link.title}
        </Text>
        <View className="flex-row items-center mt-1.5">
          {link.favicon ? (
            <Image source={{ uri: link.favicon }} className="w-3.5 h-3.5 rounded mr-1.5" />
          ) : null}
          <Text className="text-xs text-text-secondary dark:text-text-dark-secondary" numberOfLines={1}>
            {link.domain}
          </Text>
          <Text className="text-xs text-text-secondary/40 mx-1.5">&middot;</Text>
          <Text className="text-xs text-text-secondary/60">{timeAgo}</Text>
        </View>
      </View>

      {/* Favorite */}
      <Pressable onPress={() => onFavoritePress?.(link)} hitSlop={12} className="p-2">
        <FontAwesome
          name={link.isFavorite ? 'star' : 'star-o'}
          size={18}
          color={link.isFavorite ? '#F59E0B' : '#D1D5DB'}
        />
      </Pressable>
    </Pressable>
  );

  if (!onDeletePress) {
    return listContent;
  }

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
    >
      {listContent}
    </Swipeable>
  );
}
