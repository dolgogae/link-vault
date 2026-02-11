import { View, TextInput, Pressable } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
  autoFocus?: boolean;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = '링크 검색...',
  onClear,
  autoFocus = false,
}: SearchBarProps) {
  return (
    <View className="flex-row items-center bg-surface dark:bg-surface-dark rounded-xl px-4 py-2.5 mx-4 my-2">
      <FontAwesome name="search" size={16} color="#9CA3AF" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        autoFocus={autoFocus}
        className="flex-1 ml-2 text-base text-text dark:text-text-dark"
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {value.length > 0 && (
        <Pressable
          onPress={() => {
            onChangeText('');
            onClear?.();
          }}
          hitSlop={8}
        >
          <FontAwesome name="times-circle" size={16} color="#9CA3AF" />
        </Pressable>
      )}
    </View>
  );
}
