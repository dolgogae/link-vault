import { useState, useCallback, useMemo, useEffect, useLayoutEffect } from 'react';
import { View, Text, FlatList, ScrollView, Pressable, RefreshControl, Alert } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useNavigation } from 'expo-router';

import { useAuthStore } from '@/stores/authStore';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { getRootCategoriesQuery, getChildCategoriesQuery, renameCategory, deleteCategory as deleteCategoryService, runCleanupIfNeeded } from '@/services/categories';
import { getLinksQuery, toggleFavorite, deleteLink } from '@/services/links';
import { CategoryFolder } from '@/components/CategoryFolder';
import { LinkCard } from '@/components/LinkCard';
import { AddLinkModal } from '@/components/AddLinkModal';
import { RenameToast } from '@/components/RenameToast';
import { AdBanner } from '@/components/AdBanner';
import { EmptyState } from '@/components/EmptyState';
import { useInterstitialAd } from '@/hooks/useInterstitialAd';
import { Category, Link } from '@/types';
import * as WebBrowser from 'expo-web-browser';

export default function HomeScreen() {
  const { user } = useAuthStore();
  const userId = user?.uid || '';

  // 폴더 탐색 상태
  const [currentCategoryId, setCurrentCategoryId] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<{ id: string; name: string }[]>([]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [showRenameToast, setShowRenameToast] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useInterstitialAd();

  // 기존 데이터 정리 (이모지 제거 + 중복 병합) - 1회 자동 실행
  useEffect(() => {
    if (!userId) return;
    runCleanupIfNeeded(userId).then((didRun) => {
      if (didRun) setRefreshKey((k) => k + 1);
    });
  }, [userId]);

  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => setShowAddModal(true)}
          hitSlop={12}
          className="mr-4 w-8 h-8 items-center justify-center"
        >
          <FontAwesome name="plus" size={20} color="#8000C8" />
        </Pressable>
      ),
    });
  }, [navigation]);

  // 현재 레벨의 하위 카테고리
  const {
    data: childCategories,
    loading: loadingCats,
    error: catError,
  } = useFirestoreQuery<Category>(
    userId
      ? () =>
          currentCategoryId
            ? getChildCategoriesQuery(userId, currentCategoryId)
            : getRootCategoriesQuery(userId)
      : null,
    [userId, currentCategoryId, refreshKey],
  );

  // 전체 링크 (leaf 카테고리별 그룹용)
  const {
    data: allLinks,
    loading: loadingLinks,
    error: linkError,
  } = useFirestoreQuery<Link>(
    userId ? () => getLinksQuery(userId, undefined, 500) : null,
    [userId, refreshKey],
  );

  // 현재 폴더의 직속 링크 (categoryPath 마지막이 현재 폴더인 링크)
  const currentLinks = useMemo(() => {
    if (!currentCategoryId) return [];
    return allLinks.filter(
      (link) =>
        link.categoryPath?.[link.categoryPath.length - 1] === currentCategoryId,
    );
  }, [allLinks, currentCategoryId]);

  // 디버그
  useEffect(() => {
    console.log(
      `[Home] 현재폴더: ${currentCategoryId || 'root'}, 하위폴더: ${childCategories.length}건, 링크: ${currentLinks.length}건`,
    );
    if (catError) console.error('[Home] catError:', catError.message);
    if (linkError) console.error('[Home] linkError:', linkError.message);
  }, [childCategories, currentLinks, catError, linkError, currentCategoryId]);

  // 폴더 탐색
  const navigateInto = useCallback((category: Category) => {
    setCurrentCategoryId(category.id);
    setBreadcrumb((prev) => [...prev, { id: category.id, name: category.name }]);
  }, []);

  const navigateTo = useCallback((index: number) => {
    if (index < 0) {
      // Go to root
      setCurrentCategoryId(null);
      setBreadcrumb([]);
    } else {
      setBreadcrumb((prev) => {
        const next = prev.slice(0, index + 1);
        setCurrentCategoryId(next[next.length - 1].id);
        return next;
      });
    }
  }, []);

  const handleCategoryLongPress = (category: Category) => {
    setSelectedCategory(category);
    setShowRenameToast(true);
  };

  const handleRenameCategory = async (categoryId: string, newName: string) => {
    try {
      const result = await renameCategory(userId, categoryId, newName);
      if (result.merged) {
        Alert.alert('폴더 합침', '동일한 이름의 폴더가 있어 합쳐졌습니다.');
      }
      setBreadcrumb((prev) =>
        prev.map((crumb) =>
          crumb.id === categoryId
            ? { ...crumb, id: result.targetId || crumb.id, name: newName }
            : crumb,
        ),
      );
      setRefreshKey((k) => k + 1);
    } catch {
      Alert.alert('오류', '이름 변경에 실패했습니다.');
    }
    setShowRenameToast(false);
  };

  const handleDeleteCategory = (category: Category) => {
    Alert.alert('폴더 삭제', `"${category.name}" 폴더와 하위 링크를 모두 삭제하시겠습니까?`, [
      { text: '취소', style: 'cancel' },
      ...(category.parentId
        ? [
            {
              text: '링크를 상위로 이동',
              onPress: async () => {
                try {
                  await deleteCategoryService(userId, category.id, category.parentId, true);
                  setRefreshKey((k) => k + 1);
                } catch {
                  Alert.alert('오류', '폴더 삭제에 실패했습니다.');
                }
              },
            },
          ]
        : []),
      {
        text: '모두 삭제',
        style: 'destructive' as const,
        onPress: async () => {
          try {
            await deleteCategoryService(userId, category.id, category.parentId, false);
            setRefreshKey((k) => k + 1);
          } catch {
            Alert.alert('오류', '폴더 삭제에 실패했습니다.');
          }
        },
      },
    ]);
  };

  const handleLinkPress = async (link: Link) => {
    await WebBrowser.openBrowserAsync(link.url);
  };

  const handleFavoritePress = async (link: Link) => {
    if (!userId) return;
    await toggleFavorite(userId, link.id, link.isFavorite);
  };

  const handleDeleteLink = (link: Link) => {
    Alert.alert('링크 삭제', `"${link.title}"을(를) 삭제하시겠습니까?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteLink(userId, link.id, link.categoryPath);
          } catch {
            Alert.alert('오류', '링크 삭제에 실패했습니다.');
          }
        },
      },
    ]);
  };

  const isLoading = loadingCats || loadingLinks;
  const hasError = catError || linkError;
  const isEmpty = childCategories.length === 0 && currentLinks.length === 0;

  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      <FlatList
        data={currentLinks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          isEmpty && !isLoading ? { flex: 1 } : { paddingBottom: 40 }
        }
        refreshControl={
          <RefreshControl
            refreshing={isLoading && refreshKey > 0}
            onRefresh={() => setRefreshKey((k) => k + 1)}
            tintColor="#8000C8"
          />
        }
        ListHeaderComponent={
          <>
            {/* 브레드크럼 네비게이션 */}
            {breadcrumb.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, alignItems: 'center' }}
              >
                <Pressable
                  onPress={() => navigateTo(-1)}
                  className="flex-row items-center h-9 px-3 rounded-full bg-surface dark:bg-surface-dark mr-1.5"
                >
                  <FontAwesome name="home" size={14} color="#8000C8" />
                </Pressable>
                {breadcrumb.map((crumb, index) => {
                  const isLast = index === breadcrumb.length - 1;
                  return (
                    <View key={crumb.id} className="flex-row items-center">
                      <FontAwesome name="chevron-right" size={10} color="#9CA3AF" style={{ marginHorizontal: 4 }} />
                      <Pressable
                        onPress={isLast ? undefined : () => navigateTo(index)}
                        className={`h-9 px-3.5 rounded-full items-center justify-center ${
                          isLast
                            ? 'bg-primary'
                            : 'bg-surface dark:bg-surface-dark'
                        }`}
                      >
                        <Text
                          className={`text-sm font-medium ${
                            isLast
                              ? 'text-white'
                              : 'text-text dark:text-text-dark'
                          }`}
                          numberOfLines={1}
                        >
                          {crumb.name}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </ScrollView>
            )}

            {/* 에러 배너 */}
            {hasError && (
              <Pressable
                onPress={() => setRefreshKey((k) => k + 1)}
                className="mx-5 mt-3 mb-1 p-3.5 bg-red-50 dark:bg-red-900/20 rounded-xl"
              >
                <Text className="text-red-600 dark:text-red-400 text-sm">
                  데이터를 불러오지 못했습니다. 탭하여 다시 시도
                </Text>
                <Text className="text-red-400/70 text-xs mt-1" numberOfLines={2}>
                  {catError?.message || linkError?.message}
                </Text>
              </Pressable>
            )}

            {/* 폴더 아이콘 그리드 */}
            {childCategories.length > 0 && (
              <View className="flex-row flex-wrap px-4 pt-5">
                {childCategories.map((cat) => (
                  <CategoryFolder
                    key={cat.id}
                    category={cat}
                    onPress={navigateInto}
                    onLongPress={handleCategoryLongPress}
                  />
                ))}
              </View>
            )}

            {/* 링크 섹션 구분 */}
            {currentLinks.length > 0 && childCategories.length > 0 && (
              <View className="h-px bg-surface dark:bg-surface-dark mx-5 mt-1 mb-2" />
            )}
          </>
        }
        ListEmptyComponent={
          !isLoading && isEmpty ? (
            <EmptyState
              icon="folder-open-o"
              title={
                currentCategoryId
                  ? '이 폴더가 비어있습니다'
                  : '아직 저장된 링크가 없습니다'
              }
              subtitle={
                currentCategoryId
                  ? undefined
                  : '링크를 저장하면 AI가 자동으로 폴더에 분류합니다'
              }
              action={
                currentCategoryId
                  ? undefined
                  : { label: '첫 링크 저장하기', onPress: () => setShowAddModal(true) }
              }
            />
          ) : null
        }
        renderItem={({ item: link }) => (
          <LinkCard
            link={link}
            onPress={handleLinkPress}
            onFavoritePress={handleFavoritePress}
            onDeletePress={handleDeleteLink}
            viewMode="list"
          />
        )}
      />

      <AddLinkModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSaved={(categoryPath, categoryIds) => {
          // 저장된 폴더로 바로 이동
          const leafId = categoryIds[categoryIds.length - 1];
          if (leafId) {
            setCurrentCategoryId(leafId);
            setBreadcrumb(
              categoryIds.map((id, i) => ({ id, name: categoryPath[i] })),
            );
          }
        }}
      />

      <RenameToast
        category={selectedCategory}
        visible={showRenameToast}
        onRename={handleRenameCategory}
        onDelete={handleDeleteCategory}
        onClose={() => setShowRenameToast(false)}
      />

      <AdBanner />
    </View>
  );
}
