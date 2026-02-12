import { View, Text, Pressable, Alert, TextInput } from 'react-native';
import { useState } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Category } from '@/types';
import {
  renameCategory,
  deleteCategory,
  updateCategoryIcon,
} from '@/services/categories';
import { BottomSheet } from '@/components/BottomSheet';

interface CategoryActionSheetProps {
  visible: boolean;
  category: Category | null;
  userId: string;
  onClose: () => void;
  onUpdated: () => void;
}

export function CategoryActionSheet({
  visible,
  category,
  userId,
  onClose,
  onUpdated,
}: CategoryActionSheetProps) {
  const [mode, setMode] = useState<'actions' | 'rename' | 'icon'>('actions');
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('');

  const handleRename = async () => {
    if (!category || !newName.trim()) return;
    await renameCategory(userId, category.id, newName.trim());
    setMode('actions');
    setNewName('');
    onUpdated();
    onClose();
  };

  const handleIconChange = async () => {
    if (!category || !newIcon.trim()) return;
    await updateCategoryIcon(userId, category.id, newIcon.trim());
    setMode('actions');
    setNewIcon('');
    onUpdated();
    onClose();
  };

  const handleDelete = () => {
    if (!category) return;

    if (category.linkCount > 0 || category.parentId) {
      Alert.alert('카테고리 삭제', `"${category.name}"을 삭제하시겠습니까?`, [
        { text: '취소', style: 'cancel' },
        ...(category.parentId
          ? [
              {
                text: '링크를 상위로 이동',
                onPress: async () => {
                  await deleteCategory(userId, category.id, category.parentId, true);
                  onUpdated();
                  onClose();
                },
              },
            ]
          : []),
        {
          text: '모두 삭제',
          style: 'destructive' as const,
          onPress: async () => {
            await deleteCategory(userId, category.id, category.parentId, false);
            onUpdated();
            onClose();
          },
        },
      ]);
    } else {
      Alert.alert('카테고리 삭제', `"${category.name}"을 삭제하시겠습니까?`, [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            await deleteCategory(userId, category.id, category.parentId, false);
            onUpdated();
            onClose();
          },
        },
      ]);
    }
  };

  const resetAndClose = () => {
    setMode('actions');
    setNewName('');
    setNewIcon('');
    onClose();
  };

  if (!category) return null;

  return (
    <BottomSheet
      visible={visible}
      onClose={resetAndClose}
      title={`${category.icon} ${category.name}`}
    >
      {mode === 'actions' && (
        <View className="gap-2">
          <ActionButton
            icon="pencil"
            label="이름 변경"
            onPress={() => {
              setNewName(category.name);
              setMode('rename');
            }}
          />
          <ActionButton
            icon="smile-o"
            label="아이콘 변경"
            onPress={() => {
              setNewIcon(category.icon);
              setMode('icon');
            }}
          />
          <ActionButton
            icon="trash"
            label="삭제"
            onPress={handleDelete}
            destructive
          />
        </View>
      )}

      {mode === 'rename' && (
        <View>
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="새 이름"
            placeholderTextColor="#9CA3AF"
            className="bg-surface dark:bg-surface-dark rounded-xl px-4 py-3 text-base text-text dark:text-text-dark mb-4"
            autoFocus
          />
          <Pressable
            onPress={handleRename}
            className="bg-primary py-3 rounded-xl items-center"
          >
            <Text className="text-white font-semibold">변경</Text>
          </Pressable>
        </View>
      )}

      {mode === 'icon' && (
        <View>
          <TextInput
            value={newIcon}
            onChangeText={setNewIcon}
            placeholder="이모지 입력"
            placeholderTextColor="#9CA3AF"
            className="bg-surface dark:bg-surface-dark rounded-xl px-4 py-3 text-2xl text-center mb-4"
            autoFocus
          />
          <Pressable
            onPress={handleIconChange}
            className="bg-primary py-3 rounded-xl items-center"
          >
            <Text className="text-white font-semibold">변경</Text>
          </Pressable>
        </View>
      )}
    </BottomSheet>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  destructive,
}: {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center py-3 px-4 rounded-xl active:bg-surface dark:active:bg-surface-dark"
    >
      <FontAwesome
        name={icon}
        size={18}
        color={destructive ? '#EF4444' : '#6B7280'}
        style={{ width: 28 }}
      />
      <Text
        className={`text-base ${
          destructive ? 'text-red-500' : 'text-text dark:text-text-dark'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
