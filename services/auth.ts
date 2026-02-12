import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import functions from '@react-native-firebase/functions';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as KakaoLogin from '@react-native-seoul/kakao-login';
import { User } from '@/types';

/**
 * Google Sign-In 초기화
 * 앱 시작 시 한 번 호출해야 함
 */
export function initializeGoogleSignIn() {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!webClientId) {
    console.warn('[Auth] EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID가 설정되지 않았습니다.');
    return;
  }
  GoogleSignin.configure({ webClientId });
}

/**
 * 구글 로그인
 *
 * 흐름:
 * 1. GoogleSignin.signIn() → idToken 획득
 * 2. Firebase GoogleAuthProvider.credential(idToken) → credential 생성
 * 3. auth().signInWithCredential(credential) → Firebase 로그인
 * 4. Firestore users 문서 생성 (최초 1회)
 */
export async function signInWithGoogle() {
  // Play Services 확인 (Android)
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  // 구글 로그인 UI 표시
  const response = await GoogleSignin.signIn();
  const idToken = response.data?.idToken;
  if (!idToken) {
    throw new Error('Google 로그인에서 idToken을 받지 못했습니다.');
  }

  // Firebase credential 생성 및 로그인
  const credential = auth.GoogleAuthProvider.credential(idToken);
  const userCredential = await auth().signInWithCredential(credential);

  // Firestore 사용자 문서 생성
  await createUserDocumentIfNeeded(userCredential.user, 'google');

  return userCredential;
}

/**
 * 애플 로그인 (iOS 전용)
 *
 * 흐름:
 * 1. nonce 생성 → SHA256 해시
 * 2. AppleAuthentication.signInAsync() → identityToken + authorizationCode 획득
 * 3. Firebase OAuthProvider.credential('apple.com', idToken, nonce) → credential 생성
 * 4. auth().signInWithCredential(credential) → Firebase 로그인
 * 5. Firestore users 문서 생성 (최초 1회)
 */
export async function signInWithApple() {
  // 랜덤 nonce 생성 (replay attack 방지)
  const rawNonce = generateNonce(32);
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

  // Apple 로그인 UI 표시
  const appleCredential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  const { identityToken } = appleCredential;
  if (!identityToken) {
    throw new Error('Apple 로그인에서 identityToken을 받지 못했습니다.');
  }

  // Firebase OAuthCredential 생성
  // RN Firebase 타입에 nonce 파라미터가 누락되어 있으나 런타임에서 정상 동작
  const credential = (auth.AppleAuthProvider as any).credential(identityToken, rawNonce);

  const userCredential = await auth().signInWithCredential(credential);

  // Apple은 최초 로그인 시에만 이름을 제공하므로 displayName 업데이트
  if (appleCredential.fullName) {
    const displayName = [
      appleCredential.fullName.familyName,
      appleCredential.fullName.givenName,
    ]
      .filter(Boolean)
      .join('');

    if (displayName && !userCredential.user.displayName) {
      await userCredential.user.updateProfile({ displayName });
    }
  }

  // Firestore 사용자 문서 생성
  await createUserDocumentIfNeeded(userCredential.user, 'apple');

  return userCredential;
}

/**
 * 카카오 로그인
 *
 * 흐름:
 * 1. KakaoLogin.login() → accessToken 획득
 * 2. Cloud Function createKakaoToken에 accessToken 전달
 * 3. Cloud Function이 카카오 API로 사용자 검증 후 Firebase Custom Token 반환
 * 4. auth().signInWithCustomToken(customToken) → Firebase 로그인
 * 5. Firestore users 문서 생성 (최초 1회)
 */
export async function signInWithKakao() {
  // 카카오 SDK 로그인 UI 표시
  const result = await KakaoLogin.login();
  const { accessToken } = result;
  if (!accessToken) {
    throw new Error('카카오 로그인에서 accessToken을 받지 못했습니다.');
  }

  // Cloud Function으로 Firebase Custom Token 발급
  const response = await functions().httpsCallable('createKakaoToken')({
    accessToken,
  });
  const { customToken } = response.data as { customToken: string };

  // Firebase 로그인
  const userCredential = await auth().signInWithCustomToken(customToken);

  // Firestore 사용자 문서 생성
  await createUserDocumentIfNeeded(userCredential.user, 'kakao');

  return userCredential;
}

/**
 * Firestore에 사용자 문서 생성 (최초 로그인 시에만)
 */
async function createUserDocumentIfNeeded(
  user: { uid: string; displayName: string | null; email: string | null },
  provider: User['provider'],
) {
  const userDoc = firestore().collection('users').doc(user.uid);
  const snapshot = await userDoc.get();

  if (!snapshot.exists) {
    const userData: User = {
      displayName: user.displayName || '사용자',
      email: user.email || '',
      provider,
      createdAt: new Date(),
      linkCount: 0,
      plan: 'free',
    };
    await userDoc.set(userData);
  }
}

/**
 * 로그아웃
 */
export async function signOut() {
  // 구글 로그인 세션도 함께 해제
  try {
    await GoogleSignin.signOut();
  } catch {
    // Google Sign-In이 아닌 경우 무시
  }

  await auth().signOut();
}

/**
 * 계정 삭제 (모든 사용자 데이터 삭제)
 *
 * 순서:
 * 1. Firestore 하위 컬렉션 (links, categories) 삭제
 * 2. Firestore 사용자 문서 삭제
 * 3. Firebase Auth 계정 삭제
 *
 * 주의: Firebase Auth 삭제는 마지막에 해야 함 (삭제 후에는 Firestore 접근 불가)
 */
export async function deleteAccount() {
  const user = auth().currentUser;
  if (!user) throw new Error('로그인 상태가 아닙니다.');

  const userRef = firestore().collection('users').doc(user.uid);

  // 링크 삭제 (batch 500개 제한 대응)
  const links = await userRef.collection('links').get();
  const linkBatch = firestore().batch();
  links.docs.forEach((doc) => linkBatch.delete(doc.ref));
  if (!links.empty) await linkBatch.commit();

  // 카테고리 삭제
  const categories = await userRef.collection('categories').get();
  const catBatch = firestore().batch();
  categories.docs.forEach((doc) => catBatch.delete(doc.ref));
  if (!categories.empty) await catBatch.commit();

  // 사용자 문서 삭제
  await userRef.delete();

  // Firebase Auth 계정 삭제 (가장 마지막)
  await user.delete();
}

/**
 * Auth 상태 변화 리스너
 */
export function onAuthStateChanged(
  callback: (user: import('@react-native-firebase/auth').FirebaseAuthTypes.User | null) => void,
) {
  return auth().onAuthStateChanged(callback);
}

/**
 * 랜덤 nonce 문자열 생성 (Apple Sign-In용)
 */
function generateNonce(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
}
