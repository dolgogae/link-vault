import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';
import { admin } from './admin';
import { google } from 'googleapis';

const serviceAccountKey = defineSecret('GOOGLE_PLAY_SERVICE_ACCOUNT');

interface VerifyPurchaseData {
  productId: string;
  purchaseToken: string;
}

export const verifyPurchase = onCall<VerifyPurchaseData>(
  {
    timeoutSeconds: 15,
    secrets: [serviceAccountKey],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '인증이 필요합니다.');
    }

    const userId = request.auth.uid;
    const { productId, purchaseToken } = request.data;
    const packageName = 'com.linkvault.app';

    try {
      const credentials = JSON.parse(serviceAccountKey.value());
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/androidpublisher'],
      });

      const androidPublisher = google.androidpublisher({ version: 'v3', auth });

      const subscription = await androidPublisher.purchases.subscriptions.get({
        packageName,
        subscriptionId: productId,
        token: purchaseToken,
      });

      const { expiryTimeMillis, autoRenewing } = subscription.data;

      if (!expiryTimeMillis || Number(expiryTimeMillis) < Date.now()) {
        await admin.firestore().collection('users').doc(userId).update({
          plan: 'free',
          subscription: admin.firestore.FieldValue.delete(),
        });
        return { valid: false, plan: 'free' };
      }

      await admin.firestore().collection('users').doc(userId).update({
        plan: 'premium',
        subscription: {
          productId,
          purchaseToken,
          expiresAt: new Date(Number(expiryTimeMillis)),
          autoRenewing: autoRenewing || false,
        },
      });

      return {
        valid: true,
        plan: 'premium',
        expiresAt: Number(expiryTimeMillis),
      };
    } catch (error: any) {
      logger.error('Purchase verification failed', { error: error.message });
      throw new HttpsError('internal', '구매 확인에 실패했습니다.');
    }
  },
);
