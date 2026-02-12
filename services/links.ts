import firestore from '@react-native-firebase/firestore';
import functions from '@react-native-firebase/functions';
import { Link } from '@/types';
import { getUserRef, getLinksRef, getCategoriesRef } from '@/utils/firestore';

export async function analyzeAndSaveLink(url: string): Promise<{
  linkId: string;
  categoryPath: string[];
}> {
  const analyzeResult = await functions().httpsCallable('analyzeLink')({ url });
  const metadata = analyzeResult.data as any;

  const categorizeResult = await functions().httpsCallable('categorizeLink')({
    metadata,
  });
  const classification = categorizeResult.data as any;

  const saveResult = await functions().httpsCallable('saveLink')({
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

  return saveResult.data as { linkId: string; categoryPath: string[] };
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

  if (categoryPath.length > 0) {
    const lastCatId = categoryPath[categoryPath.length - 1];
    batch.update(getCategoriesRef(userId).doc(lastCatId), {
      linkCount: firestore.FieldValue.increment(-1),
    });
  }

  batch.update(getUserRef(userId), {
    linkCount: firestore.FieldValue.increment(-1),
  });

  await batch.commit();
}

export async function moveLink(
  userId: string,
  linkId: string,
  oldCategoryPath: string[],
  newCategoryPath: string[],
) {
  const batch = firestore().batch();

  batch.update(getLinksRef(userId).doc(linkId), { categoryPath: newCategoryPath });

  if (oldCategoryPath.length > 0) {
    batch.update(
      getCategoriesRef(userId).doc(oldCategoryPath[oldCategoryPath.length - 1]),
      { linkCount: firestore.FieldValue.increment(-1) },
    );
  }

  if (newCategoryPath.length > 0) {
    batch.update(
      getCategoriesRef(userId).doc(newCategoryPath[newCategoryPath.length - 1]),
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
