import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

interface SaveLinkData {
  url: string;
  title: string;
  description: string;
  ogImage: string;
  favicon: string;
  domain: string;
  categoryIds: string[];
  categoryPath: string[];
  tags: string[];
  icon: string;
}

/**
 * 링크를 Firestore에 저장하고 카테고리 linkCount를 업데이트하는 Cloud Function
 */
export const saveLink = onCall<SaveLinkData>(
  { timeoutSeconds: 10 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '인증이 필요합니다.');
    }

    const userId = request.auth.uid;
    const data = request.data;
    const db = admin.firestore();

    // 중복 URL 검사
    const existing = await db
      .collection('users')
      .doc(userId)
      .collection('links')
      .where('url', '==', data.url)
      .limit(1)
      .get();

    if (!existing.empty) {
      throw new HttpsError('already-exists', '이미 저장된 링크입니다.');
    }

    const batch = db.batch();

    // 링크 문서 생성
    const linkRef = db.collection('users').doc(userId).collection('links').doc();
    batch.set(linkRef, {
      url: data.url,
      title: data.title,
      description: data.description,
      ogImage: data.ogImage,
      favicon: data.favicon,
      domain: data.domain,
      categoryPath: data.categoryIds,
      tags: data.tags,
      savedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastAccessedAt: admin.firestore.FieldValue.serverTimestamp(),
      isFavorite: false,
    });

    // 카테고리 linkCount 증가 (마지막 카테고리만)
    if (data.categoryIds.length > 0) {
      const lastCatId = data.categoryIds[data.categoryIds.length - 1];
      const catRef = db
        .collection('users')
        .doc(userId)
        .collection('categories')
        .doc(lastCatId);
      batch.update(catRef, {
        linkCount: admin.firestore.FieldValue.increment(1),
      });
    }

    // 사용자 linkCount 증가
    const userRef = db.collection('users').doc(userId);
    batch.update(userRef, {
      linkCount: admin.firestore.FieldValue.increment(1),
    });

    await batch.commit();

    return {
      linkId: linkRef.id,
      categoryPath: data.categoryPath,
    };
  },
);
