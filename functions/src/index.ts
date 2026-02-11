import { onRequest } from 'firebase-functions/v2/https';

// Auth
export { createKakaoToken, createNaverToken } from './auth';

// Link Analysis
export { analyzeLink } from './analyzeLink';
export { categorizeLink } from './categorize';
export { saveLink } from './saveLink';

export const healthCheck = onRequest((req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'linkvault-functions',
  });
});
