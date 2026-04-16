import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { BottomSheet } from '@/components/BottomSheet';
import { Link } from '@/types';

interface LinkActionSheetProps {
  visible: boolean;
  link: Link | null;
  onClose: () => void;
  onRename: (link: Link, newTitle: string) => Promise<void>;
  onMove: (link: Link) => void;
  onDelete: (link: Link) => void;
}

export function LinkActionSheet({
  visible,
  link,
  onClose,
  onRename,
  onMove,
  onDelete,
}: LinkActionSheetProps) {
  const [mode, setMode] = useState<'actions' | 'rename'>('actions');
  const [title, setTitle] = useState('');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible && link) {
      setMode('actions');
      setTitle(link.title);
    }
  }, [visible, link]);

  useEffect(() => {
    if (visible && mode === 'rename') {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [visible, mode]);

  const handleClose = () => {
    setMode('actions');
    setTitle(link?.title ?? '');
    onClose();
  };

  const handleRename = async () => {
    if (!link) return;
    const trimmed = title.trim();

    if (!trimmed || trimmed === link.title) {
      handleClose();
      return;
    }

    await onRename(link, trimmed);
    handleClose();
  };

  if (!link) return null;

  return (
    <BottomSheet visible={visible} onClose={handleClose} title={link.title}>
      {mode === 'actions' && (
        <View className="gap-2">
          <ActionButton
            icon="pencil"
            label="이름 수정"
            onPress={() => setMode('rename')}
          />
          <ActionButton
            icon="folder-open-o"
            label="이동"
            onPress={() => {
              handleClose();
              onMove(link);
            }}
          />
          <ActionButton
            icon="trash"
            label="삭제"
            onPress={() => {
              handleClose();
              onDelete(link);
            }}
            destructive
          />
        </View>
      )}

      {mode === 'rename' && (
        <View>
          <TextInput
            ref={inputRef}
            value={title}
            onChangeText={setTitle}
            onSubmitEditing={() => void handleRename()}
            returnKeyType="done"
            selectTextOnFocus
            placeholder="링크 이름"
            placeholderTextColor="#9CA3AF"
            className="bg-surface dark:bg-surface-dark rounded-xl px-4 py-3 text-base text-text dark:text-text-dark mb-4"
          />
          <View className="flex-row justify-end">
            <Pressable onPress={handleClose} className="px-4 py-3 mr-2">
              <Text className="text-text-secondary">취소</Text>
            </Pressable>
            <Pressable
              onPress={() => void handleRename()}
              className="bg-primary py-3 px-5 rounded-xl items-center"
            >
              <Text className="text-white font-semibold">변경</Text>
            </Pressable>
          </View>
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
