import { useState, useEffect } from 'react';
import { onSnapshot, FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { convertTimestamp } from '@/utils/firestore';

type DocData = Record<string, any>;

export function useFirestoreQuery<T>(
  queryFn: (() => FirebaseFirestoreTypes.Query<any>) | null,
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
    const q = queryFn();

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((d: { id: string; data: () => DocData }) => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            createdAt: convertTimestamp(data.createdAt),
            savedAt: convertTimestamp(data.savedAt),
            lastAccessedAt: convertTimestamp(data.lastAccessedAt),
          };
        }) as T[];
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
