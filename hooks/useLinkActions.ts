import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { deleteLink, moveLink, renameLink } from '@/services/links';
import { Link } from '@/types';

export function useLinkActions(userId: string, onRefresh: () => void) {
  const [movingLink, setMovingLink] = useState<Link | null>(null);
  const [selectedLink, setSelectedLink] = useState<Link | null>(null);

  const handleDeleteLink = useCallback(
    (link: Link) => {
      Alert.alert('링크 삭제', `"${link.title}"을(를) 삭제하시겠습니까?`, [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteLink(userId, link.id, link.categoryPath);
              onRefresh();
            } catch (e) {
              console.error('[useLinkActions] delete failed:', e);
              Alert.alert('오류', '링크 삭제에 실패했습니다.');
            }
          },
        },
      ]);
    },
    [userId, onRefresh],
  );

  const handleMoveLink = useCallback(
    async (link: Link, newCategoryPath: string[]) => {
      const isSamePath =
        link.categoryPath.length === newCategoryPath.length &&
        link.categoryPath.every((categoryId, index) => categoryId === newCategoryPath[index]);

      if (isSamePath) {
        setMovingLink(null);
        return;
      }

      try {
        await moveLink(userId, link.id, link.categoryPath, newCategoryPath);
        setMovingLink(null);
        onRefresh();
      } catch (e) {
        console.error('[useLinkActions] move failed:', e);
        Alert.alert('오류', '링크 이동에 실패했습니다.');
      }
    },
    [userId, onRefresh],
  );

  const handleRenameLink = useCallback(
    async (link: Link, newTitle: string) => {
      try {
        await renameLink(userId, link.id, newTitle);
        setSelectedLink(null);
        onRefresh();
      } catch (e) {
        console.error('[useLinkActions] rename failed:', e);
        Alert.alert('오류', '링크 이름 수정에 실패했습니다.');
      }
    },
    [userId, onRefresh],
  );

  const handleLinkLongPress = useCallback(
    (link: Link) => {
      setSelectedLink(link);
    },
    [],
  );

  return {
    movingLink,
    selectedLink,
    setMovingLink,
    setSelectedLink,
    handleDeleteLink,
    handleMoveLink,
    handleRenameLink,
    handleLinkLongPress,
  };
}
