import firestore from '@react-native-firebase/firestore';
import { Category } from '@/types';

export function getRootCategoriesQuery(userId: string) {
  return firestore()
    .collection('users')
    .doc(userId)
    .collection('categories')
    .where('parentId', '==', null)
    .orderBy('order');
}

export function getChildCategoriesQuery(userId: string, parentId: string) {
  return firestore()
    .collection('users')
    .doc(userId)
    .collection('categories')
    .where('parentId', '==', parentId)
    .orderBy('order');
}

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

export async function createCategory(
  userId: string,
  data: {
    name: string;
    parentId: string | null;
    depth: number;
    icon: string;
  },
): Promise<string> {
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

export async function renameCategory(userId: string, categoryId: string, newName: string) {
  await firestore()
    .collection('users')
    .doc(userId)
    .collection('categories')
    .doc(categoryId)
    .update({ name: newName });
}

export async function updateCategoryIcon(userId: string, categoryId: string, icon: string) {
  await firestore()
    .collection('users')
    .doc(userId)
    .collection('categories')
    .doc(categoryId)
    .update({ icon });
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
  const db = firestore();
  const batch = db.batch();

  const children = await db
    .collection('users')
    .doc(userId)
    .collection('categories')
    .where('parentId', '==', categoryId)
    .get();

  const links = await db
    .collection('users')
    .doc(userId)
    .collection('links')
    .where('categoryPath', 'array-contains', categoryId)
    .get();

  if (moveToParent && parentId) {
    links.docs.forEach((doc) => {
      const currentPath: string[] = doc.data().categoryPath;
      const newPath = currentPath.filter((id) => id !== categoryId);
      batch.update(doc.ref, { categoryPath: newPath });
    });

    children.docs.forEach((doc) => {
      batch.update(doc.ref, {
        parentId,
        depth: firestore.FieldValue.increment(-1),
      });
    });
  } else {
    links.docs.forEach((doc) => batch.delete(doc.ref));
    children.docs.forEach((doc) => batch.delete(doc.ref));
  }

  const catRef = db.collection('users').doc(userId).collection('categories').doc(categoryId);
  batch.delete(catRef);

  await batch.commit();
}

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
