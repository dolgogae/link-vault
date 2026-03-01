import { useEffect, useRef, useCallback } from 'react';
import {
  InterstitialAd,
  AdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';
import { useLinkStore } from '@/stores/linkStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';

const INTERSTITIAL_AD_UNIT_ID = __DEV__
  ? TestIds.INTERSTITIAL
  : (process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID || TestIds.INTERSTITIAL);

const SAVE_COUNT_THRESHOLD = 3;

export function useInterstitialAd() {
  const interstitialRef = useRef<InterstitialAd | null>(null);
  const { saveCount } = useLinkStore();
  const plan = useSubscriptionStore((s) => s.plan);
  const lastShownAtRef = useRef(0);

  useEffect(() => {
    const interstitial = InterstitialAd.createForAdRequest(INTERSTITIAL_AD_UNIT_ID, {
      requestNonPersonalizedAdsOnly: true,
    });

    const unsubscribeLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {});

    const unsubscribeClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      interstitial.load();
    });

    interstitial.load();
    interstitialRef.current = interstitial;

    return () => {
      unsubscribeLoaded();
      unsubscribeClosed();
    };
  }, []);

  // 저장 카운트에 따른 광고 표시 (프리미엄은 스킵)
  useEffect(() => {
    if (plan === 'premium') return;
    if (
      saveCount > 0 &&
      saveCount % SAVE_COUNT_THRESHOLD === 0 &&
      saveCount !== lastShownAtRef.current
    ) {
      showAd();
      lastShownAtRef.current = saveCount;
    }
  }, [saveCount, plan]);

  const showAd = useCallback(() => {
    const interstitial = interstitialRef.current;
    if (interstitial?.loaded) {
      interstitial.show();
    }
  }, []);

  return { showAd };
}
