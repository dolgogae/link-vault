import { onRequest } from 'firebase-functions/v2/https';

export { analyzeLink } from './analyzeLink';
export { categorizeLink } from './categorize';
export { saveLink } from './saveLink';

export { cleanupCategories } from './cleanupCategories';

export const healthCheck = onRequest((req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'linkvault-functions',
  });
});
