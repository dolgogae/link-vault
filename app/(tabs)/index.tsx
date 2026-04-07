import { useState, useCallback, useMemo, useEffect, useLayoutEffect } from 'react';
import { View, Text, FlatList, ScrollView, Pressable, RefreshControl, Alert, BackHandler } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useNavigation } from 'expo-router';

import { useAuthStore } from '@/stores/authStore';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { useLinkActions } from '@/hooks/useLinkActions';
import { getRootCategoriesQuery, getChildCategoriesQuery, renameCategory, deleteCategory as deleteCategoryService, runCleanupIfNeeded, pruneAllEmptyCategories } from '@/services/categories';
import { getLinksQuery, toggleFavorite } from '@/services/links';
import { CategoryFolder } from '@/components/CategoryFolder';
import { LinkCard } from '@/components/LinkCard';
import { AddLinkModal } from '@/components/AddLinkModal';
import { MoveLinkModal } from '@/components/MoveLinkModal';
import { RenameToast } from '@/components/RenameToast';
import { AdBanner } from '@/components/AdBanner';
import { EmptyState } from '@/components/EmptyState';
import { FolderTreeView } from '@/components/FolderTreeView';
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

  // 루트 레벨인지 여부
  const isRoot = breadcrumb.length === 0;

  const {
    movingLink,
    setMovingLink,
    handleDeleteLink,
    handleMoveLink,
    handleLinkLongPress,
  } = useLinkActions(userId, () => setRefreshKey((k) => k + 1));

  useInterstitialAd();

  // 기존 데이터 정리 (이모지 제거 + 중복 병합) - 1회 자동 실행
  useEffect(() => {
    if (!userId) return;
    runCleanupIfNeeded(userId).then((didRun) => {
      if (didRun) setRefreshKey((k) => k + 1);
    });
  }, [userId]);

  const navigation = useNavigation();

  const handlePruneEmpty = useCallback(() => {
    Alert.alert('빈 폴더 정리', '링크가 없는 빈 폴더를 모두 삭제합니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '정리',
        style: 'destructive',
        onPress: async () => {
          try {
            const count = await pruneAllEmptyCategories(userId);
            if (count > 0) {
              Alert.alert('완료', `빈 폴더 ${count}개를 삭제했습니다.`);
              setCurrentCategoryId(null);
              setBreadcrumb([]);
              setRefreshKey((k) => k + 1);
            } else {
              Alert.alert('완료', '삭제할 빈 폴더가 없습니다.');
            }
          } catch {
            Alert.alert('오류', '폴더 정리에 실패했습니다.');
          }
        },
      },
    ]);
  }, [userId]);

  useLayoutEffect(() => {
    navigation.setOptions({ headerRight: () => null });
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
    if (catError) console.error('[Home] catError:', catError.message);
    if (linkError) console.error('[Home] linkError:', linkError.message);
  }, [childCategories, currentLinks, catError, linkError, currentCategoryId]);

  // 루트 폴더 탭 → 해당 폴더 안으로 진입 (breadcrumb 1단계)
  const navigateInto = useCallback((category: Category) => {
    setCurrentCategoryId(category.id);
    setBreadcrumb((prev) => [...prev, { id: category.id, name: category.name }]);
  }, []);

  const navigateTo = useCallback((index: number) => {
    if (index < 0) {
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

  // 하드웨어 뒤로가기 → 루트로 복귀
  useEffect(() => {
    const onBackPress = () => {
      if (breadcrumb.length > 0) {
        navigateTo(-1);
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [breadcrumb.length, navigateTo]);

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


  const isLoading = loadingCats || loadingLinks;
  const hasError = catError || linkError;
  const isEmpty = childCategories.length === 0 && currentLinks.length === 0;

  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={isLoading && refreshKey > 0}
            onRefresh={() => setRefreshKey((k) => k + 1)}
            tintColor="#8000C8"
          />
        }
      >
        {/* 브레드크럼 네비게이션 */}
        {breadcrumb.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6, alignItems: 'center' }}
          >
            <Pressable
              onPress={() => navigateTo(-1)}
              className="flex-row items-center h-10 px-3.5 rounded-full bg-surface dark:bg-surface-dark mr-1.5"
            >
              <FontAwesome name="home" size={15} color="#8000C8" />
            </Pressable>
            {breadcrumb.map((crumb, index) => {
              const isLast = index === breadcrumb.length - 1;
              return (
                <View key={`${crumb.id}-${index}`} className="flex-row items-center">
                  <FontAwesome name="chevron-right" size={10} color="#9CA3AF" style={{ marginHorizontal: 6 }} />
                  <Pressable
                    onPress={isLast ? undefined : () => navigateTo(index)}
                    className={`h-10 px-4 rounded-full items-center justify-center ${
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
            className="mx-6 mt-3 mb-1 p-3.5 bg-red-50 dark:bg-red-900/20 rounded-xl"
          >
            <Text className="text-red-600 dark:text-red-400 text-sm">
              데이터를 불러오지 못했습니다. 탭하여 다시 시도
            </Text>
            <Text className="text-red-400/70 text-xs mt-1" numberOfLines={2}>
              {catError?.message || linkError?.message}
            </Text>
          </Pressable>
        )}

        {/* ── 루트: 폴더 그리드 ── */}
        {isRoot && childCategories.length > 0 && (
          <View className="pt-5">
            <View className="flex-row items-center justify-between px-6 mb-3">
              <Text className="text-sm font-semibold text-text-secondary dark:text-text-dark-secondary">
                폴더
              </Text>
              <Pressable
                onPress={handlePruneEmpty}
                className="py-1.5 px-3 rounded-lg active:bg-surface dark:active:bg-surface-dark"
              >
                <Text className="text-sm text-text-secondary/60 dark:text-text-dark-secondary/60">
                  빈폴더 정리
                </Text>
              </Pressable>
            </View>
            <View className="flex-row flex-wrap px-5">
              {childCategories.map((cat) => (
                <CategoryFolder
                  key={cat.id}
                  category={cat}
                  onPress={navigateInto}
                  onLongPress={handleCategoryLongPress}
                />
              ))}
            </View>
          </View>
        )}

        {/* ── 폴더 안: 트리 뷰 ── */}
        {!isRoot && childCategories.length > 0 && (
          <View className="pt-3">
            <View className="flex-row items-center justify-between px-6 mb-2">
              <Text className="text-sm font-semibold text-text-secondary dark:text-text-dark-secondary">
                폴더
              </Text>
              <Pressable
                onPress={handlePruneEmpty}
                className="py-1.5 px-3 rounded-lg active:bg-surface dark:active:bg-surface-dark"
              >
                <Text className="text-sm text-text-secondary/60 dark:text-text-dark-secondary/60">
                  빈폴더 정리
                </Text>
              </Pressable>
            </View>
            <FolderTreeView
              categories={childCategories}
              allLinks={allLinks}
              onCategoryLongPress={handleCategoryLongPress}
              onLinkPress={handleLinkPress}
              onLinkLongPress={handleLinkLongPress}
              onFavoritePress={handleFavoritePress}
              onDeletePress={handleDeleteLink}
              onMovePress={(l) => setMovingLink(l)}
            />
          </View>
        )}

        {/* ── 폴더 안: 직속 링크 ── */}
        {!isRoot && currentLinks.length > 0 && (
          <View className="mt-2">
            {childCategories.length > 0 && (
              <View className="h-px bg-surface dark:bg-surface-dark mx-6 mb-2" />
            )}
            {currentLinks.map((link) => (
              <LinkCard
                key={link.id}
                link={link}
                onPress={handleLinkPress}
                onFavoritePress={handleFavoritePress}
                onDeletePress={handleDeleteLink}
                onMovePress={(l) => setMovingLink(l)}
                onLongPress={handleLinkLongPress}
                viewMode="list"
              />
            ))}
          </View>
        )}

        {/* ── 빈 폴더 ── */}
        {!isRoot && isEmpty && !isLoading && (
          <EmptyState
            icon="folder-open-o"
            title="이 폴더가 비어있습니다"
          />
        )}

        {/* ── 루트 비어있음 ── */}
        {isRoot && isEmpty && !isLoading && (
          <EmptyState
            icon="folder-open-o"
            title="아직 저장된 링크가 없습니다"
            subtitle="링크를 저장하면 AI가 자동으로 폴더에 분류합니다"
            action={{ label: '첫 링크 저장하기', onPress: () => setShowAddModal(true) }}
          />
        )}
      </ScrollView>

      {/* FAB — 링크 추가 */}
      <Pressable
        onPress={() => setShowAddModal(true)}
        className="absolute bottom-24 right-5 w-14 h-14 rounded-full bg-primary items-center justify-center active:bg-primary/80"
        style={{
          shadowColor: '#8000C8',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 6,
        }}
      >
        <FontAwesome name="plus" size={22} color="#FFFFFF" />
      </Pressable>

      <AddLinkModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSaved={(categoryPath, categoryIds) => {
          // 저장 후 해당 루트 폴더로 이동 (트리가 펼쳐지는 방식이므로 루트만)
          const rootId = categoryIds[0];
          if (rootId) {
            setCurrentCategoryId(rootId);
            setBreadcrumb([{ id: rootId, name: categoryPath[0] }]);
          }
        }}
      />

      <MoveLinkModal
        visible={!!movingLink}
        link={movingLink}
        onMove={handleMoveLink}
        onClose={() => setMovingLink(null)}
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
