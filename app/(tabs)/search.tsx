import { useState, useCallback } from 'react';
import { View, FlatList, ActivityIndicator } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { useAuthStore } from '@/stores/authStore';
import { SearchBar } from '@/components/SearchBar';
import { LinkCard } from '@/components/LinkCard';
import { EmptyState } from '@/components/EmptyState';
import { searchLinks, toggleFavorite } from '@/services/links';
import { Link } from '@/types';

export default function SearchScreen() {
  const { user } = useAuthStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Link[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const userId = user?.uid || '';

  const handleSearch = useCallback(
    async (text: string) => {
      setQuery(text);
      if (!text.trim() || !userId) {
        setResults([]);
        setHasSearched(false);
        return;
      }

      setIsSearching(true);
      setHasSearched(true);
      try {
        const found = await searchLinks(userId, text.trim());
        setResults(found);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [userId],
  );

  const handleLinkPress = async (link: Link) => {
    await WebBrowser.openBrowserAsync(link.url);
  };

  const handleFavoritePress = async (link: Link) => {
    if (!userId) return;
    await toggleFavorite(userId, link.id, link.isFavorite);
    // 결과 새로고침
    if (query.trim()) {
      const found = await searchLinks(userId, query.trim());
      setResults(found);
    }
  };

  return (
    <View className="flex-1 bg-background dark:bg-background-dark">
      <SearchBar
        value={query}
        onChangeText={handleSearch}
        placeholder="제목, URL, 태그로 검색..."
        autoFocus
      />

      {isSearching && (
        <View className="items-center py-8">
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      )}

      {!isSearching && hasSearched && results.length === 0 && (
        <EmptyState icon="search" title="검색 결과가 없습니다" />
      )}

      {!isSearching && !hasSearched && (
        <EmptyState
          icon="search"
          title="링크를 검색해보세요"
          subtitle="제목, URL, 태그, 설명으로 검색할 수 있습니다"
        />
      )}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
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
