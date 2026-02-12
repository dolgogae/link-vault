import firestore from '@react-native-firebase/firestore';

export function getUserRef(userId: string) {
  return firestore().collection('users').doc(userId);
}

export function getCategoriesRef(userId: string) {
  return getUserRef(userId).collection('categories');
}

export function getLinksRef(userId: string) {
  return getUserRef(userId).collection('links');
}

export function convertTimestamp(timestamp: any): Date {
  return timestamp?.toDate?.() || new Date();
}
