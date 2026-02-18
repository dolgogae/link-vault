import {
  getFirestore,
  doc,
  query,
  where,
  orderBy,
  limit,
  getDoc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  writeBatch,
  increment,
  serverTimestamp,
} from '@react-native-firebase/firestore';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { Category } from '@/types';
import { getCategoriesRef, getLinksRef, getUserRef, convertTimestamp } from '@/utils/firestore';

type DocData = Record<string, any>;

export function getRootCategoriesQuery(userId: string) {
  return query(
    getCategoriesRef(userId),
    where('parentId', '==', null),
    orderBy('order'),
  );
}

export function getChildCategoriesQuery(userId: string, parentId: string) {
  return query(
    getCategoriesRef(userId),
    where('parentId', '==', parentId),
    orderBy('order'),
  );
}

export function getAllCategoriesQuery(userId: string) {
  return query(
    getCategoriesRef(userId),
    orderBy('depth'),
    orderBy('order'),
  );
}

export async function getAllCategories(userId: string): Promise<Category[]> {
  const snapshot = await getDocs(
    query(getCategoriesRef(userId), orderBy('depth'), orderBy('order')),
  );

  return snapshot.docs.map((d: { id: string; data: () => DocData }) => {
    const data = d.data();
    return { id: d.id, ...data, createdAt: convertTimestamp(data.createdAt) };
  }) as Category[];
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
  const siblings = await getDocs(
    query(
      getCategoriesRef(userId),
      where('parentId', '==', data.parentId),
      orderBy('order', 'desc'),
      limit(1),
    ),
  );

  const maxOrder = siblings.empty ? 0 : ((siblings.docs[0].data() as DocData).order || 0) + 1;

  const docRef = await addDoc(getCategoriesRef(userId), {
    name: data.name,
    parentId: data.parentId,
    depth: data.depth,
    order: maxOrder,
    linkCount: 0,
    icon: data.icon,
    createdAt: serverTimestamp(),
  });

  return docRef.id;
}

export async function renameCategory(
  userId: string,
  categoryId: string,
  newName: string,
): Promise<{ merged: boolean; targetId?: string }> {
  const catDoc = await getDoc(doc(getCategoriesRef(userId), categoryId));
  const catData = catDoc.data() as DocData | undefined;
  if (!catData) throw new Error('카테고리를 찾을 수 없습니다.');

  // 같은 부모 아래 동일한 이름의 형제 카테고리가 있는지 확인
  const parentId: string | null = catData.parentId ?? null;
  let siblingQuery;
  if (parentId !== null) {
    siblingQuery = query(
      getCategoriesRef(userId),
      where('name', '==', newName),
      where('parentId', '==', parentId),
    );
  } else {
    siblingQuery = query(
      getCategoriesRef(userId),
      where('name', '==', newName),
      where('parentId', '==', null),
    );
  }

  const siblings = await getDocs(siblingQuery);
  const existingSibling = siblings.docs.find((d: { id: string }) => d.id !== categoryId);

  if (existingSibling) {
    // 동일 이름의 형제가 있으면 병합
    await mergeCategories(userId, categoryId, existingSibling.id);
    return { merged: true, targetId: existingSibling.id };
  }

  await updateDoc(doc(getCategoriesRef(userId), categoryId), { name: newName });
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
  const db = getFirestore();
  const batch = writeBatch(db);

  // 1. source의 하위 카테고리를 target 아래로 이동
  const children = await getDocs(
    query(getCategoriesRef(userId), where('parentId', '==', sourceId)),
  );

  for (const childDoc of children.docs) {
    batch.update(childDoc.ref, { parentId: targetId });
  }

  // 2. source에 속한 링크의 categoryPath에서 sourceId → targetId 교체
  const links = await getDocs(
    query(getLinksRef(userId), where('categoryPath', 'array-contains', sourceId)),
  );

  for (const linkDoc of links.docs) {
    const currentPath: string[] = (linkDoc.data() as DocData).categoryPath;
    const newPath = currentPath.map((id: string) => (id === sourceId ? targetId : id));
    batch.update(linkDoc.ref, { categoryPath: newPath });
  }

  // 3. source의 linkCount를 target에 합산
  const sourceDoc = await getDoc(doc(getCategoriesRef(userId), sourceId));
  const sourceLinkCount = (sourceDoc.data() as DocData | undefined)?.linkCount || 0;
  if (sourceLinkCount > 0) {
    batch.update(doc(getCategoriesRef(userId), targetId), {
      linkCount: increment(sourceLinkCount),
    });
  }

  // 4. source 삭제
  batch.delete(doc(getCategoriesRef(userId), sourceId));

  await batch.commit();
}

export async function updateCategoryIcon(userId: string, categoryId: string, icon: string) {
  await updateDoc(doc(getCategoriesRef(userId), categoryId), { icon });
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
  const db = getFirestore();
  const batch = writeBatch(db);

  // 모든 하위 카테고리를 재귀적으로 수집
  const allDescendantIds = await collectDescendantIds(userId, categoryId);

  // 삭제 대상 카테고리 전체 (자기 자신 + 모든 하위)
  const allCategoryIds = [categoryId, ...allDescendantIds];

  // 해당 카테고리 및 모든 하위 카테고리에 속한 링크 수집
  const linkDocs: Array<{ id: string; ref: any; data: () => DocData }> = [];
  for (const catId of allCategoryIds) {
    const links = await getDocs(
      query(getLinksRef(userId), where('categoryPath', 'array-contains', catId)),
    );
    for (const linkDoc of links.docs) {
      if (!linkDocs.some((ld) => ld.id === linkDoc.id)) {
        linkDocs.push({ id: linkDoc.id, ref: linkDoc.ref, data: () => linkDoc.data() as DocData });
      }
    }
  }

  if (moveToParent && parentId) {
    // 직접 자식만 상위로 이동
    const directChildren = await getDocs(
      query(getCategoriesRef(userId), where('parentId', '==', categoryId)),
    );

    for (const ld of linkDocs) {
      const currentPath: string[] = ld.data().categoryPath;
      const newPath = currentPath.filter((id: string) => id !== categoryId);
      batch.update(ld.ref, { categoryPath: newPath });
    }

    for (const childDoc of directChildren.docs) {
      batch.update(childDoc.ref, {
        parentId,
        depth: increment(-1),
      });
    }

    batch.delete(doc(getCategoriesRef(userId), categoryId));
  } else {
    // 모든 링크 삭제
    for (const ld of linkDocs) batch.delete(ld.ref);

    // 모든 하위 카테고리 삭제
    for (const catId of allCategoryIds) {
      batch.delete(doc(getCategoriesRef(userId), catId));
    }

    // 사용자 linkCount 감소
    if (linkDocs.length > 0) {
      batch.update(getUserRef(userId), {
        linkCount: increment(-linkDocs.length),
      });
    }
  }

  await batch.commit();

  // 부모 체인에서 빈 폴더 자동 정리
  if (parentId) {
    // 삭제된 카테고리의 조상 경로를 수집
    const ancestorIds: string[] = [];
    let currentId: string | null = parentId;
    while (currentId) {
      ancestorIds.unshift(currentId);
      const docRef = doc(getCategoriesRef(userId), currentId);
      const parentData = (await getDoc(docRef)).data() as DocData | undefined;
      currentId = parentData?.parentId ?? null;
    }
    await pruneEmptyAncestors(userId, ancestorIds);
  }
}

async function collectDescendantIds(
  userId: string,
  parentId: string,
): Promise<string[]> {
  const children = await getDocs(
    query(getCategoriesRef(userId), where('parentId', '==', parentId)),
  );

  const ids: string[] = [];
  for (const childDoc of children.docs) {
    ids.push(childDoc.id);
    const grandchildren = await collectDescendantIds(userId, childDoc.id);
    ids.push(...grandchildren);
  }
  return ids;
}

/**
 * 리프에서 루트 방향으로 빈 카테고리를 자동 삭제
 * - linkCount가 0이고 하위 카테고리도 없는 폴더를 정리
 * - 상위로 올라가며 연쇄 삭제
 */
export async function pruneEmptyAncestors(
  userId: string,
  categoryIds: string[],
) {
  for (let i = categoryIds.length - 1; i >= 0; i--) {
    const catId = categoryIds[i];

    // 서버에서 직접 읽어 캐시 이슈 방지
    const catDoc = await getDocFromServer(doc(getCategoriesRef(userId), catId));
    if (!catDoc.exists) {
      continue;
    }

    const data = catDoc.data() as DocData;
    const linkCount = data.linkCount ?? 0;
    
    if (linkCount > 0) {
      break;
    }

    // 하위 카테고리가 있는지 확인
    const children = await getDocsFromServer(
      query(
        getCategoriesRef(userId),
        where('parentId', '==', catId),
        limit(1),
      ),
    );

    if (!children.empty) {
      break;
    }

    // 비어있으므로 삭제
    await deleteDoc(doc(getCategoriesRef(userId), catId));
  }
}

/**
 * 전체 빈 폴더 일괄 삭제 (리프부터 역순으로)
 * linkCount가 0이고 하위 카테고리도 없는 폴더를 모두 정리
 */
export async function pruneAllEmptyCategories(userId: string): Promise<number> {
  const allCats = await getDocs(
    query(getCategoriesRef(userId), orderBy('depth', 'desc')),
  );

  let deletedCount = 0;

  for (const catDoc of allCats.docs) {
    const data = catDoc.data() as DocData;
    const linkCount = data.linkCount ?? 0;

    if (linkCount > 0) continue;

    // 하위 카테고리가 있는지 확인
    const children = await getDocsFromServer(
      query(
        getCategoriesRef(userId),
        where('parentId', '==', catDoc.id),
        limit(1),
      ),
    );

    if (!children.empty) continue;

    await deleteDoc(doc(getCategoriesRef(userId), catDoc.id));
    deletedCount++;
  }

  return deletedCount;
}

export async function reorderCategories(
  userId: string,
  orderedIds: string[],
) {
  const db = getFirestore();
  const batch = writeBatch(db);

  orderedIds.forEach((id, index) => {
    batch.update(doc(getCategoriesRef(userId), id), { order: index });
  });

  await batch.commit();
}

const CLEANUP_VERSION = 1;

/**
 * 기존 데이터 정리 (이모지 제거 + 중복 병합)
 * 유저 문서의 cleanupVersion으로 1회만 실행
 */
export async function runCleanupIfNeeded(userId: string): Promise<boolean> {
  const userDoc = await getDoc(getUserRef(userId));
  const currentVersion = (userDoc.data() as DocData | undefined)?.cleanupVersion || 0;

  if (currentVersion >= CLEANUP_VERSION) {
    return false; // 이미 실행됨
  }

  try {
    const fns = getFunctions();
    await httpsCallable(fns, 'cleanupCategories')({});
    await setDoc(
      getUserRef(userId),
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
