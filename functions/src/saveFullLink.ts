import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import OpenAI from 'openai';
import * as crypto from 'crypto';
import * as cheerio from 'cheerio';
import * as logger from 'firebase-functions/logger';
import { admin } from './admin';

export interface LinkMetadata {
  title: string;
  description: string;
  ogImage: string;
  favicon: string;
  domain: string;
  bodyText: string;
}

const openaiApiKey = defineSecret('OPENAI_API_KEY');

// ─── Types ───────────────────────────────────────────────────────────────────

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

interface CachedCategory {
  categoryPath: string[];
  tags: string[];
  createdAt: FirebaseFirestore.FieldValue;
}

// ─── Metadata Extraction Helpers ─────────────────────────────────────────────

interface InstagramHints {
  username: string | null;
  postType: 'post' | 'reel' | 'story' | 'profile' | 'unknown';
  hashtags: string[];
  captionPreview: string | null;
}

function extractInstagramHints(url: string, metadata: LinkMetadata): InstagramHints {
  const parsed = new URL(url);
  const pathParts = parsed.pathname.split('/').filter(Boolean);

  let username: string | null = null;
  let postType: InstagramHints['postType'] = 'unknown';

  const systemPaths = ['explore', 'accounts', 'directory', 'about', 'legal', 'developer'];

  if (pathParts[0] === 'p') {
    postType = 'post';
  } else if (pathParts[0] === 'reel' || pathParts[0] === 'reels') {
    postType = 'reel';
  } else if (pathParts[0] === 'stories') {
    postType = 'story';
    username = pathParts[1] || null;
  } else if (pathParts.length >= 2 && pathParts[1] === 'p') {
    postType = 'post';
    username = pathParts[0];
  } else if (pathParts.length >= 2 && (pathParts[1] === 'reel' || pathParts[1] === 'reels')) {
    postType = 'reel';
    username = pathParts[0];
  } else if (pathParts.length === 1 && !systemPaths.includes(pathParts[0])) {
    postType = 'profile';
    username = pathParts[0];
  }

  if (!username && metadata.title) {
    const titleMatch = metadata.title.match(/^@?(\w[\w.]+)\s+on\s+Instagram/i)
      || metadata.title.match(/^@?(\w[\w.]+).*Instagram/i);
    if (titleMatch) username = titleMatch[1];
  }

  if (!username && metadata.description) {
    const descMatch = metadata.description.match(/^[\d,.]+ (?:likes|Likes|좋아요).+?[-–—]\s*@?(\w[\w.]+)/);
    if (descMatch) username = descMatch[1];
  }

  const allText = `${metadata.title} ${metadata.description} ${metadata.bodyText}`;
  const hashtagMatches = allText.match(/#[\w가-힣\u3040-\u309F\u30A0-\u30FF]+/g) || [];
  const hashtags = [...new Set(hashtagMatches)].slice(0, 15);

  let captionPreview: string | null = null;
  const captionMatch = metadata.title?.match(/on Instagram[:\s]*[""'"](.+?)[""'"]\s*$/i)
    || metadata.title?.match(/on Instagram[:\s]+(.+)$/i);
  if (captionMatch) {
    captionPreview = captionMatch[1].trim();
  }

  if (!captionPreview && metadata.description) {
    const descCaptionMatch = metadata.description.match(/on Instagram[:\s]*[""'"](.+?)[""'"]/i)
      || metadata.description.match(/[-–—]\s*[""'"](.+?)[""'"]/);
    if (descCaptionMatch) {
      captionPreview = descCaptionMatch[1].trim();
    }
  }

  return { username, postType, hashtags, captionPreview };
}

async function fetchInstagramEmbedCaption(url: string): Promise<string | null> {
  const match = url.match(/instagram\.com\/(p|reel|reels)\/[\w-]+/);
  if (!match) return null;

  const embedUrl = url.replace(/\/?(\?.*)?$/, '/embed/captioned/');

  try {
    const res = await fetch(embedUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(5000),
      redirect: 'follow',
    });

    if (!res.ok) return null;

    const html = await res.text();
    const $ = cheerio.load(html);

    const captionText =
      $('[class*="Caption"]').text() ||
      $('[class*="caption"]').text() ||
      $('meta[property="og:description"]').attr('content') ||
      '';

    const cleaned = captionText.replace(/\s+/g, ' ').trim();
    return cleaned.length > 10 ? cleaned : null;
  } catch {
    return null;
  }
}

const OEMBED_PLATFORMS: Record<string, (url: string) => string> = {
  'youtube.com': (url) =>
    `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
  'youtu.be': (url) =>
    `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
  'instagram.com': (url) =>
    `https://noembed.com/embed?url=${encodeURIComponent(url)}`,
  'twitter.com': (url) =>
    `https://noembed.com/embed?url=${encodeURIComponent(url)}`,
  'x.com': (url) =>
    `https://noembed.com/embed?url=${encodeURIComponent(url)}`,
  'tiktok.com': (url) =>
    `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
};

async function fetchOEmbed(
  url: string,
  domain: string,
): Promise<{ title?: string; authorName?: string; html?: string } | null> {
  const key = Object.keys(OEMBED_PLATFORMS).find((k) => domain.includes(k));
  if (!key) return null;

  try {
    const oembedUrl = OEMBED_PLATFORMS[key](url);
    const res = await fetch(oembedUrl, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    const data = await res.json();
    return {
      title: data.title,
      authorName: data.author_name,
      html: data.html,
    };
  } catch {
    return null;
  }
}

async function fetchAndParseHtml(
  url: string,
  parsedUrl: URL,
): Promise<LinkMetadata> {
  const isWalledPlatform = ['instagram.com', 'tiktok.com'].some((d) =>
    parsedUrl.hostname.includes(d),
  );
  const userAgent = isWalledPlatform
    ? 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
    : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': userAgent,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new HttpsError('unavailable', `URL 접근 실패: HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const title =
      $('meta[property="og:title"]').attr('content') ||
      $('title').text() ||
      '';

    const description =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      '';

    const ogImage = $('meta[property="og:image"]').attr('content') || '';

    let favicon =
      $('link[rel="icon"]').attr('href') ||
      $('link[rel="shortcut icon"]').attr('href') ||
      '/favicon.ico';

    if (favicon && !favicon.startsWith('http')) {
      favicon = `${parsedUrl.protocol}//${parsedUrl.host}${favicon.startsWith('/') ? '' : '/'}${favicon}`;
    }

    $('script, style, nav, header, footer').remove();
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 500);

    return {
      title: title.trim(),
      description: description.trim(),
      ogImage,
      favicon,
      domain: parsedUrl.hostname,
      bodyText,
    };
  } catch (error: any) {
    if (error instanceof HttpsError) throw error;

    logger.warn('Scraping failed, using fallback metadata', {
      url,
      error: error.message,
    });

    return {
      title: parsedUrl.hostname + decodeURIComponent(parsedUrl.pathname),
      description: '',
      ogImage: '',
      favicon: `${parsedUrl.protocol}//${parsedUrl.host}/favicon.ico`,
      domain: parsedUrl.hostname,
      bodyText: `URL: ${url}`,
    };
  }
}

// ─── Categorization Helpers ──────────────────────────────────────────────────

function generateMetadataHash(metadata: LinkMetadata): string {
  const key = [
    metadata.domain,
    metadata.title,
    metadata.description,
    metadata.bodyText.slice(0, 500),
  ].join('|');
  return crypto.createHash('sha256').update(key).digest('hex');
}

const BLOCKED_ROOT_NAMES = ['콘텐츠', '미디어', '소셜 미디어', 'SNS', '온라인'];

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
- ❌ ["콘텐츠", "미디어"] — "콘텐츠"나 "미디어"는 너무 포괄적이라 최상위 카테고리로 절대 사용 금지
- ❌ ["미디어", "동영상", "유튜브"]
- ❌ ["SNS", "트위터"]
- ❌ 최상위 카테고리가 "콘텐츠", "미디어", "소셜 미디어", "SNS", "온라인" 등 모호한 이름인 경우

### 소셜 미디어 링크 분류 핵심 원칙
소셜 미디어(인스타그램, 유튜브, 트위터, 틱톡 등) 링크는 **게시물이 다루는 실제 주제**로 분류하세요.
주제를 특정하기 어려운 경우에도 "콘텐츠/미디어" 같은 모호한 분류 대신, 가장 가까운 구체적 주제를 선택하세요.
- 패션/뷰티 계정 → ["라이프스타일", "패션"] 또는 ["라이프스타일", "뷰티"]
- 맛집/카페 게시물 → ["라이프스타일", "맛집"]
- 일상/브이로그 → ["라이프스타일", "일상"]
- 밈/유머 → ["엔터테인먼트", "유머"]
- 뉴스/시사 → ["뉴스", "시사"]

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

// ─── Optimized ensureCategoryPath: single query instead of per-depth ─────────

async function ensureCategoryPath(
  userId: string,
  path: string[],
): Promise<string[]> {
  const db = admin.firestore();
  const categoriesRef = db
    .collection('users')
    .doc(userId)
    .collection('categories');

  // Single query: fetch all categories at once
  const allCatsSnapshot = await categoriesRef.get();
  const catsByDepthAndParent = new Map<string, any[]>();

  allCatsSnapshot.docs.forEach((doc) => {
    const data = doc.data() as Record<string, any>;
    const entry = { id: doc.id, ...data };
    const depthVal = data.depth ?? 0;
    const parentVal = data.parentId ?? 'null';
    const mapKey = `${depthVal}:${parentVal}`;
    if (!catsByDepthAndParent.has(mapKey)) {
      catsByDepthAndParent.set(mapKey, []);
    }
    catsByDepthAndParent.get(mapKey)!.push(entry);
  });

  const ids: string[] = [];
  let parentId: string | null = null;

  for (let depth = 0; depth < path.length; depth++) {
    const name = path[depth];
    const lookupKey = `${depth}:${parentId ?? 'null'}`;
    const catsAtLevel: any[] = catsByDepthAndParent.get(lookupKey) || [];

    // Exact match
    const exact = catsAtLevel.find((c: any) => c.name === name);
    if (exact) {
      parentId = exact.id;
      ids.push(parentId!);
      continue;
    }

    // Emoji fallback match
    const emojiMatch = catsAtLevel.find((c: any) => {
      const stripped = (c.name || '')
        .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
        .trim();
      return stripped === name;
    });

    if (emojiMatch) {
      await categoriesRef.doc(emojiMatch.id).update({ name, icon: '' });
      parentId = emojiMatch.id;
      ids.push(parentId!);
      continue;
    }

    // Create new category
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
    ids.push(parentId);
  }

  return ids;
}

// ─── Main Combined Function ──────────────────────────────────────────────────

export const saveFullLink = onCall<{ url: string }>(
  {
    timeoutSeconds: 30,
    memory: '256MiB',
    secrets: [openaiApiKey],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '인증이 필요합니다.');
    }

    const { url } = request.data;
    if (!url) {
      throw new HttpsError('invalid-argument', 'URL이 필요합니다.');
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new HttpsError('invalid-argument', '유효하지 않은 URL입니다.');
    }

    const userId = request.auth.uid;
    const db = admin.firestore();
    const domain = parsedUrl.hostname;
    const isInstagram = domain.includes('instagram.com');

    // ── Phase 1: Parallel metadata fetch ──────────────────────────────────
    // Main HTML fetch + oEmbed + Instagram embed all run simultaneously
    const [metadata, oembed, embedCaption] = await Promise.all([
      fetchAndParseHtml(url, parsedUrl),
      fetchOEmbed(url, domain),
      isInstagram ? fetchInstagramEmbedCaption(url) : Promise.resolve(null),
    ]);

    // Apply oEmbed enrichment
    if (oembed) {
      const genericTitles = ['instagram', 'youtube', 'tiktok', 'x.com', 'twitter'];
      const isGenericTitle =
        !metadata.title ||
        genericTitles.some((g) => metadata.title.toLowerCase().includes(g) && metadata.title.length < 40);

      if (isGenericTitle && oembed.title) {
        metadata.title = oembed.title;
      }

      const extra: string[] = [];
      if (oembed.title && oembed.title !== metadata.title) {
        extra.push(`콘텐츠 제목: ${oembed.title}`);
      }
      if (oembed.authorName) {
        extra.push(`작성자: ${oembed.authorName}`);
      }
      if (extra.length > 0) {
        metadata.bodyText = `${extra.join('. ')}. ${metadata.bodyText}`;
      }
    }

    // Apply Instagram hints
    if (isInstagram) {
      const hints = extractInstagramHints(url, metadata);

      const hintParts: string[] = [];
      if (hints.username) hintParts.push(`Instagram 계정: @${hints.username}`);
      if (hints.postType !== 'unknown') {
        const typeLabel: Record<string, string> = {
          post: '게시물', reel: '릴스(짧은 영상)', story: '스토리', profile: '프로필',
        };
        hintParts.push(`콘텐츠 유형: ${typeLabel[hints.postType]}`);
      }
      if (hints.captionPreview) hintParts.push(`캡션: ${hints.captionPreview}`);
      if (embedCaption) hintParts.push(`캡션 전문: ${embedCaption.slice(0, 500)}`);
      if (hints.hashtags.length > 0) hintParts.push(`해시태그: ${hints.hashtags.join(' ')}`);

      if (hintParts.length > 0) {
        metadata.bodyText = `${hintParts.join('. ')}. ${metadata.bodyText}`;
      }

      const isGenericIgTitle =
        !metadata.title ||
        metadata.title.toLowerCase() === 'instagram' ||
        /^instagram\s*(photo|post|reel)?/i.test(metadata.title);

      if (isGenericIgTitle) {
        const titleParts: string[] = [];
        if (hints.username) titleParts.push(`@${hints.username}`);
        if (hints.captionPreview) {
          titleParts.push(hints.captionPreview.slice(0, 60));
        } else if (embedCaption) {
          titleParts.push(embedCaption.slice(0, 60));
        } else if (hints.hashtags.length > 0) {
          titleParts.push(hints.hashtags.slice(0, 3).join(' '));
        }
        if (titleParts.length > 0) {
          metadata.title = titleParts.join(' - ');
        }
      }
    }

    // ── Phase 2: Parallel DB lookups ──────────────────────────────────────
    // Cache check + duplicate check + user doc read all run simultaneously
    const metadataHash = generateMetadataHash(metadata);
    const [cachedCategory, existingLink, userDoc] = await Promise.all([
      db.collection('categoryCache').doc(metadataHash).get(),
      db.collection('users').doc(userId).collection('links')
        .where('url', '==', url).limit(1).get(),
      db.collection('users').doc(userId).get(),
    ]);

    // Duplicate check
    if (!existingLink.empty) {
      throw new HttpsError('already-exists', '이미 저장된 링크입니다.');
    }

    // Quota check
    const userData = userDoc.data();
    const plan = userData?.plan || 'free';

    if (plan === 'free') {
      const currentPeriod = new Date().toISOString().slice(0, 7);
      const usage = userData?.monthlyUsage;
      const linksSaved = (usage?.period === currentPeriod) ? (usage?.linksSaved || 0) : 0;

      if (linksSaved >= 30) {
        throw new HttpsError(
          'resource-exhausted',
          '이번 달 무료 저장 한도(30개)를 초과했습니다. 프리미엄으로 업그레이드하세요.',
        );
      }
    }

    // ── Phase 3: Categorize (cache hit or OpenAI) ─────────────────────────
    let categoryPath: string[];
    let tags: string[];

    const cached = cachedCategory.exists
      ? (cachedCategory.data() as CachedCategory)
      : null;

    if (cached && !BLOCKED_ROOT_NAMES.includes(cached.categoryPath[0])) {
      logger.info('Cache hit', { hash: metadataHash, categoryPath: cached.categoryPath });
      categoryPath = cached.categoryPath;
      tags = cached.tags;
    } else {
      logger.info('Cache miss', { hash: metadataHash });

      // Fetch user categories for OpenAI context
      const categoriesSnapshot = await db
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
              { role: 'system', content: buildSystemPrompt(treeString) },
              { role: 'user', content: buildUserPrompt(metadata) },
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

          const maxDepth = plan === 'premium' ? 4 : 2;
          if (result.categoryPath.length > maxDepth) {
            result.categoryPath = result.categoryPath.slice(0, maxDepth);
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

      // Save to cache (fire-and-forget, don't await)
      db.collection('categoryCache').doc(metadataHash).set({
        categoryPath: result.categoryPath,
        tags: result.tags,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      }).catch((err) => logger.warn('Cache save failed', { error: err.message }));

      categoryPath = result.categoryPath;
      tags = result.tags;
    }

    // ── Phase 4: Ensure categories + save link (optimized) ────────────────
    const categoryIds = await ensureCategoryPath(userId, categoryPath);

    if (categoryIds.length === 0) {
      logger.error('ensureCategoryPath returned empty', { userId, categoryPath });
      throw new HttpsError('internal', `카테고리 생성 실패: ${categoryPath.join(' > ')}`);
    }

    // Batch write: link + category counts + user stats
    const batch = db.batch();

    const linkRef = db.collection('users').doc(userId).collection('links').doc();
    batch.set(linkRef, {
      url,
      title: metadata.title,
      description: metadata.description,
      ogImage: metadata.ogImage,
      favicon: metadata.favicon,
      domain: metadata.domain,
      categoryPath: categoryIds,
      tags,
      savedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastAccessedAt: admin.firestore.FieldValue.serverTimestamp(),
      isFavorite: false,
    });

    for (const catId of categoryIds) {
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
    const currentPeriod = new Date().toISOString().slice(0, 7);
    const storedPeriod = userData?.monthlyUsage?.period;

    if (storedPeriod === currentPeriod) {
      batch.update(userRef, {
        linkCount: admin.firestore.FieldValue.increment(1),
        'monthlyUsage.linksSaved': admin.firestore.FieldValue.increment(1),
      });
    } else {
      batch.set(userRef, {
        linkCount: admin.firestore.FieldValue.increment(1),
        monthlyUsage: { linksSaved: 1, period: currentPeriod },
      }, { merge: true });
    }

    try {
      await batch.commit();
    } catch (error: any) {
      logger.error('saveFullLink batch.commit error', { error: error.message, stack: error.stack });
      throw new HttpsError('internal', `링크 저장 중 오류가 발생했습니다: ${error.message}`);
    }

    return {
      linkId: linkRef.id,
      categoryPath,
      categoryIds,
      tags,
    };
  },
);
