import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * 카카오 로그인 - Firebase Custom Token 발급
 *
 * 흐름:
 * 1. 클라이언트에서 카카오 SDK로 accessToken 획득
 * 2. 이 함수에 accessToken 전달
 * 3. 카카오 API로 사용자 정보 검증
 * 4. Firebase Custom Token 생성 후 반환
 * 5. 클라이언트에서 signInWithCustomToken으로 Firebase 로그인
 */
export const createKakaoToken = onCall(
  { timeoutSeconds: 10 },
  async (request) => {
    const { accessToken } = request.data;
    if (!accessToken || typeof accessToken !== 'string') {
      throw new HttpsError('invalid-argument', 'accessToken is required');
    }

    // 카카오 API로 사용자 정보 조회
    const kakaoResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!kakaoResponse.ok) {
      throw new HttpsError('unauthenticated', 'Invalid Kakao access token');
    }

    const kakaoUser = (await kakaoResponse.json()) as {
      id: number;
      kakao_account?: {
        profile?: { nickname?: string };
        email?: string;
      };
    };

    const uid = `kakao:${kakaoUser.id}`;
    const displayName =
      kakaoUser.kakao_account?.profile?.nickname || '카카오 사용자';
    const email = kakaoUser.kakao_account?.email || undefined;

    // Firebase Auth 사용자 생성 또는 업데이트
    try {
      await admin.auth().updateUser(uid, { displayName, email });
    } catch {
      await admin.auth().createUser({ uid, displayName, email });
    }

    // Custom Token 발급
    const customToken = await admin.auth().createCustomToken(uid);
    return { customToken, displayName, email };
  },
);
