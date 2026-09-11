import { randomUUID } from "node:crypto";
import { characters, novels, settings } from "@novel-creator/db";
import {
  generateEmbedding,
  generateEmbeddings,
  type RetryAttemptInfo,
} from "@novel-creator/llm";
import type { VectorRecord } from "@novel-creator/vector";
import { eq } from "drizzle-orm";
import { appLogger } from "../middleware/logger.js";
import { chunkText } from "./chunking.js";
import { EmbeddingConfigDomainService } from "./embedding-config.service.js";
import { fetchNovelStructureWithContents } from "./novel-structure.js";
import type { ServiceContext } from "./types.js";

export interface ReindexProgressEvent {
  current: number;
  error?: string;
  itemTitle?: string;
  percent: number;
  stage: string;
  total: number;
}

export interface EntityToEmbed {
  content: string;
  entityId: string;
  entityType: "character" | "setting" | "content";
  id: string;
  metadata?: Record<string, unknown>;
  novelId: string;
  title: string;
}

/**
 * アクティブなベクトルストアがインデックスの初期化
 * （recreateSchema / clearAll）をサポートしていない場合に投げられるエラー。
 * サイレントスキップによる stale ベクトルの蓄積を防ぐため、明示的に失敗させる。
 */
export class VectorStoreResetError extends Error {
  constructor(
    message = "現在のベクトルストアはインデックスの初期化（recreateSchema / clearAll）をサポートしていません"
  ) {
    super(message);
    this.name = "VectorStoreResetError";
  }
}

/**
 * ベクトルインデックスの次元と要求次元が不一致の場合に投げられるエラー。
 * Vectorize は次元変更時にインデックスの作り直しが必要なため、
 * 破壊的操作（clearAll）の前に検出して再作成手順を明示する。
 */
export class VectorIndexDimensionMismatchError extends Error {
  readonly actual: number;
  readonly required: number;

  constructor(required: number, actual: number) {
    super(
      `Vectorize インデックスの次元（${actual}）が必要な次元（${required}）と一致しません。` +
        "Vectorize インデックスの作り直しが必要です。" +
        "例: npx wrangler vectorize delete <index> → " +
        `npx wrangler vectorize create <index> --dimensions ${required} --metric cosine → ` +
        "再構築を再実行"
    );
    this.name = "VectorIndexDimensionMismatchError";
    this.actual = actual;
    this.required = required;
  }
}

export interface VectorIndexStatus {
  indexDimensions: number;
  match: boolean;
  requiredDimensions: number;
}

export class ReindexDomainService {
  private readonly embeddingConfigService: EmbeddingConfigDomainService;

  constructor(private readonly ctx: ServiceContext) {
    this.embeddingConfigService = new EmbeddingConfigDomainService(ctx);
  }

  async reindexAll(
    embeddingConfigId?: string | null,
    onProgress?: (event: ReindexProgressEvent) => void
  ): Promise<{ totalIndexed: number; dimensions: number }> {
    // 1. 使用する埋め込みモデルと次元数を解決
    const { model, dimensions } =
      await this.embeddingConfigService.resolveEmbeddingModel(
        embeddingConfigId
      );

    // 1.5. インデックス次元と要求次元を照合（破壊的操作の前に検出する）
    await this.assertIndexDimensionsMatch(dimensions);

    onProgress?.({
      current: 0,
      percent: 0,
      stage: `インデックススキーマを初期化中 (次元数: ${dimensions})...`,
      total: 0,
    });

    // 2. ベクトルストアのスキーマを再作成（またはクリア）
    if (this.ctx.vectorStore.recreateSchema) {
      await this.ctx.vectorStore.recreateSchema(dimensions);
    } else if (this.ctx.vectorStore.clearAll) {
      await this.ctx.vectorStore.clearAll();
    } else {
      // クリアできないまま再構築すると stale ベクトルが蓄積するため、黙ってスキップしない。
      throw new VectorStoreResetError();
    }

    // 3. 全小説のエンティティ（人物、設定、本文）を収集
    const allNovels = await this.ctx.db.select().from(novels);
    // 章・節・本文を小説 ID 単位でバルク取得（従来の章ごと・節ごとの個別 SELECT を解消。
    // 全小説対象でも chapters / sections / contents の 3 クエリで済む）
    const structureMap = await fetchNovelStructureWithContents(
      this.ctx.db,
      allNovels.map((novel) => novel.id)
    );
    const itemsToEmbed: EntityToEmbed[] = [];

    for (const novel of allNovels) {
      // 登場人物
      const chars = await this.ctx.db
        .select()
        .from(characters)
        .where(eq(characters.novelId, novel.id));
      for (const char of chars) {
        const textParts = [
          `名前: ${char.name}`,
          char.category ? `分類: ${char.category}` : "",
          char.description ? `説明: ${char.description}` : "",
          char.traits && char.traits.length > 0
            ? `特徴: ${char.traits.join(", ")}`
            : "",
          char.relationships
            ? `関係性: ${JSON.stringify(char.relationships)}`
            : "",
        ]
          .filter(Boolean)
          .join("\n");

        itemsToEmbed.push({
          content: textParts,
          entityId: char.id,
          entityType: "character",
          id: randomUUID(),
          novelId: novel.id,
          title: `人物: ${char.name}`,
        });
      }

      // 世界観設定
      const setts = await this.ctx.db
        .select()
        .from(settings)
        .where(eq(settings.novelId, novel.id));
      for (const sett of setts) {
        const textParts = [
          `名前: ${sett.name}`,
          sett.category ? `分類: ${sett.category}` : "",
          sett.description ? `説明: ${sett.description}` : "",
          sett.metadata ? `詳細: ${JSON.stringify(sett.metadata)}` : "",
        ]
          .filter(Boolean)
          .join("\n");

        itemsToEmbed.push({
          content: textParts,
          entityId: sett.id,
          entityType: "setting",
          id: randomUUID(),
          novelId: novel.id,
          title: `設定: ${sett.name}`,
        });
      }

      // 章および節の本文（長文の場合はチャンキング）
      for (const chapterNode of structureMap.get(novel.id) ?? []) {
        for (const { section: sect, body: cntBody } of chapterNode.sections) {
          if (cntBody?.trim()) {
            const chunks = chunkText(cntBody.trim(), {
              maxChunkSize: 800,
              overlap: 100,
            });
            const totalChunks = chunks.length;
            chunks.forEach((chunk, chunkIndex) => {
              const partSuffix =
                totalChunks > 1 ? ` (${chunkIndex + 1}/${totalChunks})` : "";
              itemsToEmbed.push({
                content: chunk,
                entityId: sect.id,
                entityType: "content",
                id: randomUUID(),
                ...(totalChunks > 1
                  ? {
                      metadata: {
                        chunkIndex,
                        totalChunks,
                      },
                    }
                  : {}),
                novelId: novel.id,
                title: `本文: ${sect.title || `第${sect.order}節`}${partSuffix}`,
              });
            });
          }
        }
      }
    }

    const total = itemsToEmbed.length;
    if (total === 0) {
      onProgress?.({
        current: 0,
        percent: 100,
        stage: "対象データがありませんでした",
        total: 0,
      });
      return { dimensions, totalIndexed: 0 };
    }

    // 4. バッチサイズ（25件ずつ）で embedMany（generateEmbeddings）を一括実行 & upsertBatch
    const batchSize = 25;
    let completedCount = 0;
    let successfulCount = 0;
    let failedCount = 0;
    let lastError: Error | null = null;

    for (let i = 0; i < itemsToEmbed.length; i += batchSize) {
      const batch = itemsToEmbed.slice(i, i + batchSize);
      let vectorRecords: VectorRecord[] = [];

      // 埋め込み呼び出しの前に進捗イベントを送出する。
      // プロバイダが遅い・応答しない場合でも UI が「データをベクトル化中...」へ
      // 遷移して進捗表示が更新され、ストールに見えないようにする。
      const batchStartPercent = Math.min(
        100,
        Math.round((completedCount / total) * 100)
      );
      onProgress?.({
        current: completedCount,
        itemTitle: batch[0]?.title,
        percent: batchStartPercent,
        stage: `データをベクトル化中... (${completedCount}/${total})`,
        total,
      });

      const handleRetry = (info: RetryAttemptInfo, itemTitle?: string) => {
        const seconds = Math.ceil(info.delayMs / 1000);
        const prefix = info.isRateLimit
          ? "⏳ レート制限のため待機中..."
          : "🔄 一時エラーのため再試行中...";
        const itemInfo = itemTitle ? ` [${itemTitle}]` : "";
        onProgress?.({
          current: completedCount,
          itemTitle: itemTitle ?? batch[0]?.title,
          percent: batchStartPercent,
          stage: `${prefix}${itemInfo} (${seconds}秒後に再試行 ${info.attempt}/${info.maxRetries})`,
          total,
        });
      };

      try {
        const embeddings = await generateEmbeddings(
          model,
          batch.map((item) => item.content),
          {
            dimensions,
            onRetry: (info) => handleRetry(info),
          }
        );

        vectorRecords = batch.map((item, idx) => ({
          content: item.content,
          embedding: embeddings[idx],
          entityId: item.entityId,
          entityType: item.entityType,
          id: item.id,
          ...(item.metadata ? { metadata: item.metadata } : {}),
          novelId: item.novelId,
        }));
      } catch (batchErr) {
        lastError =
          batchErr instanceof Error ? batchErr : new Error(String(batchErr));
        appLogger.warn(
          "Batch embedding failed, falling back to individual calls:",
          batchErr
        );
        // 一括取得が失敗した場合はフォールバックとして個別実行
        for (const item of batch) {
          try {
            const vector = await generateEmbedding(model, item.content, {
              dimensions,
              onRetry: (info) => handleRetry(info, item.title),
            });
            vectorRecords.push({
              content: item.content,
              embedding: vector,
              entityId: item.entityId,
              entityType: item.entityType,
              id: item.id,
              ...(item.metadata ? { metadata: item.metadata } : {}),
              novelId: item.novelId,
            });
          } catch (e) {
            lastError = e instanceof Error ? e : new Error(String(e));
            failedCount += 1;
            appLogger.warn(`Failed to embed ${item.title}:`, e);
          }
        }
      }

      if (vectorRecords.length > 0) {
        await this.ctx.vectorStore.upsertBatch(vectorRecords);
        successfulCount += vectorRecords.length;
      }

      completedCount += batch.length;
      const percent = Math.min(100, Math.round((completedCount / total) * 100));

      onProgress?.({
        current: completedCount,
        itemTitle: batch.at(-1)?.title,
        percent,
        stage: `データをベクトル化中... (${completedCount}/${total})`,
        total,
      });
    }

    if (successfulCount === 0 && total > 0) {
      throw (
        lastError ??
        new Error(
          "ベクトルの生成に失敗しました。APIキーまたはモデル設定をご確認ください。"
        )
      );
    }

    const finalStage =
      failedCount > 0
        ? `全 ${total} 件中 ${successfulCount} 件の再構築が完了しました（${failedCount} 件失敗）`
        : `全 ${total} 件のインデックス再構築が完了しました`;

    onProgress?.({
      current: total,
      error:
        failedCount > 0
          ? `${failedCount} 件のベクトル化に失敗しました`
          : undefined,
      percent: 100,
      stage: finalStage,
      total,
    });

    return { dimensions, totalIndexed: successfulCount };
  }

  /**
   * UI の事前確認用にインデックス次元と要求次元の照合結果を返す。
   * インデックス次元を取得できない場合（0）は match: true とし、ブロックしない。
   */
  async getIndexStatus(
    embeddingConfigId?: string | null
  ): Promise<VectorIndexStatus> {
    const { dimensions } =
      await this.embeddingConfigService.resolveEmbeddingModel(
        embeddingConfigId
      );
    const indexDimensions = await this.readIndexDimensions();
    return {
      indexDimensions,
      match: indexDimensions <= 0 || indexDimensions === dimensions,
      requiredDimensions: dimensions,
    };
  }

  /**
   * ベクトルストアが次元取得をサポートし、0 より大きい値を返し、
   * 要求次元と不一致の場合に VectorIndexDimensionMismatchError を投げる。
   * pg 側の validate による明示エラーはそのまま通過させる。
   */
  private async assertIndexDimensionsMatch(
    requiredDimensions: number
  ): Promise<void> {
    const indexDimensions = await this.readIndexDimensions();
    if (indexDimensions > 0 && indexDimensions !== requiredDimensions) {
      throw new VectorIndexDimensionMismatchError(
        requiredDimensions,
        indexDimensions
      );
    }
  }

  private async readIndexDimensions(): Promise<number> {
    if (!this.ctx.vectorStore.getIndexDimensions) {
      return 0;
    }
    try {
      const dimensions = await this.ctx.vectorStore.getIndexDimensions();
      return Number.isInteger(dimensions) && dimensions > 0 ? dimensions : 0;
    } catch {
      return 0;
    }
  }
}
