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

    return metadata;
  },
);
