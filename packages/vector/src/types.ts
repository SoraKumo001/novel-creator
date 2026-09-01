export interface VectorRecord {
  content: string; // 元のテキスト（検索結果返却用）
  embedding: number[]; // ベクトル
  entityId: string; // 関連エンティティのID
  entityType: string; // "character" | "setting" | "section" | "content" 等
  id: string; // UUID
  metadata?: Record<string, unknown>; // 追加メタデータ
  novelId: string; // 小説ID（フィルタ用）
}

export interface VectorSearchResult {
  content: string;
  entityId: string;
  entityType: string;
  id: string;
  metadata?: Record<string, unknown>;
  score: number; // 類似度スコア
}

export interface VectorStore {
  clearAll?(): Promise<void>;
  delete(id: string): Promise<void>;
  deleteByEntity(entityType: string, entityId: string): Promise<void>;
  deleteByNovel(novelId: string): Promise<void>;
  recreateSchema?(dimensions: number): Promise<void>;
  search(
    query: number[],
    options: {
      novelId?: string;
      entityType?: string;
      topK?: number;
    }
  ): Promise<VectorSearchResult[]>;
  upsert(record: VectorRecord): Promise<void>;
  upsertBatch(records: VectorRecord[]): Promise<void>;
}
