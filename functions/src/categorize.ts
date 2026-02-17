import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import OpenAI from 'openai';
import * as logger from 'firebase-functions/logger';
import { LinkMetadata } from './analyzeLink';
import { admin } from './admin';

const openaiApiKey = defineSecret('OPENAI_API_KEY');

interface CategoryTree {
  id: string;
  name: string;
  icon: string;
  children: CategoryTree[];
}

interface ClassificationResult {
  categoryPath: string[];
  isNew: boolean;
  tags: string[];
}

export const categorizeLink = onCall<{
  metadata: LinkMetadata;
  userId: string;
}>(
  {
    timeoutSeconds: 30,
    memory: '256MiB',
    secrets: [openaiApiKey],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '인증이 필요합니다.');
    }

    const { metadata } = request.data;
    const userId = request.auth.uid;

    const categoriesSnapshot = await admin
      .firestore()
      .collection('users')
      .doc(userId)
      .collection('categories')
      .orderBy('depth')
      .orderBy('order')
      .get();

    const categories = categoriesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    const categoryTree = buildCategoryTree(categories);
    const treeString = formatCategoryTree(categoryTree);

    const openai = new OpenAI({ apiKey: openaiApiKey.value() });

    let retries = 0;
    const maxRetries = 2;
    let result: ClassificationResult;

    while (true) {
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-5-nano',
          messages: [
            {
              role: 'system',
              content: buildSystemPrompt(treeString),
            },
            {
              role: 'user',
              content: buildUserPrompt(metadata),
            },
          ],
          response_format: { type: 'json_object' },
          reasoning_effort: 'low',
          max_completion_tokens: 2048,
        });

        logger.info('OpenAI response', {
          finishReason: completion.choices[0]?.finish_reason,
          content: completion.choices[0]?.message?.content,
          usage: completion.usage,
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) {
          throw new Error(`AI 응답이 비어있습니다. finish_reason: ${completion.choices[0]?.finish_reason}`);
        }

        result = JSON.parse(content) as ClassificationResult;

        // 카테고리 이름에서 이모지/아이콘 제거
        result.categoryPath = result.categoryPath.map((name) =>
          name.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim(),
        );

        if (result.categoryPath.length > 4) {
          result.categoryPath = result.categoryPath.slice(0, 4);
        }

        break;
      } catch (error: any) {
        retries++;
        if (retries > maxRetries) {
          throw new HttpsError(
            'internal',
            `AI 분류 실패 (${maxRetries}회 재시도 후): ${error.message}`,
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // isNew 여부와 관계없이 항상 카테고리 경로 생성 (이미 존재하면 skip)
    await createCategoryPath(userId, result.categoryPath);

    const categoryIds = await resolveCategoryIds(userId, result.categoryPath);

    if (categoryIds.length === 0) {
      logger.error('resolveCategoryIds returned empty', {
        userId,
        categoryPath: result.categoryPath,
      });
      throw new HttpsError(
        'internal',
        `카테고리 생성 실패: ${result.categoryPath.join(' > ')}`,
      );
    }

    return {
      categoryPath: result.categoryPath,
      categoryIds,
      isNew: result.isNew,
      tags: result.tags,
      icon: '',
    };
  },
);

function buildSystemPrompt(categoryTree: string): string {
  return `당신은 웹 링크를 분석하여 카테고리로 분류하는 전문가입니다.

## 규칙
1. 기존 카테고리 트리를 참고하여 가장 적합한 카테고리에 배치하세요.
2. 적합한 기존 카테고리가 없으면 새 카테고리를 생성하세요.
3. 카테고리 경로는 최대 4단계까지 허용됩니다.
4. 카테고리 이름은 순수한 한국어 텍스트만 사용하세요. 이모지, 아이콘, 특수 기호를 절대 포함하지 마세요.
5. 분류 기준: 콘텐츠 주제 > 플랫폼/형식 > 세부 주제 순
6. 기존 카테고리 이름과 동일한 분류가 있으면 반드시 기존 이름을 그대로 재사용하세요.

## 기존 카테고리 트리
${categoryTree || '(아직 카테고리가 없습니다. 새로 생성하세요.)'}

## 출력 형식 (JSON)
{
  "categoryPath": ["대분류", "중분류", "소분류"],
  "isNew": true/false,
  "tags": ["태그1", "태그2", "태그3"]
}`;
}

function buildUserPrompt(metadata: LinkMetadata): string {
  return `다음 링크를 분류해주세요:

제목: ${metadata.title}
설명: ${metadata.description}
도메인: ${metadata.domain}
본문 발췌: ${metadata.bodyText.slice(0, 300)}`;
}

function buildCategoryTree(categories: any[]): CategoryTree[] {
  const map = new Map<string, CategoryTree>();
  const roots: CategoryTree[] = [];

  categories.forEach((cat) => {
    map.set(cat.id, { id: cat.id, name: cat.name, icon: cat.icon || '', children: [] });
  });

  categories.forEach((cat) => {
    const node = map.get(cat.id)!;
    if (cat.parentId && map.has(cat.parentId)) {
      map.get(cat.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

function formatCategoryTree(tree: CategoryTree[], indent = 0): string {
  return tree
    .map(
      (node) =>
        `${'  '.repeat(indent)}${node.name}` +
        (node.children.length > 0
          ? '\n' + formatCategoryTree(node.children, indent + 1)
          : ''),
    )
    .join('\n');
}

async function createCategoryPath(
  userId: string,
  path: string[],
): Promise<void> {
  const db = admin.firestore();
  let parentId: string | null = null;

  for (let depth = 0; depth < path.length; depth++) {
    const name = path[depth];
    const categoriesRef = db
      .collection('users')
      .doc(userId)
      .collection('categories');

    // 정확한 이름 매칭으로 기존 카테고리 검색
    let query = categoriesRef.where('name', '==', name).where('depth', '==', depth);
    if (parentId !== null) {
      query = query.where('parentId', '==', parentId);
    } else {
      query = query.where('parentId', '==', null);
    }

    const existing = await query.get();
    if (!existing.empty) {
      parentId = existing.docs[0].id;
      continue;
    }

    // 이모지가 포함된 기존 카테고리와 매칭 시도 (레거시 데이터 호환)
    let fallbackQuery = categoriesRef.where('depth', '==', depth);
    if (parentId !== null) {
      fallbackQuery = fallbackQuery.where('parentId', '==', parentId);
    } else {
      fallbackQuery = fallbackQuery.where('parentId', '==', null);
    }

    const allAtLevel = await fallbackQuery.get();
    const emojiMatch = allAtLevel.docs.find((doc) => {
      const docName: string = doc.data().name || '';
      const stripped = docName
        .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
        .trim();
      return stripped === name;
    });

    if (emojiMatch) {
      // 기존 이모지 카테고리 이름을 깨끗한 이름으로 업데이트
      await categoriesRef.doc(emojiMatch.id).update({ name, icon: '' });
      parentId = emojiMatch.id;
      continue;
    }

    const newCat = await categoriesRef.add({
      name,
      parentId,
      depth,
      order: 0,
      linkCount: 0,
      icon: '',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    parentId = newCat.id;
  }
}

async function resolveCategoryIds(
  userId: string,
  path: string[],
): Promise<string[]> {
  const db = admin.firestore();
  const ids: string[] = [];
  let parentId: string | null = null;

  for (let depth = 0; depth < path.length; depth++) {
    const name = path[depth];
    let query = db
      .collection('users')
      .doc(userId)
      .collection('categories')
      .where('name', '==', name)
      .where('depth', '==', depth);

    if (parentId !== null) {
      query = query.where('parentId', '==', parentId);
    } else {
      query = query.where('parentId', '==', null);
    }

    const snapshot = await query.get();
    if (snapshot.empty) break;

    const id = snapshot.docs[0].id;
    ids.push(id);
    parentId = id;
  }

  return ids;
}
