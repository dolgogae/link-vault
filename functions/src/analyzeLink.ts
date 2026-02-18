import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as cheerio from 'cheerio';
import * as logger from 'firebase-functions/logger';

export interface LinkMetadata {
  title: string;
  description: string;
  ogImage: string;
  favicon: string;
  domain: string;
  bodyText: string;
}

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

export const analyzeLink = onCall<{ url: string }>(
  { timeoutSeconds: 30, memory: '256MiB' },
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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    // Instagram/TikTok은 크롤러 봇 UA를 사용해야 og: 태그를 정상 반환
    const isWalledPlatform = ['instagram.com', 'tiktok.com'].some((d) =>
      parsedUrl.hostname.includes(d),
    );
    const userAgent = isWalledPlatform
      ? 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
      : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

    let metadata: LinkMetadata;
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': userAgent,
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
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

      const ogImage =
        $('meta[property="og:image"]').attr('content') ||
        '';

      let favicon =
        $('link[rel="icon"]').attr('href') ||
        $('link[rel="shortcut icon"]').attr('href') ||
        '/favicon.ico';

      if (favicon && !favicon.startsWith('http')) {
        favicon = `${parsedUrl.protocol}//${parsedUrl.host}${favicon.startsWith('/') ? '' : '/'}${favicon}`;
      }

      $('script, style, nav, header, footer').remove();
      const bodyText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 500);

      metadata = {
        title: title.trim(),
        description: description.trim(),
        ogImage,
        favicon,
        domain: parsedUrl.hostname,
        bodyText,
      };

    } catch (error: any) {
      logger.warn('Scraping failed, using fallback metadata', {
        url,
        error: error.message,
      });

      if (error instanceof HttpsError) throw error;

      metadata = {
        title: parsedUrl.hostname + decodeURIComponent(parsedUrl.pathname),
        description: '',
        ogImage: '',
        favicon: `${parsedUrl.protocol}//${parsedUrl.host}/favicon.ico`,
        domain: parsedUrl.hostname,
        bodyText: `URL: ${url}`,
      };
    } finally {
      clearTimeout(timeout);
    }

    const oembed = await fetchOEmbed(url, parsedUrl.hostname);
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

    if (parsedUrl.hostname.includes('instagram.com')) {
      const hints = extractInstagramHints(url, metadata);

      const embedCaption = await fetchInstagramEmbedCaption(url);

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

    return metadata;
  },
);
