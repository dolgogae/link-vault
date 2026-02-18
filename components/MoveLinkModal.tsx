import { useState, useEffect, useCallback } from 'react';
import { View, Text, Modal, Pressable, FlatList, ActivityIndicator } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Category, Link } from '@/types';
import { getAllCategories } from '@/services/categories';
import { useAuthStore } from '@/stores/authStore';

interface MoveLinkModalProps {
  visible: boolean;
  link: Link | null;
  onMove: (link: Link, newCategoryPath: string[]) => void;
  onClose: () => void;
}

export function MoveLinkModal({ visible, link, onMove, onClose }: MoveLinkModalProps) {
  const { user } = useAuthStore();
  const userId = user?.uid || '';

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentParentId, setCurrentParentId] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (visible && userId) {
      setLoading(true);
      getAllCategories(userId)
        .then(setCategories)
        .catch(() => {})
        .finally(() => setLoading(false));
      // 모달 열 때 루트에서 시작
      setCurrentParentId(null);
      setBreadcrumb([]);
    }
  }, [visible, userId]);

  const currentChildren = categories.filter((c) => c.parentId === currentParentId);

  const navigateInto = useCallback((cat: Category) => {
    setCurrentParentId(cat.id);
    setBreadcrumb((prev) => [...prev, { id: cat.id, name: cat.name }]);
  }, []);

  const navigateTo = useCallback((index: number) => {
    if (index < 0) {
      setCurrentParentId(null);
      setBreadcrumb([]);
    } else {
      setBreadcrumb((prev) => {
        const next = prev.slice(0, index + 1);
        setCurrentParentId(next[next.length - 1].id);
        return next;
      });
    }
  }, []);

  // 현재 선택된 경로의 categoryId 배열 생성
  const buildCategoryPath = useCallback(
    (targetId: string): string[] => {
      const path: string[] = [];
      let current = categories.find((c) => c.id === targetId);
      while (current) {
        path.unshift(current.id);
        current = current.parentId
          ? categories.find((c) => c.id === current!.parentId)
          : undefined;
      }
      return path;
    },
    [categories],
  );

  const handleMoveHere = () => {
    if (!link || !currentParentId) return;
    const newPath = buildCategoryPath(currentParentId);
    onMove(link, newPath);
  };

  // 현재 링크가 이미 이 폴더에 있는지 확인
  const isCurrentFolder =
    link && currentParentId
      ? link.categoryPath[link.categoryPath.length - 1] === currentParentId
      : false;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-background dark:bg-background-dark">
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 pt-4 pb-3 border-b border-surface dark:border-surface-dark">
          <Pressable onPress={onClose} hitSlop={12}>
            <Text className="text-primary text-base">취소</Text>
          </Pressable>
          <Text className="text-base font-semibold text-text dark:text-text-dark">
            폴더 선택
          </Text>
          <View className="w-10" />
        </View>

        {/* 이동 대상 링크 정보 */}
        {link && (
          <View className="px-5 py-3 bg-surface/50 dark:bg-surface-dark/50">
            <Text className="text-xs text-text-secondary dark:text-text-dark-secondary">이동할 링크</Text>
            <Text className="text-sm font-medium text-text dark:text-text-dark mt-0.5" numberOfLines={1}>
              {link.title}
            </Text>
          </View>
        )}

        {/* Breadcrumb */}
        <View className="flex-row items-center px-5 py-3 flex-wrap">
          <Pressable
            onPress={() => navigateTo(-1)}
            className="flex-row items-center h-8 px-2.5 rounded-lg bg-surface dark:bg-surface-dark mr-1"
          >
            <FontAwesome name="home" size={13} color="#8000C8" />
          </Pressable>
          {breadcrumb.map((crumb, index) => (
            <View key={`${crumb.id}-${index}`} className="flex-row items-center">
              <FontAwesome name="chevron-right" size={9} color="#9CA3AF" style={{ marginHorizontal: 3 }} />
              <Pressable
                onPress={() => navigateTo(index)}
                className="h-8 px-2.5 rounded-lg items-center justify-center bg-surface dark:bg-surface-dark"
              >
                <Text className="text-sm text-text dark:text-text-dark" numberOfLines={1}>
                  {crumb.name}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>

        {/* 폴더 목록 */}
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#8000C8" />
          </View>
        ) : (
          <FlatList
            data={currentChildren}
            keyExtractor={(item) => item.id}
            contentContainerStyle={
              currentChildren.length === 0 ? { flex: 1 } : { paddingBottom: 20 }
            }
            renderItem={({ item: cat }) => {
              const hasChildren = categories.some((c) => c.parentId === cat.id);
              const isCurrent =
                link?.categoryPath[link.categoryPath.length - 1] === cat.id;

              return (
                <Pressable
                  onPress={() => navigateInto(cat)}
                  className={`flex-row items-center px-5 py-3.5 ${
                    isCurrent ? 'bg-primary/8' : 'active:bg-surface dark:active:bg-surface-dark'
                  }`}
                >
                  <FontAwesome
                    name="folder"
                    size={20}
                    color={isCurrent ? '#8000C8' : '#D1D5DB'}
                  />
                  <Text
                    className={`flex-1 ml-3 text-base ${
                      isCurrent
                        ? 'text-primary font-semibold'
                        : 'text-text dark:text-text-dark'
                    }`}
                    numberOfLines={1}
                  >
                    {cat.name}
                  </Text>
                  {isCurrent && (
                    <Text className="text-xs text-primary mr-2">현재 위치</Text>
                  )}
                  {hasChildren && (
                    <FontAwesome name="chevron-right" size={12} color="#9CA3AF" />
                  )}
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center">
                <FontAwesome name="folder-open-o" size={40} color="#D1D5DB" />
                <Text className="text-text-secondary dark:text-text-dark-secondary mt-3">
                  하위 폴더가 없습니다
                </Text>
              </View>
            }
            ItemSeparatorComponent={() => (
              <View className="h-px bg-surface dark:bg-surface-dark mx-5" />
            )}
          />
        )}

        {/* 여기로 이동 버튼 */}
        {currentParentId && (
          <View className="px-5 pb-8 pt-3 border-t border-surface dark:border-surface-dark">
            <Pressable
              onPress={handleMoveHere}
              disabled={isCurrentFolder}
              className={`h-12 rounded-xl items-center justify-center ${
                isCurrentFolder ? 'bg-gray-300' : 'bg-primary active:bg-primary/80'
              }`}
            >
              <Text className={`text-base font-semibold ${isCurrentFolder ? 'text-gray-500' : 'text-white'}`}>
                {isCurrentFolder ? '현재 위치입니다' : '여기로 이동'}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}
