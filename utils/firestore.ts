import { getFirestore, doc, collection } from '@react-native-firebase/firestore';

export function getUserRef(userId: string) {
  return doc(getFirestore(), 'users', userId);
}

export function getCategoriesRef(userId: string) {
  return collection(getFirestore(), 'users', userId, 'categories');
}

export function getLinksRef(userId: string) {
  return collection(getFirestore(), 'users', userId, 'links');
}

export function convertTimestamp(timestamp: any): Date {
  return timestamp?.toDate?.() || new Date();
}
