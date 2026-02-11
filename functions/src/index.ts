import { onRequest } from 'firebase-functions/v2/https';

export const healthCheck = onRequest((req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'linkvault-functions',
  });
});
