import { useState } from 'react';
import { View, FlatList, RefreshControl } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { useAuthStore } from '@/stores/authStore';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { getFavoriteLinksQuery, toggleFavorite } from '@/services/links';
import { LinkCard } from '@/components/LinkCard';
import { EmptyState } from '@/components/EmptyState';
import { Link } from '@/types';

export default function FavoritesScreen() {
  const { user } = useAuthStore();
  const userId = user?.uid || '';
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: favorites, loading } = useFirestoreQuery<Link>(
    userId ? () => getFavoriteLinksQuery(userId) : null,
    [userId, refreshKey],
  );

  const handleLinkPress = async (link: Link) => {
    await WebBrowser.openBrowserAsync(link.url);
  };

  const handleFavoritePress = async (link: Link) => {
    if (!userId) return;
    await toggleFavorite(userId, link.id, link.isFavorite);
  };

  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      <FlatList
        data={favorites}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => setRefreshKey((k) => k + 1)}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="star-o"
              title="즐겨찾기한 링크가 없습니다"
              subtitle="링크의 별 아이콘을 탭하여 즐겨찾기에 추가하세요"
            />
          ) : null
        }
        renderItem={({ item }) => (
          <LinkCard
            link={item}
            onPress={handleLinkPress}
            onFavoritePress={handleFavoritePress}
            viewMode="list"
          />
        )}
      />
    </View>
  );
}
