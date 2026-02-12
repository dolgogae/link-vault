import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as cheerio from 'cheerio';

if (!admin.apps.length) {
  admin.initializeApp();
}

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
            'Mozilla/5.0 (compatible; LinkVault/1.0; +https://linkvault.app)',
          Accept: 'text/html,application/xhtml+xml',
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
      if (error.name === 'AbortError') {
        throw new HttpsError('deadline-exceeded', '스크래핑 시간 초과 (10초)');
      }
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', `스크래핑 오류: ${error.message}`);
    } finally {
      clearTimeout(timeout);
    }

    return metadata;
  },
);
