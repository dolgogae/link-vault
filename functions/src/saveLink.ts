import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { admin } from './admin';

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

export const saveLink = onCall<SaveLinkData>(
  { timeoutSeconds: 10 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '인증이 필요합니다.');
    }

    const userId = request.auth.uid;
    const data = request.data;
    const db = admin.firestore();

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

    // 월간 저장 한도 체크
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const plan = userData?.plan || 'free';

    if (plan === 'free') {
      const currentPeriod = new Date().toISOString().slice(0, 7); // "2026-03"
      const usage = userData?.monthlyUsage;
      const linksSaved = (usage?.period === currentPeriod) ? (usage?.linksSaved || 0) : 0;

      if (linksSaved >= 30) {
        throw new HttpsError(
          'resource-exhausted',
          '이번 달 무료 저장 한도(30개)를 초과했습니다. 프리미엄으로 업그레이드하세요.',
        );
      }
    }

    const batch = db.batch();

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

    for (const catId of data.categoryIds) {
      const catRef = db
        .collection('users')
        .doc(userId)
        .collection('categories')
        .doc(catId);
      batch.set(catRef, {
        linkCount: admin.firestore.FieldValue.increment(1),
      }, { merge: true });
    }

    const userRef = db.collection('users').doc(userId);
    batch.set(userRef, {
      linkCount: admin.firestore.FieldValue.increment(1),
      'monthlyUsage.linksSaved': admin.firestore.FieldValue.increment(1),
      'monthlyUsage.period': new Date().toISOString().slice(0, 7),
    }, { merge: true });

    try {
      await batch.commit();
    } catch (error: any) {
      logger.error('saveLink batch.commit error', { error: error.message, stack: error.stack });
      throw new HttpsError('internal', `링크 저장 중 오류가 발생했습니다: ${error.message}`);
    }

    return {
      linkId: linkRef.id,
      categoryPath: data.categoryPath,
    };
  },
);
