import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * 카카오 로그인 - Custom Token 발급
 * 카카오 Access Token으로 사용자 정보 조회 후 Firebase Custom Token 생성
 */
export const createKakaoToken = onRequest(
  { cors: true, timeoutSeconds: 10 },
  async (req, res) => {
    try {
      const { accessToken } = req.body;
      if (!accessToken) {
        res.status(400).json({ error: 'accessToken is required' });
        return;
      }

      // 카카오 API로 사용자 정보 조회
      const kakaoResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!kakaoResponse.ok) {
        res.status(401).json({ error: 'Invalid Kakao access token' });
        return;
      }

      const kakaoUser = await kakaoResponse.json();
      const uid = `kakao:${kakaoUser.id}`;

      // Firebase 사용자 생성 또는 업데이트
      try {
        await admin.auth().getUser(uid);
      } catch {
        await admin.auth().createUser({
          uid,
          displayName: kakaoUser.kakao_account?.profile?.nickname || '카카오 사용자',
          email: kakaoUser.kakao_account?.email || undefined,
        });
      }

      // Custom Token 생성
      const customToken = await admin.auth().createCustomToken(uid);
      res.json({ customToken });
    } catch (error) {
      console.error('createKakaoToken error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * 네이버 로그인 - Custom Token 발급
 * 네이버 Access Token으로 사용자 정보 조회 후 Firebase Custom Token 생성
 */
export const createNaverToken = onRequest(
  { cors: true, timeoutSeconds: 10 },
  async (req, res) => {
    try {
      const { accessToken } = req.body;
      if (!accessToken) {
        res.status(400).json({ error: 'accessToken is required' });
        return;
      }

      // 네이버 API로 사용자 정보 조회
      const naverResponse = await fetch('https://openapi.naver.com/v1/nid/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!naverResponse.ok) {
        res.status(401).json({ error: 'Invalid Naver access token' });
        return;
      }

      const naverData = await naverResponse.json();
      const naverUser = naverData.response;
      const uid = `naver:${naverUser.id}`;

      // Firebase 사용자 생성 또는 업데이트
      try {
        await admin.auth().getUser(uid);
      } catch {
        await admin.auth().createUser({
          uid,
          displayName: naverUser.name || naverUser.nickname || '네이버 사용자',
          email: naverUser.email || undefined,
        });
      }

      // Custom Token 생성
      const customToken = await admin.auth().createCustomToken(uid);
      res.json({ customToken });
    } catch (error) {
      console.error('createNaverToken error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);
