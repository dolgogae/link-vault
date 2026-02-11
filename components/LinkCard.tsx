import { View, Text, Pressable, Image } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Link } from '@/types';

interface LinkCardProps {
  link: Link;
  onPress: (link: Link) => void;
  onFavoritePress?: (link: Link) => void;
  onLongPress?: (link: Link) => void;
  viewMode?: 'list' | 'card';
  selected?: boolean;
}

export function LinkCard({
  link,
  onPress,
  onFavoritePress,
  onLongPress,
  viewMode = 'list',
  selected = false,
}: LinkCardProps) {
  const timeAgo = getTimeAgo(link.savedAt);

  if (viewMode === 'card') {
    return (
      <Pressable
        onPress={() => onPress(link)}
        onLongPress={() => onLongPress?.(link)}
        className={`bg-surface dark:bg-surface-dark rounded-xl overflow-hidden mb-3 ${
          selected ? 'border-2 border-primary' : ''
        } active:opacity-80`}
      >
        {link.ogImage ? (
          <Image
            source={{ uri: link.ogImage }}
            className="w-full h-36"
            resizeMode="cover"
          />
        ) : (
          <View className="w-full h-36 bg-primary/10 items-center justify-center">
            <FontAwesome name="link" size={32} color="#2563EB" />
          </View>
        )}
        <View className="p-3">
          <View className="flex-row items-center mb-1">
            {link.favicon ? (
              <Image
                source={{ uri: link.favicon }}
                className="w-4 h-4 rounded mr-1.5"
              />
            ) : null}
            <Text className="text-xs text-text-secondary dark:text-text-dark-secondary">
              {link.domain}
            </Text>
            <View className="flex-1" />
            <Pressable onPress={() => onFavoritePress?.(link)} hitSlop={8}>
              <FontAwesome
                name={link.isFavorite ? 'star' : 'star-o'}
                size={16}
                color={link.isFavorite ? '#F59E0B' : '#9CA3AF'}
              />
            </Pressable>
          </View>
          <Text
            className="text-sm font-medium text-text dark:text-text-dark"
            numberOfLines={2}
          >
            {link.title}
          </Text>
          <Text
            className="text-xs text-text-secondary dark:text-text-dark-secondary mt-1"
            numberOfLines={1}
          >
            {link.description}
          </Text>
          <Text className="text-xs text-text-secondary/60 mt-1.5">{timeAgo}</Text>
        </View>
      </Pressable>
    );
  }

  // List mode
  return (
    <Pressable
      onPress={() => onPress(link)}
      onLongPress={() => onLongPress?.(link)}
      className={`flex-row items-center px-4 py-3 border-b border-surface dark:border-surface-dark ${
        selected ? 'bg-primary/10' : ''
      } active:bg-surface dark:active:bg-surface-dark`}
    >
      {link.ogImage ? (
        <Image
          source={{ uri: link.ogImage }}
          className="w-14 h-14 rounded-lg mr-3"
          resizeMode="cover"
        />
      ) : (
        <View className="w-14 h-14 rounded-lg bg-primary/10 items-center justify-center mr-3">
          <FontAwesome name="link" size={20} color="#2563EB" />
        </View>
      )}
      <View className="flex-1 mr-2">
        <View className="flex-row items-center mb-0.5">
          {link.favicon ? (
            <Image source={{ uri: link.favicon }} className="w-3 h-3 rounded mr-1" />
          ) : null}
          <Text className="text-xs text-text-secondary dark:text-text-dark-secondary">
            {link.domain}
          </Text>
        </View>
        <Text
          className="text-sm font-medium text-text dark:text-text-dark"
          numberOfLines={1}
        >
          {link.title}
        </Text>
        <Text
          className="text-xs text-text-secondary dark:text-text-dark-secondary mt-0.5"
          numberOfLines={1}
        >
          {link.description}
        </Text>
      </View>
      <View className="items-center">
        <Pressable onPress={() => onFavoritePress?.(link)} hitSlop={8}>
          <FontAwesome
            name={link.isFavorite ? 'star' : 'star-o'}
            size={16}
            color={link.isFavorite ? '#F59E0B' : '#9CA3AF'}
          />
        </Pressable>
        <Text className="text-[10px] text-text-secondary/60 mt-1">{timeAgo}</Text>
      </View>
    </Pressable>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const d = date instanceof Date ? date : new Date(date);
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}일 전`;
  return `${Math.floor(diff / 2592000)}개월 전`;
}
