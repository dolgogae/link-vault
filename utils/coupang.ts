const COUPANG_PARTNER_ID = process.env.EXPO_PUBLIC_COUPANG_PARTNER_ID || '';
const COUPANG_SUB_ID = process.env.EXPO_PUBLIC_COUPANG_SUB_ID || 'linkvault';

/**
 * 쿠팡 도메인인지 확인
 */
export function isCoupangUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname.includes('coupang.com') ||
      parsed.hostname.includes('link.coupang.com')
    );
  } catch {
    return false;
  }
}

/**
 * 쿠팡 URL을 파트너스 딥링크로 변환
 * 쿠팡 파트너스 어필리에이트 링크 형식으로 변환하여 수수료 수익 발생
 */
export function toCoupangAffiliateUrl(originalUrl: string): string {
  if (!COUPANG_PARTNER_ID) return originalUrl;

  // 이미 파트너스 링크인 경우 그대로 반환
  if (originalUrl.includes('link.coupang.com')) return originalUrl;

  const encodedUrl = encodeURIComponent(originalUrl);
  return `https://link.coupang.com/re/AFFSDP?lptag=AF${COUPANG_PARTNER_ID}&subid=${COUPANG_SUB_ID}&pageurl=${encodedUrl}`;
}

/**
 * 쇼핑 카테고리인지 확인
 */
export function isShoppingCategory(categoryPath: string[]): boolean {
  const shoppingKeywords = ['쇼핑', '상품', '리뷰', '구매', '할인', '추천상품'];
  return categoryPath.some((name) =>
    shoppingKeywords.some((keyword) => name.includes(keyword)),
  );
}
