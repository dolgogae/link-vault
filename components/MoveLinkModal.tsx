import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  FlatList,
  ActivityIndicator,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Category, Link } from '@/types';
import { ensureCategoryPath, getAllCategories } from '@/services/categories';
import { useAuthStore } from '@/stores/authStore';

interface MoveLinkModalProps {
  visible: boolean;
  link: Link | null;
  onMove: (link: Link, newCategoryPath: string[]) => Promise<void> | void;
  onClose: () => void;
}

type MoveMode = 'browse' | 'path';

export function MoveLinkModal({ visible, link, onMove, onClose }: MoveLinkModalProps) {
  const { user } = useAuthStore();
  const userId = user?.uid || '';

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<MoveMode>('browse');
  const [currentParentId, setCurrentParentId] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<{ id: string; name: string }[]>([]);
  const [pathInput, setPathInput] = useState('');

  useEffect(() => {
    if (!visible || !userId) return;

    setLoading(true);
    getAllCategories(userId)
      .then(setCategories)
      .catch((error) => {
        console.error('[MoveLinkModal] load categories failed:', error);
      })
      .finally(() => setLoading(false));

    setMode('browse');
    setCurrentParentId(null);
    setBreadcrumb([]);
    setPathInput('');
    setSubmitting(false);
  }, [visible, userId]);

  const currentChildren = useMemo(
    () => categories.filter((category) => category.parentId === currentParentId),
    [categories, currentParentId],
  );

  const buildCategoryPath = useCallback(
    (targetId: string): string[] => {
      const path: string[] = [];
      let current = categories.find((category) => category.id === targetId);
      while (current) {
        path.unshift(current.id);
        current = current.parentId
          ? categories.find((category) => category.id === current!.parentId)
          : undefined;
      }
      return path;
    },
    [categories],
  );

  const parsedPathSegments = useMemo(
    () =>
      pathInput
        .split('/')
        .map((segment) => segment.trim())
        .filter(Boolean),
    [pathInput],
  );

  const linkLeafCategoryId = link?.categoryPath[link.categoryPath.length - 1] ?? null;
  const isCurrentFolder = !!currentParentId && currentParentId === linkLeafCategoryId;

  const handleClose = useCallback(() => {
    if (submitting) return;
    onClose();
  }, [onClose, submitting]);

  const navigateInto = useCallback((category: Category) => {
    setCurrentParentId(category.id);
    setBreadcrumb((prev) => [...prev, { id: category.id, name: category.name }]);
  }, []);

  const navigateTo = useCallback((index: number) => {
    if (index < 0) {
      setCurrentParentId(null);
      setBreadcrumb([]);
      return;
    }

    setBreadcrumb((prev) => {
      const next = prev.slice(0, index + 1);
      setCurrentParentId(next[next.length - 1].id);
      return next;
    });
  }, []);

  const handleMoveToExisting = useCallback(async () => {
    if (!link || !currentParentId) return;

    setSubmitting(true);
    try {
      await onMove(link, buildCategoryPath(currentParentId));
      onClose();
    } catch (error: any) {
      console.error('[MoveLinkModal] move failed:', error);
      Alert.alert('오류', '링크 이동에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }, [buildCategoryPath, currentParentId, link, onMove, onClose]);

  const handleMoveToPath = useCallback(async () => {
    if (!link) return;
    if (!pathInput.trim()) {
      Alert.alert('오류', '폴더 경로를 입력해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const { categoryIds, categoryNames } = await ensureCategoryPath(userId, pathInput);
      const isSamePath =
        categoryIds.length === link.categoryPath.length &&
        categoryIds.every((categoryId, index) => categoryId === link.categoryPath[index]);

      if (isSamePath) {
        Alert.alert('안내', '이미 해당 폴더에 링크가 있습니다.');
        return;
      }

      await onMove(link, categoryIds);
      onClose();
    } catch (error: any) {
      console.error('[MoveLinkModal] move to path failed:', error);
      Alert.alert('오류', error.message || '경로 이동에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }, [link, onMove, onClose, pathInput, userId]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 bg-background dark:bg-background-dark"
      >
        <View className="flex-1 bg-background dark:bg-background-dark">
          <View className="flex-row items-center justify-between px-5 pt-4 pb-3 border-b border-surface dark:border-surface-dark">
            <Pressable onPress={handleClose} hitSlop={12} disabled={submitting}>
              <Text className="text-primary text-base">취소</Text>
            </Pressable>
            <Text className="text-base font-semibold text-text dark:text-text-dark">
              링크 이동
            </Text>
            <View className="w-10" />
          </View>

          {link && (
            <View className="px-5 py-3 bg-surface/50 dark:bg-surface-dark/50">
              <Text className="text-xs text-text-secondary dark:text-text-dark-secondary">
                이동할 링크
              </Text>
              <Text
                className="text-sm font-medium text-text dark:text-text-dark mt-0.5"
                numberOfLines={1}
              >
                {link.title}
              </Text>
            </View>
          )}

          <View className="flex-row px-5 pt-4 pb-3">
            <Pressable
              onPress={() => setMode('browse')}
              className={`flex-1 h-10 rounded-l-xl items-center justify-center border ${
                mode === 'browse'
                  ? 'bg-primary border-primary'
                  : 'bg-surface dark:bg-surface-dark border-surface dark:border-surface-dark'
              }`}
            >
              <Text className={mode === 'browse' ? 'text-white font-semibold' : 'text-text dark:text-text-dark'}>
                기존 폴더 선택
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setMode('path')}
              className={`flex-1 h-10 rounded-r-xl items-center justify-center border-t border-r border-b ${
                mode === 'path'
                  ? 'bg-primary border-primary'
                  : 'bg-surface dark:bg-surface-dark border-surface dark:border-surface-dark'
              }`}
            >
              <Text className={mode === 'path' ? 'text-white font-semibold' : 'text-text dark:text-text-dark'}>
                경로 입력
              </Text>
            </Pressable>
          </View>

          {mode === 'browse' ? (
            <>
              <View className="flex-row items-center px-5 py-3 flex-wrap">
                <Pressable
                  onPress={() => navigateTo(-1)}
                  className="flex-row items-center h-8 px-2.5 rounded-lg bg-surface dark:bg-surface-dark mr-1"
                >
                  <FontAwesome name="home" size={13} color="#8000C8" />
                </Pressable>
                {breadcrumb.map((crumb, index) => (
                  <View key={`${crumb.id}-${index}`} className="flex-row items-center">
                    <FontAwesome
                      name="chevron-right"
                      size={9}
                      color="#9CA3AF"
                      style={{ marginHorizontal: 3 }}
                    />
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
                  renderItem={({ item: category }) => {
                    const hasChildren = categories.some((item) => item.parentId === category.id);
                    const isCurrent =
                      link?.categoryPath[link.categoryPath.length - 1] === category.id;

                    return (
                      <Pressable
                        onPress={() => navigateInto(category)}
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
                          {category.name}
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
                    <View className="flex-1 items-center justify-center px-8">
                      <FontAwesome name="folder-open-o" size={40} color="#D1D5DB" />
                      <Text className="text-text-secondary dark:text-text-dark-secondary mt-3">
                        하위 폴더가 없습니다
                      </Text>
                      <Text className="text-xs text-text-secondary/70 dark:text-text-dark-secondary/70 mt-1 text-center">
                        경로 입력 탭에서 새 폴더를 만들며 이동할 수 있습니다
                      </Text>
                    </View>
                  }
                  ItemSeparatorComponent={() => (
                    <View className="h-px bg-surface dark:bg-surface-dark mx-5" />
                  )}
                />
              )}

              {currentParentId && (
                <View className="px-5 pb-8 pt-3 border-t border-surface dark:border-surface-dark">
                  <Pressable
                    onPress={handleMoveToExisting}
                    disabled={submitting || isCurrentFolder}
                    className={`h-12 rounded-xl items-center justify-center ${
                      submitting || isCurrentFolder
                        ? 'bg-gray-300'
                        : 'bg-primary active:bg-primary/80'
                    }`}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text
                        className={`text-base font-semibold ${
                          isCurrentFolder ? 'text-gray-500' : 'text-white'
                        }`}
                      >
                        {isCurrentFolder ? '현재 위치입니다' : '여기로 이동'}
                      </Text>
                    )}
                  </Pressable>
                </View>
              )}
            </>
          ) : (
            <View className="flex-1 px-5 pt-2 pb-8">
              <Text className="text-sm text-text-secondary dark:text-text-dark-secondary mb-3">
                `/`로 폴더를 구분해 입력하세요. 없는 폴더는 자동으로 생성됩니다.
              </Text>

              <View className="rounded-2xl bg-surface dark:bg-surface-dark px-4 py-3">
                <TextInput
                  value={pathInput}
                  onChangeText={setPathInput}
                  placeholder="예: 개발/React Native/읽을거리"
                  placeholderTextColor="#9CA3AF"
                  className="text-base text-text dark:text-text-dark"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!submitting}
                />
              </View>

              <View className="mt-4 rounded-2xl bg-surface/60 dark:bg-surface-dark/60 px-4 py-3">
                <Text className="text-xs text-text-secondary dark:text-text-dark-secondary">
                  입력 경로
                </Text>
                <Text className="text-sm text-text dark:text-text-dark mt-1">
                  {parsedPathSegments.length > 0 ? parsedPathSegments.join(' / ') : '아직 입력되지 않았습니다'}
                </Text>
              </View>

              <View className="mt-auto">
                <Pressable
                  onPress={handleMoveToPath}
                  disabled={submitting || parsedPathSegments.length === 0}
                  className={`h-12 rounded-xl items-center justify-center ${
                    submitting || parsedPathSegments.length === 0
                      ? 'bg-gray-300'
                      : 'bg-primary active:bg-primary/80'
                  }`}
                >
                  {submitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text
                      className={`text-base font-semibold ${
                        parsedPathSegments.length === 0 ? 'text-gray-500' : 'text-white'
                      }`}
                    >
                      경로로 이동
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
