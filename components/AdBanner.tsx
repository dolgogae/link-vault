import { View } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { useSubscriptionStore } from '@/stores/subscriptionStore';

const BANNER_AD_UNIT_ID = __DEV__
  ? TestIds.ADAPTIVE_BANNER
  : (process.env.EXPO_PUBLIC_ADMOB_BANNER_ID || TestIds.ADAPTIVE_BANNER);

interface AdBannerProps {
  show?: boolean;
}

export function AdBanner({ show = true }: AdBannerProps) {
  const isPremium = useSubscriptionStore((s) => s.plan === 'premium');
  if (!show || isPremium) return null;

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
