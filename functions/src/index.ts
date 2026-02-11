import { onRequest } from 'firebase-functions/v2/https';

// Auth
export { createKakaoToken, createNaverToken } from './auth';

export const healthCheck = onRequest((req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'linkvault-functions',
  });
});
