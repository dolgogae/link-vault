import { useState, useMemo, useCallback } from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Swipeable } from 'react-native-gesture-handler';
import { useAuthStore } from '@/stores/authStore';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { getChildCategoriesQuery } from '@/services/categories';
import { Category, Link } from '@/types';
import { getTimeAgo } from '@/utils/time';

const INDENT_PX = 24;

/* ─── Tree Link Item (compact, within tree) ─── */
function TreeLinkItem({
  link,
  depth,
  onPress,
  onFavoritePress,
  onDeletePress,
  onMovePress,
}: {
  link: Link;
  depth: number;
  onPress: (link: Link) => void;
  onFavoritePress: (link: Link) => void;
  onDeletePress: (link: Link) => void;
  onMovePress: (link: Link) => void;
}) {
  return (
    <Pressable
      onPress={() => onPress(link)}
      onLongPress={() => onDeletePress(link)}
      style={{ paddingLeft: depth * INDENT_PX + 12 }}
      className="flex-row items-center py-2 pr-4 active:bg-surface dark:active:bg-surface-dark"
    >
      {link.ogImage ? (
        <Image
          source={{ uri: link.ogImage }}
          className="w-10 h-10 rounded-lg mr-2.5"
          resizeMode="cover"
        />
      ) : (
        <View className="w-10 h-10 rounded-lg bg-primary/8 dark:bg-primary/15 items-center justify-center mr-2.5">
          <FontAwesome name="link" size={14} color="#8000C8" />
        </View>
      )}

      <View className="flex-1 mr-2">
        <Text
          className="text-[14px] text-text dark:text-text-dark leading-[18px]"
          numberOfLines={1}
        >
          {link.title}
        </Text>
        <Text
          className="text-[11px] text-text-secondary dark:text-text-dark-secondary mt-0.5"
          numberOfLines={1}
        >
          {link.domain}
        </Text>
      </View>

      <Pressable onPress={() => onFavoritePress(link)} hitSlop={10} className="p-1.5">
        <FontAwesome
          name={link.isFavorite ? 'star' : 'star-o'}
          size={14}
          color={link.isFavorite ? '#F59E0B' : '#D1D5DB'}
        />
      </Pressable>
    </Pressable>
  );
}

/* ─── Tree Node (recursive) ─── */
function FolderTreeNode({
  category,
  allLinks,
  depth,
  onCategoryLongPress,
  onLinkPress,
  onFavoritePress,
  onDeletePress,
  onMovePress,
}: {
  category: Category;
  allLinks: Link[];
  depth: number;
  onCategoryLongPress: (cat: Category) => void;
  onLinkPress: (link: Link) => void;
  onFavoritePress: (link: Link) => void;
  onDeletePress: (link: Link) => void;
  onMovePress: (link: Link) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { user } = useAuthStore();
  const userId = user?.uid || '';

  const { data: children } = useFirestoreQuery<Category>(
    expanded && userId
      ? () => getChildCategoriesQuery(userId, category.id)
      : null,
    [userId, category.id, expanded],
  );

  const directLinks = useMemo(
    () =>
      allLinks.filter(
        (link) =>
          link.categoryPath?.[link.categoryPath.length - 1] === category.id,
      ),
    [allLinks, category.id],
  );

  const toggle = useCallback(() => setExpanded((v) => !v), []);

  return (
    <View>
      {/* Folder row */}
      <Pressable
        onPress={toggle}
        onLongPress={() => onCategoryLongPress(category)}
        style={{ paddingLeft: depth * INDENT_PX + 12 }}
        className="flex-row items-center py-2.5 pr-4 active:bg-surface dark:active:bg-surface-dark"
      >
        <FontAwesome
          name={expanded ? 'caret-down' : 'caret-right'}
          size={14}
          color="#9CA3AF"
          style={{ width: 18, textAlign: 'center' }}
        />

        <View className="w-7 h-7 rounded-md bg-primary/10 items-center justify-center mx-2">
          <FontAwesome name="folder" size={14} color="#8000C8" />
        </View>

        <Text
          className="flex-1 text-[15px] text-text dark:text-text-dark font-medium"
          numberOfLines={1}
        >
          {category.name}
        </Text>

        {category.linkCount > 0 && (
          <Text className="text-xs text-text-secondary dark:text-text-dark-secondary ml-1">
            {category.linkCount}
          </Text>
        )}
      </Pressable>

      {/* Expanded children */}
      {expanded && (
        <View>
          {children.map((child) => (
            <FolderTreeNode
              key={child.id}
              category={child}
              allLinks={allLinks}
              depth={depth + 1}
              onCategoryLongPress={onCategoryLongPress}
              onLinkPress={onLinkPress}
              onFavoritePress={onFavoritePress}
              onDeletePress={onDeletePress}
              onMovePress={onMovePress}
            />
          ))}
          {directLinks.map((link) => (
            <TreeLinkItem
              key={link.id}
              link={link}
              depth={depth + 1}
              onPress={onLinkPress}
              onFavoritePress={onFavoritePress}
              onDeletePress={onDeletePress}
              onMovePress={onMovePress}
            />
          ))}
          {children.length === 0 && directLinks.length === 0 && (
            <Text
              style={{ paddingLeft: (depth + 1) * INDENT_PX + 12 }}
              className="text-xs text-text-secondary/50 dark:text-text-dark-secondary/50 py-2"
            >
              비어있음
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

/* ─── Main export ─── */
export function FolderTreeView({
  categories,
  allLinks,
  onCategoryLongPress,
  onLinkPress,
  onFavoritePress,
  onDeletePress,
  onMovePress,
}: {
  categories: Category[];
  allLinks: Link[];
  onCategoryLongPress: (cat: Category) => void;
  onLinkPress: (link: Link) => void;
  onFavoritePress: (link: Link) => void;
  onDeletePress: (link: Link) => void;
  onMovePress: (link: Link) => void;
}) {
  return (
    <View className="mt-1">
      {categories.map((cat) => (
        <FolderTreeNode
          key={cat.id}
          category={cat}
          allLinks={allLinks}
          depth={0}
          onCategoryLongPress={onCategoryLongPress}
          onLinkPress={onLinkPress}
          onFavoritePress={onFavoritePress}
          onDeletePress={onDeletePress}
          onMovePress={onMovePress}
        />
      ))}
    </View>
  );
}
