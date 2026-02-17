import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { Category } from '@/types';
import { getCategoriesRef, getLinksRef, getUserRef, convertTimestamp } from '@/utils/firestore';

export function getRootCategoriesQuery(userId: string) {
  return getCategoriesRef(userId)
    .where('parentId', '==', null)
    .orderBy('order');
}

export function getChildCategoriesQuery(userId: string, parentId: string) {
  return getCategoriesRef(userId)
    .where('parentId', '==', parentId)
    .orderBy('order');
}

export function getAllCategoriesQuery(userId: string) {
  return getCategoriesRef(userId).orderBy('depth').orderBy('order');
}

export async function getAllCategories(userId: string): Promise<Category[]> {
  const snapshot = await getCategoriesRef(userId)
    .orderBy('depth')
    .orderBy('order')
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: convertTimestamp(doc.data().createdAt),
  })) as Category[];
}

export async function createCategory(
  userId: string,
  data: {
    name: string;
    parentId: string | null;
    depth: number;
    icon: string;
  },
): Promise<string> {
  const siblings = await getCategoriesRef(userId)
    .where('parentId', '==', data.parentId)
    .orderBy('order', 'desc')
    .limit(1)
    .get();

  const maxOrder = siblings.empty ? 0 : (siblings.docs[0].data().order || 0) + 1;

  const docRef = await getCategoriesRef(userId).add({
    name: data.name,
    parentId: data.parentId,
    depth: data.depth,
    order: maxOrder,
    linkCount: 0,
    icon: data.icon,
    createdAt: firestore.FieldValue.serverTimestamp(),
  });

  return docRef.id;
}

export async function renameCategory(
  userId: string,
  categoryId: string,
  newName: string,
): Promise<{ merged: boolean; targetId?: string }> {
  const catDoc = await getCategoriesRef(userId).doc(categoryId).get();
  const catData = catDoc.data();
  if (!catData) throw new Error('카테고리를 찾을 수 없습니다.');

  // 같은 부모 아래 동일한 이름의 형제 카테고리가 있는지 확인
  const parentId = catData.parentId ?? null;
  let siblingQuery = getCategoriesRef(userId).where('name', '==', newName);
  if (parentId !== null) {
    siblingQuery = siblingQuery.where('parentId', '==', parentId);
  } else {
    siblingQuery = siblingQuery.where('parentId', '==', null);
  }

  const siblings = await siblingQuery.get();
  const existingSibling = siblings.docs.find((doc) => doc.id !== categoryId);

  if (existingSibling) {
    // 동일 이름의 형제가 있으면 병합
    await mergeCategories(userId, categoryId, existingSibling.id);
    return { merged: true, targetId: existingSibling.id };
  }

  await getCategoriesRef(userId).doc(categoryId).update({ name: newName });
  return { merged: false };
}

/**
 * sourceId의 하위 카테고리와 링크를 모두 targetId로 이동 후 source 삭제
 */
async function mergeCategories(
  userId: string,
  sourceId: string,
  targetId: string,
) {
  const batch = firestore().batch();

  // 1. source의 하위 카테고리를 target 아래로 이동
  const children = await getCategoriesRef(userId)
    .where('parentId', '==', sourceId)
    .get();

  for (const doc of children.docs) {
    batch.update(doc.ref, { parentId: targetId });
  }

  // 2. source에 속한 링크의 categoryPath에서 sourceId → targetId 교체
  const links = await getLinksRef(userId)
    .where('categoryPath', 'array-contains', sourceId)
    .get();

  for (const doc of links.docs) {
    const currentPath: string[] = doc.data().categoryPath;
    const newPath = currentPath.map((id) => (id === sourceId ? targetId : id));
    batch.update(doc.ref, { categoryPath: newPath });
  }

  // 3. source의 linkCount를 target에 합산
  const sourceDoc = await getCategoriesRef(userId).doc(sourceId).get();
  const sourceLinkCount = sourceDoc.data()?.linkCount || 0;
  if (sourceLinkCount > 0) {
    batch.update(getCategoriesRef(userId).doc(targetId), {
      linkCount: firestore.FieldValue.increment(sourceLinkCount),
    });
  }

  // 4. source 삭제
  batch.delete(getCategoriesRef(userId).doc(sourceId));

  await batch.commit();
}

export async function updateCategoryIcon(userId: string, categoryId: string, icon: string) {
  await getCategoriesRef(userId).doc(categoryId).update({ icon });
}

/**
 * @param moveToParent true이면 하위 링크를 상위 카테고리로 이동, false이면 함께 삭제
 */
export async function deleteCategory(
  userId: string,
  categoryId: string,
  parentId: string | null,
  moveToParent: boolean,
) {
  const batch = firestore().batch();

  // 모든 하위 카테고리를 재귀적으로 수집
  const allDescendantIds = await collectDescendantIds(userId, categoryId);

  // 삭제 대상 카테고리 전체 (자기 자신 + 모든 하위)
  const allCategoryIds = [categoryId, ...allDescendantIds];

  // 해당 카테고리 및 모든 하위 카테고리에 속한 링크 수집
  const linkDocs: FirebaseFirestoreTypes.QueryDocumentSnapshot[] = [];
  for (const catId of allCategoryIds) {
    const links = await getLinksRef(userId)
      .where('categoryPath', 'array-contains', catId)
      .get();
    links.docs.forEach((doc) => {
      // 중복 방지
      if (!linkDocs.some((d) => d.id === doc.id)) {
        linkDocs.push(doc);
      }
    });
  }

  if (moveToParent && parentId) {
    // 직접 자식만 상위로 이동
    const directChildren = await getCategoriesRef(userId)
      .where('parentId', '==', categoryId)
      .get();

    linkDocs.forEach((doc) => {
      const currentPath: string[] = doc.data().categoryPath;
      const newPath = currentPath.filter((id) => id !== categoryId);
      batch.update(doc.ref, { categoryPath: newPath });
    });

    directChildren.docs.forEach((doc) => {
      batch.update(doc.ref, {
        parentId,
        depth: firestore.FieldValue.increment(-1),
      });
    });

    batch.delete(getCategoriesRef(userId).doc(categoryId));
  } else {
    // 모든 링크 삭제
    linkDocs.forEach((doc) => batch.delete(doc.ref));

    // 모든 하위 카테고리 삭제
    for (const catId of allCategoryIds) {
      batch.delete(getCategoriesRef(userId).doc(catId));
    }

    // 사용자 linkCount 감소
    if (linkDocs.length > 0) {
      batch.update(getUserRef(userId), {
        linkCount: firestore.FieldValue.increment(-linkDocs.length),
      });
    }
  }

  await batch.commit();
}

async function collectDescendantIds(
  userId: string,
  parentId: string,
): Promise<string[]> {
  const children = await getCategoriesRef(userId)
    .where('parentId', '==', parentId)
    .get();

  const ids: string[] = [];
  for (const doc of children.docs) {
    ids.push(doc.id);
    const grandchildren = await collectDescendantIds(userId, doc.id);
    ids.push(...grandchildren);
  }
  return ids;
}

export async function reorderCategories(
  userId: string,
  orderedIds: string[],
) {
  const batch = firestore().batch();

  orderedIds.forEach((id, index) => {
    batch.update(getCategoriesRef(userId).doc(id), { order: index });
  });

  await batch.commit();
}

const CLEANUP_VERSION = 1;

/**
 * 기존 데이터 정리 (이모지 제거 + 중복 병합)
 * 유저 문서의 cleanupVersion으로 1회만 실행
 */
export async function runCleanupIfNeeded(userId: string): Promise<boolean> {
  const userDoc = await getUserRef(userId).get();
  const currentVersion = userDoc.data()?.cleanupVersion || 0;

  if (currentVersion >= CLEANUP_VERSION) {
    return false; // 이미 실행됨
  }

  try {
    const fns = getFunctions();
    await httpsCallable(fns, 'cleanupCategories')({});
    await getUserRef(userId).set(
      { cleanupVersion: CLEANUP_VERSION },
      { merge: true },
    );
    console.log('[Cleanup] 카테고리 데이터 정리 완료');
    return true;
  } catch (error) {
    console.error('[Cleanup] 카테고리 정리 실패:', error);
    return false;
  }
}

/**
 * 수동으로 데이터 정리 실행 (설정 화면에서 호출)
 */
export async function runCleanupManual(): Promise<{ cleanedCount: number; mergedCount: number }> {
  const fns = getFunctions();
  const result = await httpsCallable(fns, 'cleanupCategories')({});
  return result.data as { cleanedCount: number; mergedCount: number };
}
