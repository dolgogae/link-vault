import { useEffect } from 'react';
import { useShareIntent } from 'expo-share-intent';
import { Alert } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { useLinkStore } from '@/stores/linkStore';
import { analyzeAndSaveLink } from '@/services/links';

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

function extractUrl(text: string): string | null {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
  const matches = text.match(urlRegex);
  return matches?.[0] || null;
}
