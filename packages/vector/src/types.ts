export interface VectorRecord {
  id: string; // UUID
  novelId: string; // 小説ID（フィルタ用）
  entityType: string; // "character" | "setting" | "section" | "content" 等
  entityId: string; // 関連エンティティのID
  content: string; // 元のテキスト（検索結果返却用）
  metadata?: Record<string, unknown>; // 追加メタデータ
  embedding: number[]; // ベクトル
}

export interface VectorSearchResult {
  id: string;
  content: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  score: number; // 類似度スコア
}

export interface VectorStore {
  upsert(record: VectorRecord): Promise<void>;
  upsertBatch(records: VectorRecord[]): Promise<void>;
  search(
    query: number[],
    options: {
      novelId?: string;
      entityType?: string;
      topK?: number;
    },
  ): Promise<VectorSearchResult[]>;
  delete(id: string): Promise<void>;
  deleteByEntity(entityType: string, entityId: string): Promise<void>;
  deleteByNovel(novelId: string): Promise<void>;
  recreateSchema?(dimensions: number): Promise<void>;
  clearAll?(): Promise<void>;
}
