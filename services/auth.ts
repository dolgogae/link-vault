import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { User } from '@/types';

export function initializeGoogleSignIn() {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!webClientId) {
    console.warn('[Auth] EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID가 설정되지 않았습니다.');
    return;
  }
  GoogleSignin.configure({ webClientId });
}

export async function signInWithGoogle() {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  const response = await GoogleSignin.signIn();
  const idToken = response.data?.idToken;
  if (!idToken) {
    throw new Error('Google 로그인에서 idToken을 받지 못했습니다.');
  }

  const credential = auth.GoogleAuthProvider.credential(idToken);
  const userCredential = await auth().signInWithCredential(credential);

  await createUserDocumentIfNeeded(userCredential.user, 'google');

  return userCredential;
}

export async function signInWithApple() {
  const rawNonce = generateNonce(32);
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

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

  // RN Firebase 타입에 nonce 파라미터가 누락되어 있으나 런타임에서 정상 동작
  const credential = (auth.AppleAuthProvider as any).credential(identityToken, rawNonce);

  const userCredential = await auth().signInWithCredential(credential);

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

  await createUserDocumentIfNeeded(userCredential.user, 'apple');

  return userCredential;
}

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

export async function signOut() {
  try {
    await GoogleSignin.signOut();
  } catch {
    // Google Sign-In이 아닌 경우 무시
  }

  await auth().signOut();
}

export async function deleteAccount() {
  const user = auth().currentUser;
  if (!user) throw new Error('로그인 상태가 아닙니다.');

  const userRef = firestore().collection('users').doc(user.uid);

  const links = await userRef.collection('links').get();
  const linkBatch = firestore().batch();
  links.docs.forEach((doc) => linkBatch.delete(doc.ref));
  if (!links.empty) await linkBatch.commit();

  const categories = await userRef.collection('categories').get();
  const catBatch = firestore().batch();
  categories.docs.forEach((doc) => catBatch.delete(doc.ref));
  if (!categories.empty) await catBatch.commit();

  await userRef.delete();

  await user.delete();
}

export function onAuthStateChanged(
  callback: (user: import('@react-native-firebase/auth').FirebaseAuthTypes.User | null) => void,
) {
  return auth().onAuthStateChanged(callback);
}

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
