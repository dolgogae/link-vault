import {
  getFirestore,
  doc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  updateDoc,
  writeBatch,
  increment,
} from '@react-native-firebase/firestore';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { Link } from '@/types';
import { getUserRef, getLinksRef, getCategoriesRef } from '@/utils/firestore';
import { pruneEmptyAncestors } from '@/services/categories';

export async function analyzeAndSaveLink(url: string): Promise<{
  linkId: string;
  categoryPath: string[];
  categoryIds: string[];
}> {
  const fns = getFunctions();

  const analyzeResult = await httpsCallable(fns, 'analyzeLink')({ url });
  const metadata = analyzeResult.data as any;

  const categorizeResult = await httpsCallable(fns, 'categorizeLink')({
    metadata,
  });
  const classification = categorizeResult.data as any;

  const saveResult = await httpsCallable(fns, 'saveLink')({
    url,
    title: metadata.title,
    description: metadata.description,
    ogImage: metadata.ogImage,
    favicon: metadata.favicon,
    domain: metadata.domain,
    categoryIds: classification.categoryIds,
    categoryPath: classification.categoryPath,
    tags: classification.tags,
    icon: classification.icon,
  });

  const saveData = saveResult.data as { linkId: string; categoryPath: string[] };
  return { ...saveData, categoryIds: classification.categoryIds };
}

export function getLinksQuery(
  userId: string,
  categoryId?: string,
  pageSize = 20,
) {
  if (categoryId) {
    return query(
      getLinksRef(userId),
      where('categoryPath', 'array-contains', categoryId),
      orderBy('savedAt', 'desc'),
      limit(pageSize),
    );
  }

  return query(
    getLinksRef(userId),
    orderBy('savedAt', 'desc'),
    limit(pageSize),
  );
}

export function getFavoriteLinksQuery(userId: string, pageSize = 20) {
  return query(
    getLinksRef(userId),
    where('isFavorite', '==', true),
    orderBy('savedAt', 'desc'),
    limit(pageSize),
  );
}

export async function toggleFavorite(userId: string, linkId: string, isFavorite: boolean) {
  await updateDoc(doc(getLinksRef(userId), linkId), { isFavorite: !isFavorite });
}

export async function deleteLink(userId: string, linkId: string, categoryPath: string[]) {
  const db = getFirestore();
  const batch = writeBatch(db);

  batch.delete(doc(getLinksRef(userId), linkId));

  for (const catId of categoryPath) {
    batch.update(doc(getCategoriesRef(userId), catId), {
      linkCount: increment(-1),
    });
  }

  batch.update(getUserRef(userId), {
    linkCount: increment(-1),
  });

  await batch.commit();

  // 빈 폴더 자동 정리 (리프 → 루트 방향)
  await pruneEmptyAncestors(userId, categoryPath);
}

export async function moveLink(
  userId: string,
  linkId: string,
  oldCategoryPath: string[],
  newCategoryPath: string[],
) {
  const db = getFirestore();
  const batch = writeBatch(db);

  batch.update(doc(getLinksRef(userId), linkId), { categoryPath: newCategoryPath });

  for (const catId of oldCategoryPath) {
    batch.update(
      doc(getCategoriesRef(userId), catId),
      { linkCount: increment(-1) },
    );
  }

  for (const catId of newCategoryPath) {
    batch.update(
      doc(getCategoriesRef(userId), catId),
      { linkCount: increment(1) },
    );
  }

  await batch.commit();
}

export async function searchLinks(userId: string, queryStr: string): Promise<Link[]> {
  const lowerQuery = queryStr.toLowerCase();

  const snapshot = await getDocs(
    query(getLinksRef(userId), orderBy('savedAt', 'desc')),
  );

  return snapshot.docs
    .map((d: { id: string; data: () => Record<string, any> }) => ({ id: d.id, ...d.data() } as Link))
    .filter(
      (link: Link) =>
        link.title.toLowerCase().includes(lowerQuery) ||
        link.url.toLowerCase().includes(lowerQuery) ||
        link.description.toLowerCase().includes(lowerQuery) ||
        link.tags.some((tag: string) => tag.toLowerCase().includes(lowerQuery)),
    );
}
