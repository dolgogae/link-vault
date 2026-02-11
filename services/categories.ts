import firestore from '@react-native-firebase/firestore';
import { Category } from '@/types';

/**
 * 루트 카테고리 조회 (parentId === null)
 */
export function getRootCategoriesQuery(userId: string) {
  return firestore()
    .collection('users')
    .doc(userId)
    .collection('categories')
    .where('parentId', '==', null)
    .orderBy('order');
}

/**
 * 하위 카테고리 조회
 */
export function getChildCategoriesQuery(userId: string, parentId: string) {
  return firestore()
    .collection('users')
    .doc(userId)
    .collection('categories')
    .where('parentId', '==', parentId)
    .orderBy('order');
}

/**
 * 모든 카테고리 조회 (트리 빌드용)
 */
export async function getAllCategories(userId: string): Promise<Category[]> {
  const snapshot = await firestore()
    .collection('users')
    .doc(userId)
    .collection('categories')
    .orderBy('depth')
    .orderBy('order')
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate() || new Date(),
  })) as Category[];
}

/**
 * 카테고리 생성
 */
export async function createCategory(
  userId: string,
  data: {
    name: string;
    parentId: string | null;
    depth: number;
    icon: string;
  },
): Promise<string> {
  // 같은 부모 내 order 최대값 조회
  const siblings = await firestore()
    .collection('users')
    .doc(userId)
    .collection('categories')
    .where('parentId', '==', data.parentId)
    .orderBy('order', 'desc')
    .limit(1)
    .get();

  const maxOrder = siblings.empty ? 0 : (siblings.docs[0].data().order || 0) + 1;

  const docRef = await firestore()
    .collection('users')
    .doc(userId)
    .collection('categories')
    .add({
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

/**
 * 카테고리 이름 변경
 */
export async function renameCategory(userId: string, categoryId: string, newName: string) {
  await firestore()
    .collection('users')
    .doc(userId)
    .collection('categories')
    .doc(categoryId)
    .update({ name: newName });
}

/**
 * 카테고리 아이콘 변경
 */
export async function updateCategoryIcon(userId: string, categoryId: string, icon: string) {
  await firestore()
    .collection('users')
    .doc(userId)
    .collection('categories')
    .doc(categoryId)
    .update({ icon });
}

/**
 * 카테고리 삭제
 * @param moveToParent true이면 하위 링크를 상위 카테고리로 이동, false이면 함께 삭제
 */
export async function deleteCategory(
  userId: string,
  categoryId: string,
  parentId: string | null,
  moveToParent: boolean,
) {
  const db = firestore();
  const batch = db.batch();

  // 하위 카테고리 조회
  const children = await db
    .collection('users')
    .doc(userId)
    .collection('categories')
    .where('parentId', '==', categoryId)
    .get();

  // 해당 카테고리의 링크 조회
  const links = await db
    .collection('users')
    .doc(userId)
    .collection('links')
    .where('categoryPath', 'array-contains', categoryId)
    .get();

  if (moveToParent && parentId) {
    // 링크를 상위 카테고리로 이동
    links.docs.forEach((doc) => {
      const currentPath: string[] = doc.data().categoryPath;
      const newPath = currentPath.filter((id) => id !== categoryId);
      batch.update(doc.ref, { categoryPath: newPath });
    });

    // 하위 카테고리를 상위 카테고리의 자식으로 이동
    children.docs.forEach((doc) => {
      batch.update(doc.ref, {
        parentId,
        depth: firestore.FieldValue.increment(-1),
      });
    });
  } else {
    // 링크와 하위 카테고리 모두 삭제
    links.docs.forEach((doc) => batch.delete(doc.ref));
    children.docs.forEach((doc) => batch.delete(doc.ref));
  }

  // 카테고리 자체 삭제
  const catRef = db.collection('users').doc(userId).collection('categories').doc(categoryId);
  batch.delete(catRef);

  await batch.commit();
}

/**
 * 카테고리 순서 업데이트 (드래그 앤 드롭)
 */
export async function reorderCategories(
  userId: string,
  orderedIds: string[],
) {
  const batch = firestore().batch();

  orderedIds.forEach((id, index) => {
    const ref = firestore()
      .collection('users')
      .doc(userId)
      .collection('categories')
      .doc(id);
    batch.update(ref, { order: index });
  });

  await batch.commit();
}
