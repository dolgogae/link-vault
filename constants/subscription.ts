export const PLAN_LIMITS = {
  free: {
    monthlyLinks: 30,
    maxCategoryDepth: 2,
    interstitialThreshold: 3,
  },
  premium: {
    monthlyLinks: Infinity,
    maxCategoryDepth: 4,
    interstitialThreshold: Infinity,
  },
} as const;

export const PRODUCT_ID = 'linkvault_premium_monthly';
