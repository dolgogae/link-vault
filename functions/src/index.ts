import { onRequest } from 'firebase-functions/v2/https';

export { saveFullLink } from './saveFullLink';

export { cleanupCategories } from './cleanupCategories';
export { verifyPurchase } from './verifyPurchase';

export const healthCheck = onRequest((req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'linkvault-functions',
  });
});
