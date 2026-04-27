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

let iapReady = false;

export async function initIAP(): Promise<boolean> {
  try {
    await initConnection();
    const products = await fetchProducts({ skus: [PRODUCT_ID], type: 'subs' });
    iapReady = products.length > 0;
    if (!iapReady) {
      console.warn('IAP 초기화: 구독 상품을 찾을 수 없습니다.', PRODUCT_ID);
    }
    return iapReady;
  } catch (error) {
    iapReady = false;
    console.warn('IAP 초기화 실패:', error);
    return false;
  }
}

export function isIAPReady(): boolean {
  return iapReady;
}

export async function purchaseSubscription(): Promise<void> {
  if (!iapReady) {
    const ready = await initIAP();
    if (!ready) {
      throw new Error('결제 서비스에 연결할 수 없습니다. Google Play 스토어가 최신 버전인지 확인해주세요.');
    }
  }
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
