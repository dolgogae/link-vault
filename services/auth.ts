import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { User } from '@/types';

// Google Sign-In 설정 (app.json의 webClientId 필요)
GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
});

/**
 * 구글 로그인
 */
export async function signInWithGoogle() {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  const idToken = response.data?.idToken;
  if (!idToken) throw new Error('Google Sign-In failed: no idToken');

  const credential = auth.GoogleAuthProvider.credential(idToken);
  const userCredential = await auth().signInWithCredential(credential);
  await createUserDocumentIfNeeded(userCredential.user, 'google');
  return userCredential;
}

/**
 * 애플 로그인
 */
export async function signInWithApple() {
  const appleCredential = await auth.AppleAuthProvider.credential();
  const userCredential = await auth().signInWithCredential(appleCredential);
  await createUserDocumentIfNeeded(userCredential.user, 'apple');
  return userCredential;
}

/**
 * 카카오 로그인 (Cloud Function으로 Custom Token 발급)
 */
export async function signInWithKakao(kakaoAccessToken: string) {
  const response = await fetch(
    `https://${process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID}.cloudfunctions.net/createKakaoToken`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken: kakaoAccessToken }),
    },
  );
  const { customToken } = await response.json();
  const userCredential = await auth().signInWithCustomToken(customToken);
  await createUserDocumentIfNeeded(userCredential.user, 'kakao');
  return userCredential;
}

/**
 * 네이버 로그인 (Cloud Function으로 Custom Token 발급)
 */
export async function signInWithNaver(naverAccessToken: string) {
  const response = await fetch(
    `https://${process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID}.cloudfunctions.net/createNaverToken`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken: naverAccessToken }),
    },
  );
  const { customToken } = await response.json();
  const userCredential = await auth().signInWithCustomToken(customToken);
  await createUserDocumentIfNeeded(userCredential.user, 'naver');
  return userCredential;
}

/**
 * Firestore에 사용자 문서 생성 (최초 로그인 시)
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
  try {
    await GoogleSignin.signOut();
  } catch {
    // Google Sign-In이 아닌 경우 무시
  }
  await auth().signOut();
}

/**
 * 계정 삭제 (모든 사용자 데이터 삭제)
 */
export async function deleteAccount() {
  const user = auth().currentUser;
  if (!user) throw new Error('No user signed in');

  // Firestore 데이터 삭제 (하위 컬렉션 포함)
  const userRef = firestore().collection('users').doc(user.uid);

  // 링크 삭제
  const links = await userRef.collection('links').get();
  const linkBatch = firestore().batch();
  links.docs.forEach((doc) => linkBatch.delete(doc.ref));
  await linkBatch.commit();

  // 카테고리 삭제
  const categories = await userRef.collection('categories').get();
  const catBatch = firestore().batch();
  categories.docs.forEach((doc) => catBatch.delete(doc.ref));
  await catBatch.commit();

  // 사용자 문서 삭제
  await userRef.delete();

  // Firebase Auth 계정 삭제
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
