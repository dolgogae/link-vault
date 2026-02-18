import { View, Text, Pressable, Image } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Category } from '@/types';

const folderIcon = require('@/assets/images/folder-purple.png');

interface CategoryFolderProps {
  category: Category;
  onPress: (category: Category) => void;
  onLongPress?: (category: Category) => void;
}

export function CategoryFolder({
  category,
  onPress,
  onLongPress,
}: CategoryFolderProps) {
  return (
    <Pressable
      onPress={() => onPress(category)}
      onLongPress={() => onLongPress?.(category)}
      className="w-1/3 items-center mb-5 active:scale-95"
      style={{ transition: 'transform 0.1s' } as any}
    >
      <View className="w-[80px] h-[80px]">
        <Image
          source={folderIcon}
          className="w-[80px] h-[80px]"
          resizeMode="contain"
        />
        {/* Badge icon */}
        <View
          className="absolute bottom-0.5 right-0.5 w-[26px] h-[26px] rounded-full bg-white items-center justify-center"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.12,
            shadowRadius: 2,
            elevation: 2,
          }}
        >
          <FontAwesome name="link" size={12} color="#8000C8" />
        </View>
      </View>

      {/* Name */}
      <Text
        className="text-sm text-text dark:text-text-dark text-center mt-2 px-1 leading-[18px]"
        numberOfLines={2}
      >
        {category.name}
      </Text>

      {/* Link count */}
      {category.linkCount > 0 && (
        <Text className="text-xs text-text-secondary dark:text-text-dark-secondary mt-0.5">
          {category.linkCount}
        </Text>
      )}
    </Pressable>
  );
}
