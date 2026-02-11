import { View, Text, Pressable } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Category } from '@/types';

interface CategoryFolderProps {
  category: Category;
  onPress: (category: Category) => void;
  onLongPress?: (category: Category) => void;
  viewMode?: 'grid' | 'list';
}

export function CategoryFolder({
  category,
  onPress,
  onLongPress,
  viewMode = 'grid',
}: CategoryFolderProps) {
  if (viewMode === 'list') {
    return (
      <Pressable
        onPress={() => onPress(category)}
        onLongPress={() => onLongPress?.(category)}
        className="flex-row items-center px-4 py-3 border-b border-surface dark:border-surface-dark active:bg-surface dark:active:bg-surface-dark"
      >
        <Text className="text-2xl mr-3">{category.icon || '📁'}</Text>
        <View className="flex-1">
          <Text className="text-base font-medium text-text dark:text-text-dark">
            {category.name}
          </Text>
          <Text className="text-xs text-text-secondary dark:text-text-dark-secondary mt-0.5">
            {category.linkCount}개 링크
          </Text>
        </View>
        <FontAwesome name="chevron-right" size={12} color="#9CA3AF" />
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={() => onPress(category)}
      onLongPress={() => onLongPress?.(category)}
      className="items-center justify-center p-4 bg-surface dark:bg-surface-dark rounded-xl active:opacity-80"
      style={{ width: '48%', aspectRatio: 1 }}
    >
      <Text className="text-4xl mb-2">{category.icon || '📁'}</Text>
      <Text
        className="text-sm font-medium text-text dark:text-text-dark text-center"
        numberOfLines={2}
      >
        {category.name}
      </Text>
      <Text className="text-xs text-text-secondary dark:text-text-dark-secondary mt-1">
        {category.linkCount}개
      </Text>
    </Pressable>
  );
}
