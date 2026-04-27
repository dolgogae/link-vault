import { extractUrl } from '@/hooks/useShareIntent';

describe('extractUrl', () => {
  it('extracts URL from plain text', () => {
    expect(extractUrl('Check this out https://example.com/page')).toBe(
      'https://example.com/page',
    );
  });

  it('extracts URL with path and query params', () => {
    expect(
      extractUrl('Visit https://example.com/path?q=test&page=1'),
    ).toBe('https://example.com/path?q=test&page=1');
  });

  it('extracts http URL', () => {
    expect(extractUrl('Go to http://example.com')).toBe('http://example.com');
  });

  it('returns first URL when multiple URLs exist', () => {
    const text = 'First https://first.com then https://second.com';
    expect(extractUrl(text)).toBe('https://first.com');
  });

  it('returns null when no URL exists', () => {
    expect(extractUrl('just plain text without urls')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractUrl('')).toBeNull();
  });

  it('extracts URL surrounded by text', () => {
    expect(
      extractUrl('이 링크 봐봐 https://naver.com/news/123 진짜 재밌어'),
    ).toBe('https://naver.com/news/123');
  });

  it('extracts Instagram share URL', () => {
    expect(
      extractUrl('https://www.instagram.com/share/reel/ABC123/?igsh=xyz'),
    ).toBe('https://www.instagram.com/share/reel/ABC123/?igsh=xyz');
  });

  it('extracts Instagram reel URL', () => {
    expect(
      extractUrl('https://www.instagram.com/reel/ABC123/'),
    ).toBe('https://www.instagram.com/reel/ABC123/');
  });

  it('extracts YouTube URL with query params', () => {
    expect(
      extractUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
    ).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });

  it('extracts youtu.be short URL', () => {
    expect(
      extractUrl('https://youtu.be/dQw4w9WgXcQ'),
    ).toBe('https://youtu.be/dQw4w9WgXcQ');
  });
});
