import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

export const createKakaoToken = onCall(
  { timeoutSeconds: 10 },
  async (request) => {
    const { accessToken } = request.data;
    if (!accessToken || typeof accessToken !== 'string') {
      throw new HttpsError('invalid-argument', 'accessToken is required');
    }

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

    try {
      await admin.auth().updateUser(uid, { displayName, email });
    } catch {
      await admin.auth().createUser({ uid, displayName, email });
    }

    const customToken = await admin.auth().createCustomToken(uid);
    return { customToken, displayName, email };
  },
);
