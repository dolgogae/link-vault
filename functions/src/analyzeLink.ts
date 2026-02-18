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

// oEmbed로 플랫폼 콘텐츠의 실제 제목/설명 보강
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

    let metadata: LinkMetadata;
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
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

      // 스크래핑 실패 시 URL 기반 최소 메타데이터로 폴백
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

    // 소셜/동영상 플랫폼은 oEmbed로 메타데이터 보강
    const oembed = await fetchOEmbed(url, parsedUrl.hostname);
    if (oembed) {
      logger.info('oEmbed data fetched', { domain: parsedUrl.hostname, oembed });

      // 제목이 제네릭하면 oEmbed 제목으로 교체
      const genericTitles = ['instagram', 'youtube', 'tiktok', 'x.com', 'twitter'];
      const isGenericTitle =
        !metadata.title ||
        genericTitles.some((g) => metadata.title.toLowerCase().includes(g) && metadata.title.length < 40);

      if (isGenericTitle && oembed.title) {
        metadata.title = oembed.title;
      }

      // 작성자 정보를 본문에 추가
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

    return metadata;
  },
);
