import { useState } from 'react';
import { View, Text, FlatList, RefreshControl } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as WebBrowser from 'expo-web-browser';

import { useAuthStore } from '@/stores/authStore';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { getFavoriteLinksQuery, toggleFavorite } from '@/services/links';
import { LinkCard } from '@/components/LinkCard';
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
            <View className="items-center pt-20">
              <FontAwesome name="star-o" size={48} color="#9CA3AF" />
              <Text className="text-base text-text-secondary dark:text-text-dark-secondary mt-4">
                즐겨찾기한 링크가 없습니다
              </Text>
              <Text className="text-sm text-text-secondary/60 mt-1">
                링크의 별 아이콘을 탭하여 즐겨찾기에 추가하세요
              </Text>
            </View>
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
