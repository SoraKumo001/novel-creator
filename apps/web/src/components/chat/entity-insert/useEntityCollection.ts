import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useEditableEntities, type EditableEntity } from '@/hooks/useEditableEntities.js';

/** useEntityCollection に渡すエンティティごとの設定 */
export interface UseEntityCollectionInput<TItem extends EditableEntity, TExisting> {
  /** 対象小説の既存データを取得するクエリキー（targetNovelId を含むこと） */
  queryKey: readonly unknown[];
  queryFn: () => Promise<TExisting[]>;
  /** モーダルが開いている & 登録先小説が選択されている間のみ取得する */
  enabled: boolean;
  /** 抽出アイテムを既存データと突き合わせて matchedExisting / action を最新化する純関数 */
  reconcile: (item: TItem, existing: readonly TExisting[]) => TItem;
}

/** useEntityCollection の戻り値（コレクション層の公開 API） */
export type EntityCollection<TItem extends EditableEntity, TExisting> = ReturnType<
  typeof useEntityCollection<TItem, TExisting>
>;

/**
 * チャット反映モーダルのエンティティコレクション層。
 * 5エンティティ（人物・設定・伏線・年表・章）で同型だった
 * 「既存データの取得とローカル反映（state + ref）」と
 * 「抽出アイテムの CRUD（useEditableEntities）」をまとめる。
 *
 * 保存・マージ・正規化などエンティティ固有の差分（timeline の merge なし、
 * character の traitsString 二重管理、plot の summary マージなど）は
 * 呼び出し側の小関数に委ねる。useEditableEntities を内包するラッパーであり、
 * CRUD の再実装はしない。
 */
export function useEntityCollection<TItem extends EditableEntity, TExisting>({
  queryKey,
  queryFn,
  enabled,
  reconcile,
}: UseEntityCollectionInput<TItem, TExisting>) {
  // モーダルフッターの「登録済み: ...」表示用。
  // 非同期抽出や更新ハンドラからは existingRef 経由で即座に参照する。
  const [existing, setExisting] = useState<TExisting[]>([]);
  const existingRef = useRef<TExisting[]>([]);

  const { items, setItems, toggleItem, updateItem, removeItem, addEmptyItem } =
    useEditableEntities<TItem>([]);

  const query = useQuery({ queryKey, queryFn, enabled });

  // 取得データをローカル state / ref へ反映し、
  // 既存データに基づいて抽出済みアイテムのマッチングを更新する（重複時はデフォルト上書き更新）
  useEffect(() => {
    if (!enabled) {
      setExisting([]);
      existingRef.current = [];
      return;
    }
    if (query.isLoading) return;

    const rows = query.data ?? [];
    setExisting(rows);
    existingRef.current = rows;
    setItems((prev) => prev.map((item) => reconcile(item, rows)));
  }, [enabled, query.isLoading, query.data, reconcile, setItems]);

  /** 最新の既存データと突き合わせる（ref 経由のため非同期処理内からも使用できる） */
  const reconcileWithExisting = useCallback(
    (item: TItem): TItem => reconcile(item, existingRef.current),
    [reconcile],
  );

  return {
    items,
    setItems,
    toggleItem,
    updateItem,
    removeItem,
    addEmptyItem,
    existing,
    existingRef,
    loading: query.isLoading,
    reconcileWithExisting,
  };
}
