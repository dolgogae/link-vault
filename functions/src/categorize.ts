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

## 핵심 원칙: 콘텐츠 주제 중심 분류
반드시 콘텐츠의 실제 주제/분야를 기준으로 분류하세요.
플랫폼이나 매체 이름(유튜브, 인스타그램, 트위터, 틱톡 등)을 카테고리로 사용하지 마세요.

### 올바른 분류 예시
- 패션 인스타그램 게시물 → ["라이프스타일", "패션"]
- 요리 유튜브 영상 → ["라이프스타일", "요리"]
- 프로그래밍 강의 유튜브 → ["개발", "프로그래밍 강의"]
- 운동 틱톡 영상 → ["건강", "운동"]
- 음악 관련 트윗 → ["엔터테인먼트", "음악"]

### 잘못된 분류 예시 (절대 금지)
- ❌ ["콘텐츠", "소셜 미디어", "인스타그램"]
- ❌ ["미디어", "동영상", "유튜브"]
- ❌ ["SNS", "트위터"]

## 규칙
1. 기존 카테고리 트리를 참고하여 가장 적합한 카테고리에 배치하세요.
2. 적합한 기존 카테고리가 없으면 새 카테고리를 생성하세요.
3. 카테고리 경로는 최대 4단계까지 허용됩니다.
4. 카테고리 이름은 순수한 한국어 텍스트만 사용하세요. 이모지, 아이콘, 특수 기호를 절대 포함하지 마세요.
5. 기존 카테고리 이름과 동일한 분류가 있으면 반드시 기존 이름을 그대로 재사용하세요.
6. 제목이나 설명에서 실제 주제를 파악하기 어려우면, URL 경로나 작성자 정보를 단서로 최대한 구체적인 주제를 추론하세요.

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
  return `다음 링크를 콘텐츠 주제 기준으로 분류해주세요. 플랫폼 이름이 아닌 실제 다루는 주제로 분류하세요.

제목: ${metadata.title}
설명: ${metadata.description}
도메인: ${metadata.domain}
본문 발췌: ${metadata.bodyText.slice(0, 500)}`;
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
