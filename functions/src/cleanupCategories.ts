import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { admin } from './admin';

const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;

export const cleanupCategories = onCall(
  { timeoutSeconds: 120, memory: '512MiB' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '인증이 필요합니다.');
    }

    const userId = request.auth.uid;
    const db = admin.firestore();
    const catRef = db.collection('users').doc(userId).collection('categories');
    const linkRef = db.collection('users').doc(userId).collection('links');

    const allCats = await catRef.get();
    let batch = db.batch();
    let opCount = 0;
    let cleanedCount = 0;

    for (const doc of allCats.docs) {
      const name: string = doc.data().name || '';
      const stripped = name.replace(emojiRegex, '').trim();
      if (stripped !== name) {
        batch.update(doc.ref, { name: stripped, icon: '' });
        opCount++;
        cleanedCount++;
        if (opCount >= 490) {
          await batch.commit();
          batch = db.batch();
          opCount = 0;
        }
      }
    }
    if (opCount > 0) {
      await batch.commit();
    }

    logger.info(`Phase 1: ${cleanedCount}개 카테고리 이름 정리 완료`);

    const updatedCats = await catRef.orderBy('depth').get();
    const catsByDepth = new Map<number, any[]>();

    for (const doc of updatedCats.docs) {
      const data = { id: doc.id, ref: doc.ref, ...doc.data() };
      const depth = (data as any).depth ?? 0;
      if (!catsByDepth.has(depth)) catsByDepth.set(depth, []);
      catsByDepth.get(depth)!.push(data);
    }

    let mergedCount = 0;
    const idRemap = new Map<string, string>();

    const depths = Array.from(catsByDepth.keys()).sort((a, b) => a - b);

    for (const depth of depths) {
      const cats = catsByDepth.get(depth)!;

      const groups = new Map<string, any[]>();

      for (const cat of cats) {
        let pid: string = (cat as any).parentId || '__null__';
        while (idRemap.has(pid)) {
          pid = idRemap.get(pid)!;
        }

        const key = `${pid}::${(cat as any).name}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(cat);
      }

      for (const [, group] of groups) {
        if (group.length <= 1) continue;

        group.sort((a: any, b: any) => (b.linkCount || 0) - (a.linkCount || 0));
        const target = group[0];

        for (let i = 1; i < group.length; i++) {
          const source = group[i];

          batch = db.batch();

          const children = await catRef
            .where('parentId', '==', source.id)
            .get();
          for (const child of children.docs) {
            batch.update(child.ref, { parentId: target.id });
          }

          const links = await linkRef
            .where('categoryPath', 'array-contains', source.id)
            .get();
          for (const link of links.docs) {
            const path: string[] = link.data().categoryPath;
            const newPath = path.map((id: string) =>
              id === source.id ? target.id : id,
            );
            batch.update(link.ref, { categoryPath: newPath });
          }

          const sourceLinkCount = (source as any).linkCount || 0;
          if (sourceLinkCount > 0) {
            batch.update(target.ref, {
              linkCount: admin.firestore.FieldValue.increment(sourceLinkCount),
            });
          }

          batch.delete(source.ref);

          await batch.commit();

          idRemap.set(source.id, target.id);
          mergedCount++;

          logger.info(`Merged category "${(source as any).name}" (${source.id}) → ${target.id}`);
        }
      }
    }

    logger.info(`Phase 2: ${mergedCount}개 중복 카테고리 병합 완료`);

    return { cleanedCount, mergedCount };
  },
);
