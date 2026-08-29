import { useCallback, useState } from 'react';

/**
 * 編集可能なエンティティ（人物・設定など）のリスト CRUD を管理する汎用フック。
 * 配列の保持と基本的な操作（トグル・更新・削除・追加・リセット）のみを担当し、
 * エンティティ固有のロジック（名前マッチング・traits 分割など）は呼び出し側に委ねる。
 */
export interface EditableEntity {
  _id: string;
  _selected: boolean;
}

export function useEditableEntities<T extends EditableEntity>(initial: T[] = []) {
  const [items, setItems] = useState<T[]>(initial);

  // 選択状態（_selected）を反転する。
  const toggleItem = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) => (item._id === id ? { ...item, _selected: !item._selected } : item)),
    );
  }, []);

  // 指定 id の項目へパッチをマージする。関数を渡すと現在の項目からパッチを算出できる。
  const updateItem = useCallback(
    (id: string, updater: Partial<T> | ((item: T) => Partial<T> | T)) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item._id !== id) return item;
          const patch =
            typeof updater === 'function' ? (updater as (i: T) => Partial<T> | T)(item) : updater;
          return { ...item, ...patch };
        }),
      );
    },
    [],
  );

  // 指定 id の項目を削除する。
  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item._id !== id));
  }, []);

  // 空の項目を末尾に追加する。id は idPrefix + タイムスタンプで生成する。
  const addEmptyItem = useCallback((partial: Partial<T>, idPrefix = '') => {
    setItems((prev) => [
      ...prev,
      {
        _id: `${idPrefix}${Date.now()}`,
        _selected: true,
        ...partial,
      } as T,
    ]);
  }, []);

  // 初期状態へ戻す。
  // 注意: reset は初回レンダー時の initial に戻す。initial に変更可能な非空配列を渡す場合は初期値の最新化に注意すること。
  const reset = useCallback(() => {
    setItems(initial);
  }, [initial]);

  return { items, setItems, toggleItem, updateItem, removeItem, addEmptyItem, reset };
}
