import { useEffect, useRef } from 'react';
import { useShareIntent } from 'expo-share-intent';
import { useAuthStore } from '@/stores/authStore';
import { useLinkStore } from '@/stores/linkStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { analyzeAndSaveLink } from '@/services/links';

export function useShareIntentHandler() {
  const { shareIntent, resetShareIntent } = useShareIntent();
  const { user } = useAuthStore();
  const { incrementSaveCount, setSaving, setSaveResult } = useLinkStore();
  const lastSavedUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;
    if (!shareIntent?.text && !shareIntent?.webUrl) return;

    const url = shareIntent.webUrl || extractUrl(shareIntent.text || '');
    if (!url) {
      resetShareIntent(false);
      return;
    }

    handleSharedUrl(url);
    resetShareIntent(false);
  }, [shareIntent, user]);

  const handleSharedUrl = async (url: string) => {
    // 같은 URL 연속 저장 방지 (30초 쿨다운)
    if (lastSavedUrl.current === url) return;
    lastSavedUrl.current = url;
    setTimeout(() => { lastSavedUrl.current = null; }, 30000);

    const remaining = useSubscriptionStore.getState().getMonthlyRemaining();
    if (remaining <= 0) {
      setSaveResult({ type: 'error', message: '이번 달 무료 저장 한도(30개)를 초과했습니다.' });
      return;
    }

    setSaving(true);
    setSaveResult(null);

    analyzeAndSaveLink(url)
      .then((result) => {
        incrementSaveCount();
        setSaveResult({ type: 'success', categoryPath: result.categoryPath });
      })
      .catch((error: any) => {
        const messages: Record<string, string> = {
          'already-exists': '이미 저장된 링크입니다.',
          'resource-exhausted': '이번 달 무료 저장 한도를 초과했습니다.',
          'invalid-argument': '유효하지 않은 URL입니다.',
          'unauthenticated': '로그인이 필요합니다.',
        };
        const message = messages[error.code] || '링크 저장에 실패했습니다. 다시 시도해주세요.';
        setSaveResult({ type: 'error', message });
      })
      .finally(() => {
        setSaving(false);
      });
  };
}

export function extractUrl(text: string): string | null {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
  const matches = text.match(urlRegex);
  return matches?.[0] || null;
}
