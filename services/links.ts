import firestore from '@react-native-firebase/firestore';
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

  console.log('[1/3] analyzeLink 호출 시작:', url);
  const analyzeResult = await httpsCallable(fns, 'analyzeLink')({ url });
  const metadata = analyzeResult.data as any;
  console.log('[1/3] analyzeLink 성공:', metadata.title);

  console.log('[2/3] categorizeLink 호출 시작');
  const categorizeResult = await httpsCallable(fns, 'categorizeLink')({
    metadata,
  });
  const classification = categorizeResult.data as any;
  console.log('[2/3] categorizeLink 성공:', classification.categoryPath);

  console.log('[3/3] saveLink 호출 시작');
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
  console.log('[3/3] saveLink 성공');

  const saveData = saveResult.data as { linkId: string; categoryPath: string[] };
  return { ...saveData, categoryIds: classification.categoryIds };
}

export function getLinksQuery(
  userId: string,
  categoryId?: string,
  pageSize = 20,
) {
  let query = getLinksRef(userId)
    .orderBy('savedAt', 'desc')
    .limit(pageSize);

  if (categoryId) {
    query = query.where('categoryPath', 'array-contains', categoryId);
  }

  return query;
}

export function getFavoriteLinksQuery(userId: string, pageSize = 20) {
  return getLinksRef(userId)
    .where('isFavorite', '==', true)
    .orderBy('savedAt', 'desc')
    .limit(pageSize);
}

export async function toggleFavorite(userId: string, linkId: string, isFavorite: boolean) {
  await getLinksRef(userId).doc(linkId).update({ isFavorite: !isFavorite });
}

export async function deleteLink(userId: string, linkId: string, categoryPath: string[]) {
  const batch = firestore().batch();

  batch.delete(getLinksRef(userId).doc(linkId));

  for (const catId of categoryPath) {
    batch.update(getCategoriesRef(userId).doc(catId), {
      linkCount: firestore.FieldValue.increment(-1),
    });
  }

  batch.update(getUserRef(userId), {
    linkCount: firestore.FieldValue.increment(-1),
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
  const batch = firestore().batch();

  batch.update(getLinksRef(userId).doc(linkId), { categoryPath: newCategoryPath });

  for (const catId of oldCategoryPath) {
    batch.update(
      getCategoriesRef(userId).doc(catId),
      { linkCount: firestore.FieldValue.increment(-1) },
    );
  }

  for (const catId of newCategoryPath) {
    batch.update(
      getCategoriesRef(userId).doc(catId),
      { linkCount: firestore.FieldValue.increment(1) },
    );
  }

  await batch.commit();
}

export async function searchLinks(userId: string, query: string): Promise<Link[]> {
  const lowerQuery = query.toLowerCase();

  const snapshot = await getLinksRef(userId)
    .orderBy('savedAt', 'desc')
    .get();

  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() } as Link))
    .filter(
      (link) =>
        link.title.toLowerCase().includes(lowerQuery) ||
        link.url.toLowerCase().includes(lowerQuery) ||
        link.description.toLowerCase().includes(lowerQuery) ||
        link.tags.some((tag) => tag.toLowerCase().includes(lowerQuery)),
    );
}
