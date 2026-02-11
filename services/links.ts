import firestore from '@react-native-firebase/firestore';
import { firebase } from '@/services/firebase';
import { Link } from '@/types';

const functions = firebase.app().functions('us-central1');

/**
 * URL을 분석하고 AI로 분류한 후 저장
 */
export async function analyzeAndSaveLink(url: string): Promise<{
  linkId: string;
  categoryPath: string[];
}> {
  // 1. 메타데이터 스크래핑
  const analyzeResult = await functions.httpsCallable('analyzeLink')({ url });
  const metadata = analyzeResult.data;

  // 2. AI 분류
  const categorizeResult = await functions.httpsCallable('categorizeLink')({
    metadata,
  });
  const classification = categorizeResult.data;

  // 3. 저장
  const saveResult = await functions.httpsCallable('saveLink')({
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

  return saveResult.data;
}

/**
 * 카테고리 내 링크 목록 조회 (페이지네이션)
 */
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

/**
 * 즐겨찾기 링크 조회
 */
export function getFavoriteLinksQuery(userId: string, pageSize = 20) {
  return firestore()
    .collection('users')
    .doc(userId)
    .collection('links')
    .where('isFavorite', '==', true)
    .orderBy('savedAt', 'desc')
    .limit(pageSize);
}

/**
 * 즐겨찾기 토글
 */
export async function toggleFavorite(userId: string, linkId: string, isFavorite: boolean) {
  await firestore()
    .collection('users')
    .doc(userId)
    .collection('links')
    .doc(linkId)
    .update({ isFavorite: !isFavorite });
}

/**
 * 링크 삭제
 */
export async function deleteLink(userId: string, linkId: string, categoryPath: string[]) {
  const batch = firestore().batch();

  // 링크 삭제
  const linkRef = firestore().collection('users').doc(userId).collection('links').doc(linkId);
  batch.delete(linkRef);

  // 카테고리 linkCount 감소
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

  // 사용자 linkCount 감소
  const userRef = firestore().collection('users').doc(userId);
  batch.update(userRef, {
    linkCount: firestore.FieldValue.increment(-1),
  });

  await batch.commit();
}

/**
 * 링크를 다른 카테고리로 이동
 */
export async function moveLink(
  userId: string,
  linkId: string,
  oldCategoryPath: string[],
  newCategoryPath: string[],
) {
  const batch = firestore().batch();

  const linkRef = firestore().collection('users').doc(userId).collection('links').doc(linkId);
  batch.update(linkRef, { categoryPath: newCategoryPath });

  // 이전 카테고리 linkCount 감소
  if (oldCategoryPath.length > 0) {
    const oldCatRef = firestore()
      .collection('users')
      .doc(userId)
      .collection('categories')
      .doc(oldCategoryPath[oldCategoryPath.length - 1]);
    batch.update(oldCatRef, { linkCount: firestore.FieldValue.increment(-1) });
  }

  // 새 카테고리 linkCount 증가
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

/**
 * 링크 검색 (클라이언트 사이드)
 */
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
