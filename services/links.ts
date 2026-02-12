import firestore from '@react-native-firebase/firestore';
import functions from '@react-native-firebase/functions';
import { Link } from '@/types';

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
  let query = firestore()
    .collection('users')
    .doc(userId)
    .collection('links')
    .orderBy('savedAt', 'desc')
    .limit(pageSize);

  if (categoryId) {
    query = query.where('categoryPath', 'array-contains', categoryId);
  }

  return query;
}

export function getFavoriteLinksQuery(userId: string, pageSize = 20) {
  return firestore()
    .collection('users')
    .doc(userId)
    .collection('links')
    .where('isFavorite', '==', true)
    .orderBy('savedAt', 'desc')
    .limit(pageSize);
}

export async function toggleFavorite(userId: string, linkId: string, isFavorite: boolean) {
  await firestore()
    .collection('users')
    .doc(userId)
    .collection('links')
    .doc(linkId)
    .update({ isFavorite: !isFavorite });
}

export async function deleteLink(userId: string, linkId: string, categoryPath: string[]) {
  const batch = firestore().batch();

  const linkRef = firestore().collection('users').doc(userId).collection('links').doc(linkId);
  batch.delete(linkRef);

  if (categoryPath.length > 0) {
    const lastCatId = categoryPath[categoryPath.length - 1];
    const catRef = firestore()
      .collection('users')
      .doc(userId)
      .collection('categories')
      .doc(lastCatId);
    batch.update(catRef, {
      linkCount: firestore.FieldValue.increment(-1),
    });
  }

  const userRef = firestore().collection('users').doc(userId);
  batch.update(userRef, {
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

  const linkRef = firestore().collection('users').doc(userId).collection('links').doc(linkId);
  batch.update(linkRef, { categoryPath: newCategoryPath });

  if (oldCategoryPath.length > 0) {
    const oldCatRef = firestore()
      .collection('users')
      .doc(userId)
      .collection('categories')
      .doc(oldCategoryPath[oldCategoryPath.length - 1]);
    batch.update(oldCatRef, { linkCount: firestore.FieldValue.increment(-1) });
  }

  if (newCategoryPath.length > 0) {
    const newCatRef = firestore()
      .collection('users')
      .doc(userId)
      .collection('categories')
      .doc(newCategoryPath[newCategoryPath.length - 1]);
    batch.update(newCatRef, { linkCount: firestore.FieldValue.increment(1) });
  }

  await batch.commit();
}

export async function searchLinks(userId: string, query: string): Promise<Link[]> {
  const lowerQuery = query.toLowerCase();

  const snapshot = await firestore()
    .collection('users')
    .doc(userId)
    .collection('links')
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
