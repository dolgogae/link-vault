import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Category } from '@/types';

interface RenameToastProps {
  category: Category | null;
  visible: boolean;
  onRename: (categoryId: string, newName: string) => void;
  onDelete: (category: Category) => void;
  onClose: () => void;
}

export function RenameToast({
  category,
  visible,
  onRename,
  onDelete,
  onClose,
}: RenameToastProps) {
  const [name, setName] = useState('');
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible && category) {
      setName(category.name);
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 120,
          friction: 14,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        inputRef.current?.focus();
      });
    } else {
      Keyboard.dismiss();
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, category]);

  const handleSubmit = () => {
    if (!category || !name.trim() || name.trim() === category.name) {
      onClose();
      return;
    }
    onRename(category.id, name.trim());
  };

  const handleDelete = () => {
    if (!category) return;
    onClose();
    onDelete(category);
  };

  if (!visible && !category) return null;

  return (
    <>
      {/* Backdrop */}
      <Animated.View
        pointerEvents={visible ? 'auto' : 'none'}
        style={{ opacity: opacityAnim }}
        className="absolute inset-0 z-40"
      >
        <Pressable onPress={onClose} className="flex-1 bg-black/30" />
      </Animated.View>

      {/* Centered dialog */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        pointerEvents={visible ? 'auto' : 'none'}
        className="absolute inset-0 z-50 justify-center items-center px-8"
      >
        <Animated.View
          style={{
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
            width: '100%',
          }}
        >
          <View
            className="bg-surface dark:bg-surface-dark rounded-2xl px-5 py-5 shadow-lg"
            style={{ elevation: 10 }}
          >
            <Text className="text-base font-semibold text-text dark:text-text-dark mb-3">
              폴더 이름 변경
            </Text>
            <TextInput
              ref={inputRef}
              value={name}
              onChangeText={setName}
              onSubmitEditing={handleSubmit}
              returnKeyType="done"
              selectTextOnFocus
              className="bg-background dark:bg-background-dark rounded-xl px-4 py-3 text-base text-text dark:text-text-dark mb-4"
            />
            <View className="flex-row items-center">
              <Pressable
                onPress={handleDelete}
                hitSlop={8}
                className="p-2 mr-auto"
              >
                <FontAwesome name="trash-o" size={20} color="#EF4444" />
              </Pressable>
              <Pressable
                onPress={onClose}
                className="px-4 py-2.5 mr-2"
              >
                <Text className="text-text-secondary text-base">취소</Text>
              </Pressable>
              <Pressable
                onPress={handleSubmit}
                className="bg-primary rounded-xl px-5 py-2.5 active:bg-primary-dark"
              >
                <Text className="text-white font-semibold text-base">확인</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </>
  );
}
