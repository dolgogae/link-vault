import { useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { useAuthStore } from '@/stores/authStore';
import { useLinkStore } from '@/stores/linkStore';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { getRootCategoriesQuery, getChildCategoriesQuery } from '@/services/categories';
import { getLinksQuery, toggleFavorite } from '@/services/links';
import { CategoryFolder } from '@/components/CategoryFolder';
import { LinkCard } from '@/components/LinkCard';
import { SearchBar } from '@/components/SearchBar';
import { AddLinkModal } from '@/components/AddLinkModal';
import { CategoryActionSheet } from '@/components/CategoryActionSheet';
import { Category, Link } from '@/types';
import * as WebBrowser from 'expo-web-browser';

export default function HomeScreen() {
  const { user } = useAuthStore();
  const {
    currentCategoryId,
    categoryBreadcrumb,
    navigateToCategory,
    goBackCategory,
    resetNavigation,
  } = useLinkStore();

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [showCategoryAction, setShowCategoryAction] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const userId = user?.uid || '';

  // 카테고리 쿼리
  const { data: categories, loading: loadingCats } = useFirestoreQuery<Category>(
    userId
      ? () =>
          currentCategoryId
            ? getChildCategoriesQuery(userId, currentCategoryId)
            : getRootCategoriesQuery(userId)
      : null,
    [userId, currentCategoryId, refreshKey],
  );

  // 현재 카테고리 내 링크 쿼리
  const { data: links, loading: loadingLinks } = useFirestoreQuery<Link>(
    userId && currentCategoryId
      ? () => getLinksQuery(userId, currentCategoryId)
      : null,
    [userId, currentCategoryId, refreshKey],
  );

  useFocusEffect(
    useCallback(() => {
      resetNavigation();
    }, [resetNavigation]),
  );

  const handleCategoryPress = (category: Category) => {
    navigateToCategory(category.id, category.name);
  };

  const handleCategoryLongPress = (category: Category) => {
    setSelectedCategory(category);
    setShowCategoryAction(true);
  };

  const handleLinkPress = async (link: Link) => {
    await WebBrowser.openBrowserAsync(link.url);
  };

  const handleFavoritePress = async (link: Link) => {
    if (!userId) return;
    await toggleFavorite(userId, link.id, link.isFavorite);
  };

  const isLoading = loadingCats || loadingLinks;

  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      {/* 헤더 */}
      <View className="pt-2 px-4 pb-1">
        {/* Breadcrumb */}
        {categoryBreadcrumb.length > 0 && (
          <View className="flex-row items-center mb-2">
            <Pressable onPress={goBackCategory} className="mr-2 p-1">
              <FontAwesome name="chevron-left" size={14} color="#2563EB" />
            </Pressable>
            <Pressable onPress={resetNavigation}>
              <Text className="text-sm text-primary">홈</Text>
            </Pressable>
            {categoryBreadcrumb.map((item, i) => (
              <View key={item.id} className="flex-row items-center">
                <Text className="text-sm text-text-secondary mx-1">/</Text>
                <Text
                  className={`text-sm ${
                    i === categoryBreadcrumb.length - 1
                      ? 'text-text dark:text-text-dark font-medium'
                      : 'text-primary'
                  }`}
                >
                  {item.name}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* 뷰 모드 토글 */}
        <View className="flex-row justify-end mb-1">
          <Pressable onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}>
            <FontAwesome
              name={viewMode === 'grid' ? 'th-large' : 'list'}
              size={18}
              color="#6B7280"
            />
          </Pressable>
        </View>
      </View>

      {/* 컨텐츠 */}
      <FlatList
        data={[
          ...(categories.length > 0 ? [{ type: 'categories' as const, items: categories }] : []),
          ...(links.length > 0 ? [{ type: 'links' as const, items: links }] : []),
        ]}
        keyExtractor={(_, index) => `section-${index}`}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => setRefreshKey((k) => k + 1)}
          />
        }
        ListEmptyComponent={
          !isLoading ? (
            <View className="flex-1 items-center justify-center pt-20">
              <FontAwesome name="folder-open-o" size={48} color="#9CA3AF" />
              <Text className="text-base text-text-secondary dark:text-text-dark-secondary mt-4">
                {currentCategoryId
                  ? '이 카테고리가 비어있습니다'
                  : '아직 저장된 링크가 없습니다'}
              </Text>
              <Pressable
                onPress={() => setShowAddModal(true)}
                className="mt-4 bg-primary px-6 py-2.5 rounded-xl"
              >
                <Text className="text-white font-medium">첫 링크 저장하기</Text>
              </Pressable>
            </View>
          ) : null
        }
        renderItem={({ item: section }) => {
          if (section.type === 'categories') {
            if (viewMode === 'grid') {
              return (
                <View className="flex-row flex-wrap justify-between px-4 gap-3 mb-4">
                  {(section.items as Category[]).map((cat) => (
                    <CategoryFolder
                      key={cat.id}
                      category={cat}
                      onPress={handleCategoryPress}
                      onLongPress={handleCategoryLongPress}
                      viewMode="grid"
                    />
                  ))}
                </View>
              );
            }
            return (
              <View className="mb-4">
                {(section.items as Category[]).map((cat) => (
                  <CategoryFolder
                    key={cat.id}
                    category={cat}
                    onPress={handleCategoryPress}
                    onLongPress={handleCategoryLongPress}
                    viewMode="list"
                  />
                ))}
              </View>
            );
          }

          return (
            <View className="px-4">
              {(section.items as Link[]).map((link) => (
                <LinkCard
                  key={link.id}
                  link={link}
                  onPress={handleLinkPress}
                  onFavoritePress={handleFavoritePress}
                  viewMode="list"
                />
              ))}
            </View>
          );
        }}
      />

      {/* FAB */}
      <Pressable
        onPress={() => setShowAddModal(true)}
        className="absolute bottom-6 right-6 w-14 h-14 bg-primary rounded-full items-center justify-center shadow-lg active:bg-primary-dark"
        style={{ elevation: 5 }}
      >
        <FontAwesome name="plus" size={22} color="#FFFFFF" />
      </Pressable>

      {/* 모달 */}
      <AddLinkModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />

      <CategoryActionSheet
        visible={showCategoryAction}
        category={selectedCategory}
        userId={userId}
        onClose={() => setShowCategoryAction(false)}
        onUpdated={() => setRefreshKey((k) => k + 1)}
      />
    </View>
  );
}
