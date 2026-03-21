import {
  initConnection,
  endConnection,
  fetchProducts,
  requestPurchase,
  getAvailablePurchases,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  ErrorCode,
} from 'react-native-iap';
import type { Purchase, PurchaseError, EventSubscription } from 'react-native-iap';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { onSnapshot } from '@react-native-firebase/firestore';
import { getUserRef } from '@/utils/firestore';
import { PRODUCT_ID } from '@/constants/subscription';

export async function initIAP(): Promise<void> {
  try {
    await initConnection();
    await fetchProducts({ skus: [PRODUCT_ID], type: 'subs' });
  } catch (error) {
    console.warn('IAP 초기화 실패:', error);
  }
}

export async function purchaseSubscription(): Promise<void> {
  await requestPurchase({
    request: {
      android: {
        skus: [PRODUCT_ID],
      },
    },
    type: 'subs',
  });
}

export async function verifyAndActivate(
  productId: string,
  purchaseToken: string,
): Promise<{ valid: boolean; plan: string; expiresAt?: number }> {
  const fns = getFunctions();
  const result = await httpsCallable(fns, 'verifyPurchase')({
    productId,
    purchaseToken,
  });
  return result.data as { valid: boolean; plan: string; expiresAt?: number };
}

export async function restorePurchases(): Promise<Purchase[]> {
  const purchases = await getAvailablePurchases({});
  return purchases;
}

export function endIAP(): void {
  endConnection();
}

export function setupPurchaseListeners(
  onPurchase: (purchase: Purchase) => Promise<void>,
  onError: (error: PurchaseError) => void,
): { purchaseSub: EventSubscription; errorSub: EventSubscription } {
  const purchaseSub = purchaseUpdatedListener(onPurchase);
  const errorSub = purchaseErrorListener(onError);
  return { purchaseSub, errorSub };
}

export function subscribeToUserPlan(
  userId: string,
  callback: (plan: 'free' | 'premium', monthlyUsage?: { period: string; linksSaved: number }) => void,
) {
  return onSnapshot(getUserRef(userId), (snapshot) => {
    const data = snapshot.data();
    callback(data?.plan || 'free', data?.monthlyUsage);
  });
}

export { finishTransaction, ErrorCode };
export type { Purchase, PurchaseError };
