import { useState, useEffect } from 'react';
import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

/**
 * Firestore 실시간 쿼리 훅
 */
export function useFirestoreQuery<T>(
  queryFn: (() => FirebaseFirestoreTypes.Query) | null,
  deps: any[] = [],
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!queryFn) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const query = queryFn();

    const unsubscribe = query.onSnapshot(
      (snapshot) => {
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || new Date(),
          savedAt: doc.data().savedAt?.toDate?.() || new Date(),
          lastAccessedAt: doc.data().lastAccessedAt?.toDate?.() || new Date(),
        })) as T[];
        setData(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err as Error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, deps);

  return { data, loading, error };
}
