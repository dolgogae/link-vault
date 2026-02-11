import { View } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';

const BANNER_AD_UNIT_ID = __DEV__
  ? TestIds.ADAPTIVE_BANNER
  : (process.env.EXPO_PUBLIC_ADMOB_BANNER_ID || TestIds.ADAPTIVE_BANNER);

interface AdBannerProps {
  show?: boolean;
}

/**
 * AdMob 배너 광고 컴포넌트
 * 메인 화면(카테고리 목록)과 링크 목록 화면에 배치
 * 링크 상세보기, 설정 화면에서는 표시하지 않음
 */
export function AdBanner({ show = true }: AdBannerProps) {
  if (!show) return null;

  return (
    <View className="items-center bg-background dark:bg-background-dark py-1">
      <BannerAd
        unitId={BANNER_AD_UNIT_ID}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
      />
    </View>
  );
}
