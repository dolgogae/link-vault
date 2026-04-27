import { useEffect } from 'react';
import { useShareIntent } from 'expo-share-intent';
import { useAuthStore } from '@/stores/authStore';
import { useLinkStore } from '@/stores/linkStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { analyzeAndSaveLink } from '@/services/links';

export function useShareIntentHandler() {
  const { shareIntent, resetShareIntent } = useShareIntent();
  const { user } = useAuthStore();
  const { incrementSaveCount, setSaving, setSaveResult } = useLinkStore();

  useEffect(() => {
    if (!user) return;
    if (!shareIntent?.text && !shareIntent?.webUrl) return;

    const url = shareIntent.webUrl || extractUrl(shareIntent.text || '');
    if (!url) {
      resetShareIntent();
      return;
    }

    handleSharedUrl(url);
    resetShareIntent();
  }, [shareIntent, user]);

  const handleSharedUrl = async (url: string) => {
    const remaining = useSubscriptionStore.getState().getMonthlyRemaining();
    if (remaining <= 0) {
      setSaveResult({ type: 'error', message: '이번 달 무료 저장 한도(30개)를 초과했습니다.' });
      return;
    }

    setSaving(true);
    setSaveResult(null);

    // 백그라운드 저장: fire-and-forget 후 푸시 알림으로 결과 수신
    analyzeAndSaveLink(url)
      .then((result) => {
        incrementSaveCount();
        setSaveResult({ type: 'success', categoryPath: result.categoryPath });
      })
      .catch((error: any) => {
        if (error.code === 'already-exists') {
          setSaveResult({ type: 'error', message: '이미 저장된 링크입니다.' });
        } else {
          setSaveResult({ type: 'error', message: '링크 저장에 실패했습니다.' });
        }
      })
      .finally(() => {
        setSaving(false);
      });

    // 즉시 진행중 토스트 표시 후 앱 전환 가능
    setSaveResult(null);
  };
}

export function extractUrl(text: string): string | null {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
  const matches = text.match(urlRegex);
  return matches?.[0] || null;
}
