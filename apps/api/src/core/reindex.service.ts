import { randomUUID } from "node:crypto";
import { characters, novels, settings } from "@novel-creator/db";
import { generateEmbedding, generateEmbeddings } from "@novel-creator/llm";
import type { VectorRecord } from "@novel-creator/vector";
import { eq } from "drizzle-orm";
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

    for (let i = 0; i < itemsToEmbed.length; i += batchSize) {
      const batch = itemsToEmbed.slice(i, i + batchSize);
      let vectorRecords: VectorRecord[] = [];

      try {
        const embeddings = await generateEmbeddings(
          model,
          batch.map((item) => item.content)
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
        console.warn(
          "[reindex] Batch embedding failed, falling back to individual calls:",
          batchErr
        );
        // 一括取得が失敗した場合はフォールバックとして個別実行
        for (const item of batch) {
          try {
            const vector = await generateEmbedding(model, item.content);
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
            console.error(`[reindex] Failed to embed ${item.title}:`, e);
          }
        }
      }

      if (vectorRecords.length > 0) {
        await this.ctx.vectorStore.upsertBatch(vectorRecords);
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

    onProgress?.({
      current: total,
      percent: 100,
      stage: `全 ${total} 件のインデックス再構築が完了しました`,
      total,
    });

    return { dimensions, totalIndexed: total };
  }
}
