import { useState, useEffect } from 'react';
import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { convertTimestamp } from '@/utils/firestore';

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
          createdAt: convertTimestamp(doc.data().createdAt),
          savedAt: convertTimestamp(doc.data().savedAt),
          lastAccessedAt: convertTimestamp(doc.data().lastAccessedAt),
        })) as T[];
        setData(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[useFirestoreQuery] onSnapshot error:', err);
        setError(err as Error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, deps);

  return { data, loading, error };
}
