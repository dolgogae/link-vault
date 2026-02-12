import { isCoupangUrl, toCoupangAffiliateUrl, isShoppingCategory } from '@/utils/coupang';

describe('isCoupangUrl', () => {
  it('returns true for coupang.com URLs', () => {
    expect(isCoupangUrl('https://www.coupang.com/vp/products/123')).toBe(true);
  });

  it('returns true for link.coupang.com URLs', () => {
    expect(isCoupangUrl('https://link.coupang.com/re/AFFSDP?lptag=test')).toBe(true);
  });

  it('returns false for non-coupang URLs', () => {
    expect(isCoupangUrl('https://www.google.com')).toBe(false);
  });

  it('returns false for invalid URLs', () => {
    expect(isCoupangUrl('not a url')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isCoupangUrl('')).toBe(false);
  });
});

describe('toCoupangAffiliateUrl', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns original URL when COUPANG_PARTNER_ID is not set', () => {
    const url = 'https://www.coupang.com/vp/products/123';
    expect(toCoupangAffiliateUrl(url)).toBe(url);
  });

  it('returns original URL if already a partners link', () => {
    const url = 'https://link.coupang.com/re/AFFSDP?lptag=existing';
    expect(toCoupangAffiliateUrl(url)).toBe(url);
  });
});

describe('isShoppingCategory', () => {
  it('returns true when category path contains shopping keywords', () => {
    expect(isShoppingCategory(['쇼핑', '전자기기'])).toBe(true);
  });

  it('returns true for "할인" keyword', () => {
    expect(isShoppingCategory(['생활', '할인정보'])).toBe(true);
  });

  it('returns false when no shopping keywords', () => {
    expect(isShoppingCategory(['기술', '프로그래밍'])).toBe(false);
  });

  it('returns false for empty array', () => {
    expect(isShoppingCategory([])).toBe(false);
  });
});
