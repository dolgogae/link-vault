import { useEffect } from 'react';
import { useShareIntent } from 'expo-share-intent';
import { Alert } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { useLinkStore } from '@/stores/linkStore';
import { analyzeAndSaveLink } from '@/services/links';

/**
 * OS 공유 기능으로 전달된 URL을 처리하는 훅
 * 백그라운드에서 저장 + 분류를 진행하고 토스트로 결과를 알림
 */
export function useShareIntentHandler() {
  const { shareIntent, resetShareIntent } = useShareIntent();
  const { user } = useAuthStore();
  const { incrementSaveCount } = useLinkStore();

  useEffect(() => {
    if (!shareIntent?.text || !user) return;

    const url = extractUrl(shareIntent.text);
    if (!url) {
      resetShareIntent();
      return;
    }

    handleSharedUrl(url);
    resetShareIntent();
  }, [shareIntent, user]);

  const handleSharedUrl = async (url: string) => {
    try {
      const result = await analyzeAndSaveLink(url);
      incrementSaveCount();
      Alert.alert(
        '저장 완료',
        `[${result.categoryPath.join(' > ')}]에 저장되었습니다.`,
      );
    } catch (error: any) {
      if (error.code === 'already-exists') {
        Alert.alert('안내', '이미 저장된 링크입니다.');
      } else {
        Alert.alert('저장 실패', '링크 저장에 실패했습니다. 다시 시도해주세요.');
      }
    }
  };
}

/**
 * 공유된 텍스트에서 URL 추출
 */
function extractUrl(text: string): string | null {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
  const matches = text.match(urlRegex);
  return matches?.[0] || null;
}
