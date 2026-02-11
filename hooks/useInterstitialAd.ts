import { useEffect, useRef, useCallback } from 'react';
import {
  InterstitialAd,
  AdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';
import { useLinkStore } from '@/stores/linkStore';

const INTERSTITIAL_AD_UNIT_ID = __DEV__
  ? TestIds.INTERSTITIAL
  : (process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID || TestIds.INTERSTITIAL);

const SAVE_COUNT_THRESHOLD = 5;

/**
 * 인터스티셜 광고 훅
 * 링크 저장 5회마다 전면 광고 표시
 */
export function useInterstitialAd() {
  const interstitialRef = useRef<InterstitialAd | null>(null);
  const { saveCount } = useLinkStore();
  const lastShownAtRef = useRef(0);

  useEffect(() => {
    const interstitial = InterstitialAd.createForAdRequest(INTERSTITIAL_AD_UNIT_ID, {
      requestNonPersonalizedAdsOnly: true,
    });

    const unsubscribeLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
      // 광고 로드 완료
    });

    const unsubscribeClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      // 닫힌 후 다음 광고 미리 로드
      interstitial.load();
    });

    interstitial.load();
    interstitialRef.current = interstitial;

    return () => {
      unsubscribeLoaded();
      unsubscribeClosed();
    };
  }, []);

  // 저장 카운트에 따른 광고 표시
  useEffect(() => {
    if (
      saveCount > 0 &&
      saveCount % SAVE_COUNT_THRESHOLD === 0 &&
      saveCount !== lastShownAtRef.current
    ) {
      showAd();
      lastShownAtRef.current = saveCount;
    }
  }, [saveCount]);

  const showAd = useCallback(() => {
    const interstitial = interstitialRef.current;
    if (interstitial?.loaded) {
      interstitial.show();
    }
  }, []);

  return { showAd };
}
