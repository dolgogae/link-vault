import {
  getAuth,
  signInWithCredential,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  GoogleAuthProvider,
  AppleAuthProvider,
  FirebaseAuthTypes,
} from '@react-native-firebase/auth';
import {
  getFirestore,
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
} from '@react-native-firebase/firestore';
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

  const credential = GoogleAuthProvider.credential(idToken);
  const userCredential = await signInWithCredential(getAuth(), credential);

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

  const credential = (AppleAuthProvider as any).credential(identityToken, rawNonce);
  const userCredential = await signInWithCredential(getAuth(), credential);

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

export async function signUpWithEmail(email: string, password: string, displayName: string) {
  const userCredential = await createUserWithEmailAndPassword(getAuth(), email, password);
  await userCredential.user.updateProfile({ displayName });
  await createUserDocumentIfNeeded(userCredential.user, 'email', displayName);
  return userCredential;
}

export async function signInWithEmail(email: string, password: string) {
  return await signInWithEmailAndPassword(getAuth(), email, password);
}

async function createUserDocumentIfNeeded(
  user: { uid: string; displayName: string | null; email: string | null },
  provider: User['provider'],
  displayNameOverride?: string,
) {
  const db = getFirestore();
  const userRef = doc(db, 'users', user.uid);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists) {
    const userData: User = {
      displayName: displayNameOverride || user.displayName || '사용자',
      email: user.email || '',
      provider,
      createdAt: new Date(),
      linkCount: 0,
      plan: 'free',
    };
    await setDoc(userRef, userData);
  }
}

export async function signOut() {
  try {
    await GoogleSignin.signOut();
  } catch {
    // Google Sign-In이 아닌 경우 무시
  }

  await firebaseSignOut(getAuth());
}

export async function deleteAccount() {
  const user = getAuth().currentUser;
  if (!user) throw new Error('로그인 상태가 아닙니다.');

  const db = getFirestore();
  const userRef = doc(db, 'users', user.uid);

  const links = await getDocs(collection(db, 'users', user.uid, 'links'));
  const linkBatch = writeBatch(db);
  for (const linkDoc of links.docs) linkBatch.delete(linkDoc.ref);
  if (!links.empty) await linkBatch.commit();

  const categories = await getDocs(collection(db, 'users', user.uid, 'categories'));
  const catBatch = writeBatch(db);
  for (const catDoc of categories.docs) catBatch.delete(catDoc.ref);
  if (!categories.empty) await catBatch.commit();

  await deleteDoc(userRef);

  await user.delete();
}

export function onAuthStateChanged(
  callback: (user: FirebaseAuthTypes.User | null) => void,
) {
  return firebaseOnAuthStateChanged(getAuth(), callback);
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
