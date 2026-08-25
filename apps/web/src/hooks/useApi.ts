import { useCallback, useState } from 'react';

// fetch ヘルパーフック（プレースホルダ）。
// Phase 4 で実際のデータ取得・キャッシュ・エラーハンドリングを実装する。
export function useApi<T>(fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  return { data, error, loading, run };
}
