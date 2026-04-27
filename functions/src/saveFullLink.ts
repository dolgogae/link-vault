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

interface ClassificationContext {
  keywordHints: string[];
  urlPathHints: string[];
  richnessScore: number;
}

// ─── Metadata Extraction Helpers ─────────────────────────────────────────────

interface InstagramHints {
  username: string | null;
  postType: 'post' | 'reel' | 'story' | 'profile' | 'unknown';
  hashtags: string[];
  captionPreview: string | null;
}

function normalizeInstagramUrl(url: string): string {
  const parsed = new URL(url);
  const pathParts = parsed.pathname.split('/').filter(Boolean);

  // /share/reel/ABC → /reel/ABC, /share/p/ABC → /p/ABC
  if (pathParts[0] === 'share' && pathParts.length >= 3) {
    const newPath = '/' + pathParts.slice(1).join('/') + '/';
    parsed.pathname = newPath;
    return parsed.toString();
  }

  return url;
}

function extractInstagramHints(url: string, metadata: LinkMetadata): InstagramHints {
  const parsed = new URL(url);
  const rawParts = parsed.pathname.split('/').filter(Boolean);

  // /share/ prefix 제거하여 실제 경로만 파싱
  const pathParts = rawParts[0] === 'share' ? rawParts.slice(1) : rawParts;

  let username: string | null = null;
  let postType: InstagramHints['postType'] = 'unknown';

  const systemPaths = ['explore', 'accounts', 'directory', 'about', 'legal', 'developer', 'share'];

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
  // /share/reel/ABC → /reel/ABC 형태로 정규화
  const normalized = normalizeInstagramUrl(url);
  const match = normalized.match(/instagram\.com\/(p|reel|reels)\/[\w-]+/);
  if (!match) return null;

  const embedUrl = normalized.replace(/\/?(\?.*)?$/, '/embed/captioned/');

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

function isUsableMetadata(title: string, description: string, bodyText: string): boolean {
  const genericTitles = ['instagram', 'login', 'log in', '로그인'];
  const lowerTitle = title.toLowerCase();
  if (!title || genericTitles.some((g) => lowerTitle === g || lowerTitle.startsWith(g + ' '))) {
    return description.length > 20 || bodyText.length > 80;
  }
  return true;
}

const INSTAGRAM_USER_AGENTS = [
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
];

async function fetchWithUserAgent(
  url: string,
  userAgent: string,
  timeoutMs: number,
): Promise<Response | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'User-Agent': userAgent,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      redirect: 'follow',
    });
    if (!response.ok) return null;
    return response;
  } catch {
    return null;
  }
}

function parseHtmlMetadata(html: string, parsedUrl: URL): LinkMetadata {
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
}

async function fetchAndParseHtml(
  url: string,
  parsedUrl: URL,
): Promise<LinkMetadata> {
  const isInstagram = parsedUrl.hostname.includes('instagram.com');
  const isWalledPlatform = isInstagram || parsedUrl.hostname.includes('tiktok.com');

  const fallback: LinkMetadata = {
    title: parsedUrl.hostname + decodeURIComponent(parsedUrl.pathname),
    description: '',
    ogImage: '',
    favicon: `${parsedUrl.protocol}//${parsedUrl.host}/favicon.ico`,
    domain: parsedUrl.hostname,
    bodyText: `URL: ${url}`,
  };

  // Instagram: /share/ URL을 정규화하여 실제 콘텐츠 URL로 변환
  const fetchUrl = isInstagram ? normalizeInstagramUrl(url) : url;

  if (isInstagram) {
    // Instagram은 UA별로 차단이 다르므로 순차적으로 시도
    for (const ua of INSTAGRAM_USER_AGENTS) {
      const response = await fetchWithUserAgent(fetchUrl, ua, 8000);
      if (!response) continue;

      try {
        const html = await response.text();
        const metadata = parseHtmlMetadata(html, parsedUrl);

        if (isUsableMetadata(metadata.title, metadata.description, metadata.bodyText)) {
          logger.info('Instagram fetch succeeded', { ua: ua.slice(0, 30), title: metadata.title.slice(0, 50) });
          return metadata;
        }
      } catch {
        continue;
      }
    }

    logger.warn('All Instagram UA attempts failed, using fallback', { url });
    return fallback;
  }

  // 일반 사이트
  const userAgent = isWalledPlatform
    ? 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
    : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

  try {
    const response = await fetch(fetchUrl, {
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': userAgent,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      logger.warn('HTTP fetch failed, using fallback metadata', { url, status: response.status });
      return fallback;
    }

    const html = await response.text();
    return parseHtmlMetadata(html, parsedUrl);
  } catch (error: any) {
    if (error instanceof HttpsError) throw error;

    logger.warn('Scraping failed, using fallback metadata', {
      url,
      error: error.message,
    });

    return fallback;
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

const BLOCKED_ROOT_NAMES = [
  '콘텐츠', '미디어', '소셜 미디어', 'SNS', '온라인',
  '기타', '일반', '잡동사니', '기록', '링크', '읽을거리', '자료',
];

const GENERIC_CATEGORY_NAMES = new Set([
  ...BLOCKED_ROOT_NAMES,
  '튜토리얼',
  '가이드',
  '문서',
  '게시물',
  '포스트',
  '영상',
  '동영상',
  '비디오',
  '채널',
  '계정',
  '웹사이트',
  '사이트',
  '페이지',
  '뉴스',
  '기사',
  '정보',
  '팁',
]);

const STOPWORDS = new Set([
  'www', 'http', 'https', 'com', 'co', 'kr', 'net', 'org', 'www2', 'm',
  'amp', 'utm', 'source', 'ref', 'page', 'pages', 'post', 'posts', 'watch',
  'video', 'videos', 'index', 'home', 'category', 'categories', 'tag', 'tags',
  'share', 'reel', 'reels', 'p', 'tv', 'shorts', 'clip', 'clips',
]);

const CLASSIFICATION_MODELS = ['gpt-5-mini', 'gpt-5-nano'] as const;

function sanitizeCategoryName(name: string): string {
  return name
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
    .replace(/[\\/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeTag(tag: string): string {
  return tag
    .replace(/[#/\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractKeywordHints(url: string, metadata: LinkMetadata): ClassificationContext {
  const parsed = new URL(url);
  const sources = [
    metadata.title,
    metadata.description,
    metadata.bodyText,
    decodeURIComponent(parsed.pathname),
    decodeURIComponent(parsed.search.replace(/[?&=_-]/g, ' ')),
    parsed.hostname.replace(/\./g, ' '),
  ].filter(Boolean);

  const tokens = sources
    .join(' ')
    .split(/[^0-9A-Za-z가-힣+#]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const scored = new Map<string, number>();

  for (const token of tokens) {
    const normalized = token.toLowerCase();
    if (
      normalized.length < 2 ||
      STOPWORDS.has(normalized) ||
      /^\d+$/.test(normalized) ||
      /^[_-]+$/.test(normalized)
    ) {
      continue;
    }

    const current = scored.get(token) || 0;
    let weight = 1;

    if (token.startsWith('#')) weight += 3;
    if (/[가-힣]/.test(token)) weight += 1;
    if (/[A-Z]/.test(token)) weight += 1;
    if (metadata.title.includes(token)) weight += 3;
    if (metadata.description.includes(token)) weight += 2;
    if (metadata.bodyText.includes(token)) weight += 1;
    if (parsed.pathname.includes(token)) weight += 2;

    scored.set(token, current + weight);
  }

  const keywordHints = [...scored.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 12)
    .map(([token]) => token);

  const urlPathHints = decodeURIComponent(parsed.pathname)
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => {
      const normalized = part.toLowerCase();
      return (
        normalized.length >= 2 &&
        !STOPWORDS.has(normalized) &&
        !/^\d+$/.test(normalized)
      );
    })
    .slice(0, 8);

  let richnessScore = 0;
  if (metadata.title.trim().length >= 12) richnessScore += 2;
  if (metadata.description.trim().length >= 20) richnessScore += 2;
  if (metadata.bodyText.trim().length >= 80) richnessScore += 2;
  if (keywordHints.length >= 5) richnessScore += 1;
  if (urlPathHints.length >= 2) richnessScore += 1;

  return {
    keywordHints,
    urlPathHints,
    richnessScore,
  };
}

function isGenericCategoryName(name: string): boolean {
  const normalized = sanitizeCategoryName(name).toLowerCase();
  return GENERIC_CATEGORY_NAMES.has(normalized) || normalized.length < 2;
}

function isCategoryPathTooGeneric(path: string[], richnessScore: number): boolean {
  if (path.length === 0) return true;
  if (path.some((name) => isGenericCategoryName(name))) return true;
  if (richnessScore >= 4 && path.length < 2) return true;
  if (richnessScore >= 6 && path.length < 3) return true;
  return false;
}

function buildSystemPrompt(categoryTree: string): string {
  return `당신은 웹 링크의 **내용물 주제**만으로 분류하는 전문가입니다.

## 절대 규칙 (위반 시 실패)
- 링크가 어떤 플랫폼(유튜브, 인스타, 틱톡, 트위터 등)에서 왔는지는 **완전히 무시**하세요. 플랫폼은 분류와 무관합니다.
- 다음 단어는 categoryPath에 **절대 포함 금지**: "콘텐츠", "미디어", "소셜 미디어", "SNS", "온라인", "동영상", "영상", "게시물", "채널", "플랫폼"
- 오직 "이 링크가 무엇에 관한 것인가?"에만 답하세요.

## 핵심 원칙: 내용물 주제 중심 분류
유튜브 영상이든 인스타 게시물이든 블로그든 상관없이, 그 안의 실제 주제/분야로만 분류하세요.
너무 넓은 한 단어 분류보다, 사용자가 나중에 다시 찾기 쉬운 구체적인 주제 분류를 우선하세요.

### 올바른 분류 예시
- 패션 인스타그램 게시물 → ["라이프스타일", "패션"]
- 요리 유튜브 영상 → ["라이프스타일", "요리"]
- 프로그래밍 강의 유튜브 → ["개발", "프로그래밍 강의"]
- 운동 틱톡 영상 → ["건강", "운동"]
- 음악 관련 트윗 → ["엔터테인먼트", "음악"]
- React 상태관리 글 → ["개발", "프론트엔드", "리액트"]
- Next.js 배포 튜토리얼 → ["개발", "프론트엔드", "넥스트JS"]
- 부동산 세금 해설 기사 → ["금융", "부동산", "세금"]
- 생산성 앱 비교 리뷰 → ["생산성", "도구", "앱 비교"]
- 일본 오사카 여행 코스 → ["여행", "일본", "오사카"]

### 잘못된 분류 예시 (절대 금지)
- ❌ ["콘텐츠", "소셜 미디어", "인스타그램"]
- ❌ ["콘텐츠", "미디어"] — "콘텐츠"나 "미디어"는 너무 포괄적이라 최상위 카테고리로 절대 사용 금지
- ❌ ["미디어", "동영상", "유튜브"]
- ❌ ["SNS", "트위터"]
- ❌ ["개발", "튜토리얼"] — 무엇에 대한 튜토리얼인지 빠져 있음
- ❌ ["뉴스", "기사"] — 주제 정보가 없음
- ❌ ["콘텐츠/미디어"] — 슬래시가 들어간 폴더명은 절대 금지
- ❌ 최상위 카테고리가 "콘텐츠", "미디어", "소셜 미디어", "SNS", "온라인" 등 모호한 이름인 경우

### 소셜 미디어 링크 분류 핵심 원칙
소셜 미디어(인스타그램, 유튜브, 트위터, 틱톡 등) 링크는 **게시물이 다루는 실제 주제**로 분류하세요.
주제를 특정하기 어려운 경우에도 "콘텐츠/미디어" 같은 모호한 분류 대신, 가장 가까운 구체적 주제를 선택하세요.
- 패션/뷰티 계정 → ["라이프스타일", "패션"] 또는 ["라이프스타일", "뷰티"]
- 맛집/카페 게시물 → ["라이프스타일", "맛집"]
- 일상/브이로그 → ["라이프스타일", "일상"]
- 밈/유머 → ["엔터테인먼트", "유머"]
- 뉴스/시사 → ["뉴스", "시사"]

### 더 세분화하는 기준
- 1단계는 큰 분야, 2단계는 세부 주제, 3단계는 기술/형식/용도까지 반영하세요.
- 가능하면 2~3단계로 구체화하세요. 정말 정보가 부족할 때만 1단계로 끝내세요.
- "개발", "금융", "건강", "여행", "라이프스타일" 같은 대분류만으로 끝내지 말고, 가능한 하위 주제를 추가하세요.
- 제목, 설명, 본문, URL 경로, 해시태그, 작성자명에서 주제를 추론해 더 구체화하세요.
- 예:
  - 개발 일반 글보다는 ["개발", "백엔드", "데이터베이스"]
  - 금융 일반 글보다는 ["금융", "투자", "ETF"]
  - 건강 일반 글보다는 ["건강", "운동", "러닝"]
  - 여행 일반 글보다는 ["여행", "일본", "오사카"]
  - 라이프스타일 일반 글보다는 ["라이프스타일", "요리", "레시피"]

### 출력 전 점검 체크리스트
- 이 경로만 봐도 사용자가 나중에 무엇에 관한 링크인지 감이 오는가?
- 2단계 이름이 "튜토리얼", "기사", "영상", "게시물"처럼 형식만 말하고 있지 않은가?
- URL 경로나 키워드에 드러난 기술명, 지역명, 제품명, 음식명, 운동명 등을 반영했는가?
- 정보가 충분한데 1단계나 2단계에서 멈추고 있지 않은가?

## 규칙
1. 기존 카테고리 트리를 참고하여 가장 적합한 카테고리에 배치하세요.
2. 적합한 기존 카테고리가 없으면 새 카테고리를 생성하세요.
3. 카테고리 경로는 최대 4단계까지 허용됩니다.
4. 카테고리 이름은 순수한 한국어 텍스트를 우선 사용하세요. 이모지, 아이콘, 특수 기호를 절대 포함하지 마세요.
5. 기존 카테고리 이름과 동일한 분류가 있으면 반드시 기존 이름을 그대로 재사용하세요.
6. 제목이나 설명에서 실제 주제를 파악하기 어려우면, URL 경로나 작성자 정보를 단서로 최대한 구체적인 주제를 추론하세요.
7. 카테고리 이름에 "/" 또는 "\\"를 절대 넣지 마세요. "콘텐츠/미디어"처럼 두 개념을 합친 이름도 금지입니다.
8. "기타", "일반", "잡동사니", "기록", "링크", "읽을거리", "자료", "콘텐츠", "미디어"처럼 회수용 바구니 같은 모호한 이름은 마지막 수단으로도 사용하지 마세요.
9. 출력 전 각 카테고리명이 충분히 구체적인지 다시 점검하세요. 더 구체화할 수 있으면 더 구체화하세요.

## 기존 카테고리 트리
${categoryTree || '(아직 카테고리가 없습니다. 새로 생성하세요.)'}

## 출력 형식 (JSON)
{
  "categoryPath": ["대분류", "중분류", "소분류"],
  "isNew": true/false,
  "tags": ["태그1", "태그2", "태그3"]
}`;
}

const SOCIAL_DOMAINS = new Set([
  'youtube.com', 'youtu.be', 'm.youtube.com',
  'instagram.com', 'www.instagram.com',
  'twitter.com', 'x.com', 'mobile.twitter.com',
  'tiktok.com', 'www.tiktok.com',
  'facebook.com', 'www.facebook.com', 'm.facebook.com',
  'threads.net', 'www.threads.net',
  'reddit.com', 'www.reddit.com', 'old.reddit.com',
]);

function buildUserPrompt(metadata: LinkMetadata, context: ClassificationContext): string {
  const isSocial = SOCIAL_DOMAINS.has(metadata.domain);

  return `이 링크의 내용물이 무엇에 관한 것인지만 판단하여 분류하세요.
플랫폼/매체는 무시하고 주제만 보세요. "/"를 카테고리명에 넣지 마세요.
정보가 충분하면 2~3단계로 구체화하세요.

제목: ${metadata.title}
설명: ${metadata.description}${isSocial ? '' : `\n도메인: ${metadata.domain}`}
본문 발췌: ${metadata.bodyText.slice(0, 500)}
URL 경로 힌트: ${context.urlPathHints.join(', ') || '(없음)'}
추정 키워드: ${context.keywordHints.join(', ') || '(없음)'}`;
}

function buildRefinementPrompt(
  metadata: LinkMetadata,
  context: ClassificationContext,
  initialResult: ClassificationResult,
): string {
  return `이전 분류 결과가 충분히 구체적인지 다시 검토해주세요.

이전 결과:
${JSON.stringify(initialResult, null, 2)}

요구사항:
- 더 구체화할 수 있으면 반드시 더 구체적인 경로로 수정하세요.
- 형식 중심 이름("튜토리얼", "기사", "영상", "게시물") 대신 주제 중심 이름으로 바꾸세요.
- 정보가 충분한데 1단계 또는 2단계에서 끝난 경우 보강하세요.
- 수정할 필요가 없다면 그대로 유지해도 되지만, 왜 충분히 구체적인지 스스로 검토한 뒤 JSON만 출력하세요.

제목: ${metadata.title}
설명: ${metadata.description}
도메인: ${metadata.domain}
본문 발췌: ${metadata.bodyText.slice(0, 500)}
URL 경로 힌트: ${context.urlPathHints.join(', ') || '(없음)'}
추정 키워드: ${context.keywordHints.join(', ') || '(없음)'}`;
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
    timeoutSeconds: 120,
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

    // Instagram /share/ URL을 정규화 (oEmbed, embed caption 등에서 사용)
    const normalizedUrl = isInstagram ? normalizeInstagramUrl(url) : url;

    // ── Phase 1: Parallel metadata fetch ──────────────────────────────────
    // Main HTML fetch + oEmbed + Instagram embed all run simultaneously
    const [metadata, oembed, embedCaption] = await Promise.all([
      fetchAndParseHtml(url, parsedUrl),
      fetchOEmbed(normalizedUrl, domain),
      isInstagram ? fetchInstagramEmbedCaption(normalizedUrl) : Promise.resolve(null),
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
        } else {
          // 모든 메타데이터 추출이 실패한 경우 최소한의 title 제공
          const typeLabel: Record<string, string> = {
            post: '게시물', reel: '릴스', story: '스토리', profile: '프로필', unknown: '게시물',
          };
          metadata.title = `Instagram ${typeLabel[hints.postType]}`;
        }
      }
    }

    const classificationContext = extractKeywordHints(url, metadata);

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

    const sanitizedCache = cached
      ? {
          ...cached,
          categoryPath: cached.categoryPath
            .map((name) => sanitizeCategoryName(name))
            .filter(Boolean),
          tags: (cached.tags || [])
            .map((tag) => sanitizeTag(tag))
            .filter(Boolean),
        }
      : null;

    if (
      sanitizedCache &&
      sanitizedCache.categoryPath.length > 0 &&
      !BLOCKED_ROOT_NAMES.includes(sanitizedCache.categoryPath[0]) &&
      !isCategoryPathTooGeneric(
        sanitizedCache.categoryPath,
        classificationContext.richnessScore,
      )
    ) {
      logger.info('Cache hit', { hash: metadataHash, categoryPath: sanitizedCache.categoryPath });
      categoryPath = sanitizedCache.categoryPath;
      tags = sanitizedCache.tags;
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

      const openai = new OpenAI({ apiKey: openaiApiKey.value(), timeout: 30_000 });

      let retries = 0;
      const maxRetries = 2;
      let result: ClassificationResult;

      while (true) {
        try {
          const model = CLASSIFICATION_MODELS[Math.min(retries, CLASSIFICATION_MODELS.length - 1)];
          const completion = await openai.chat.completions.create({
            model,
            messages: [
              { role: 'system', content: buildSystemPrompt(treeString) },
              { role: 'user', content: buildUserPrompt(metadata, classificationContext) },
            ],
            response_format: { type: 'json_object' },
            reasoning_effort: 'low',
            max_completion_tokens: 2048,
          });

          logger.info('OpenAI response', {
            model,
            finishReason: completion.choices[0]?.finish_reason,
            content: completion.choices[0]?.message?.content,
            usage: completion.usage,
          });

          const content = completion.choices[0]?.message?.content;
          if (!content) {
            throw new Error(`AI 응답이 비어있습니다. finish_reason: ${completion.choices[0]?.finish_reason}`);
          }

          result = JSON.parse(content) as ClassificationResult;

          result.categoryPath = (result.categoryPath || [])
            .map((name) => sanitizeCategoryName(name))
            .filter(Boolean);
          result.tags = (result.tags || [])
            .map((tag) => sanitizeTag(tag))
            .filter(Boolean)
            .slice(0, 8);

          const maxDepth = plan === 'premium' ? 4 : 2;
          if (result.categoryPath.length > maxDepth) {
            result.categoryPath = result.categoryPath.slice(0, maxDepth);
          }

          if (result.categoryPath.length === 0) {
            throw new Error('AI가 유효한 카테고리 경로를 반환하지 않았습니다.');
          }

          if (
            isCategoryPathTooGeneric(
              result.categoryPath,
              classificationContext.richnessScore,
            )
          ) {
            const refinementModel = CLASSIFICATION_MODELS[Math.min(retries, CLASSIFICATION_MODELS.length - 1)];
            const refinement = await openai.chat.completions.create({
              model: refinementModel,
              messages: [
                { role: 'system', content: buildSystemPrompt(treeString) },
                {
                  role: 'user',
                  content: buildRefinementPrompt(
                    metadata,
                    classificationContext,
                    result,
                  ),
                },
              ],
              response_format: { type: 'json_object' },
              reasoning_effort: 'medium',
              max_completion_tokens: 2048,
            });

            logger.info('OpenAI refinement response', {
              model: refinementModel,
              finishReason: refinement.choices[0]?.finish_reason,
              content: refinement.choices[0]?.message?.content,
              usage: refinement.usage,
            });

            const refinementContent = refinement.choices[0]?.message?.content;
            if (!refinementContent) {
              throw new Error('AI 재분류 응답이 비어있습니다.');
            }

            const refinedResult = JSON.parse(refinementContent) as ClassificationResult;
            refinedResult.categoryPath = (refinedResult.categoryPath || [])
              .map((name) => sanitizeCategoryName(name))
              .filter(Boolean)
              .slice(0, maxDepth);
            refinedResult.tags = (refinedResult.tags || [])
              .map((tag) => sanitizeTag(tag))
              .filter(Boolean)
              .slice(0, 8);

            if (refinedResult.categoryPath.length > 0) {
              result = refinedResult;
            }
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

      if (
        !isCategoryPathTooGeneric(
          result.categoryPath,
          classificationContext.richnessScore,
        )
      ) {
        db.collection('categoryCache').doc(metadataHash).set({
          categoryPath: result.categoryPath,
          tags: result.tags,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }).catch((err) => logger.warn('Cache save failed', { error: err.message }));
      } else {
        logger.warn('Skip cache save for generic category path', {
          hash: metadataHash,
          categoryPath: result.categoryPath,
          richnessScore: classificationContext.richnessScore,
        });
      }

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
