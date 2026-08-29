import { randomUUID } from 'node:crypto';
import { chapters, characters, contents, novels, sections, settings } from '@novel-creator/db';
import { generateEmbedding } from '@novel-creator/llm';
import { eq } from 'drizzle-orm';
import type { VectorRecord } from '@novel-creator/vector';
import { EmbeddingConfigDomainService } from './embedding-config.service.js';
import type { ServiceContext } from './types.js';

export interface ReindexProgressEvent {
  current: number;
  total: number;
  percent: number;
  stage: string;
  itemTitle?: string;
  error?: string;
}

export interface EntityToEmbed {
  id: string;
  novelId: string;
  entityType: 'character' | 'setting' | 'content';
  entityId: string;
  content: string;
  title: string;
}

export class ReindexDomainService {
  private readonly embeddingConfigService: EmbeddingConfigDomainService;

  constructor(private readonly ctx: ServiceContext) {
    this.embeddingConfigService = new EmbeddingConfigDomainService(ctx);
  }

  async reindexAll(
    embeddingConfigId?: string | null,
    onProgress?: (event: ReindexProgressEvent) => void,
  ): Promise<{ totalIndexed: number; dimensions: number }> {
    // 1. 使用する埋め込みモデルと次元数を解決
    const { model, dimensions } =
      await this.embeddingConfigService.resolveEmbeddingModel(embeddingConfigId);

    onProgress?.({
      current: 0,
      total: 0,
      percent: 0,
      stage: `インデックススキーマを初期化中 (次元数: ${dimensions})...`,
    });

    // 2. ベクトルストアのスキーマを再作成（またはクリア）
    if (this.ctx.vectorStore.recreateSchema) {
      await this.ctx.vectorStore.recreateSchema(dimensions);
    } else if (this.ctx.vectorStore.clearAll) {
      await this.ctx.vectorStore.clearAll();
    }

    // 3. 全小説のエンティティ（人物、設定、本文）を収集
    const allNovels = await this.ctx.db.select().from(novels);
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
          char.category ? `分類: ${char.category}` : '',
          char.description ? `説明: ${char.description}` : '',
          char.traits && char.traits.length > 0 ? `特徴: ${char.traits.join(', ')}` : '',
          char.relationships ? `関係性: ${JSON.stringify(char.relationships)}` : '',
        ]
          .filter(Boolean)
          .join('\n');

        itemsToEmbed.push({
          id: randomUUID(),
          novelId: novel.id,
          entityType: 'character',
          entityId: char.id,
          content: textParts,
          title: `人物: ${char.name}`,
        });
      }

      // 世界観設定
      const setts = await this.ctx.db.select().from(settings).where(eq(settings.novelId, novel.id));
      for (const sett of setts) {
        const textParts = [
          `名前: ${sett.name}`,
          sett.category ? `分類: ${sett.category}` : '',
          sett.description ? `説明: ${sett.description}` : '',
          sett.metadata ? `詳細: ${JSON.stringify(sett.metadata)}` : '',
        ]
          .filter(Boolean)
          .join('\n');

        itemsToEmbed.push({
          id: randomUUID(),
          novelId: novel.id,
          entityType: 'setting',
          entityId: sett.id,
          content: textParts,
          title: `設定: ${sett.name}`,
        });
      }

      // 章および節の本文
      const chaps = await this.ctx.db.select().from(chapters).where(eq(chapters.novelId, novel.id));
      for (const chap of chaps) {
        const sects = await this.ctx.db
          .select()
          .from(sections)
          .where(eq(sections.chapterId, chap.id));
        for (const sect of sects) {
          const [cnt] = await this.ctx.db
            .select()
            .from(contents)
            .where(eq(contents.sectionId, sect.id));
          if (cnt && cnt.body && cnt.body.trim()) {
            itemsToEmbed.push({
              id: randomUUID(),
              novelId: novel.id,
              entityType: 'content',
              entityId: sect.id,
              content: cnt.body.trim(),
              title: `本文: ${sect.title || `第${sect.order}節`}`,
            });
          }
        }
      }
    }

    const total = itemsToEmbed.length;
    if (total === 0) {
      onProgress?.({
        current: 0,
        total: 0,
        percent: 100,
        stage: '対象データがありませんでした',
      });
      return { totalIndexed: 0, dimensions };
    }

    // 4. バッチサイズ（例: 10件ずつ）で Embedding 生成 & upsertBatch
    const batchSize = 10;
    let completedCount = 0;

    for (let i = 0; i < itemsToEmbed.length; i += batchSize) {
      const batch = itemsToEmbed.slice(i, i + batchSize);
      const vectorRecords: VectorRecord[] = [];

      await Promise.all(
        batch.map(async (item) => {
          try {
            const vector = await generateEmbedding(model, item.content);
            vectorRecords.push({
              id: item.id,
              novelId: item.novelId,
              entityType: item.entityType,
              entityId: item.entityId,
              content: item.content,
              embedding: vector,
            });
          } catch (e) {
            console.error(`[reindex] Failed to embed ${item.title}:`, e);
          }
        }),
      );

      if (vectorRecords.length > 0) {
        await this.ctx.vectorStore.upsertBatch(vectorRecords);
      }

      completedCount += batch.length;
      const percent = Math.min(100, Math.round((completedCount / total) * 100));

      onProgress?.({
        current: completedCount,
        total,
        percent,
        stage: `データをベクトル化中... (${completedCount}/${total})`,
        itemTitle: batch[batch.length - 1]?.title,
      });
    }

    onProgress?.({
      current: total,
      total,
      percent: 100,
      stage: `全 ${total} 件のインデックス再構築が完了しました`,
    });

    return { totalIndexed: total, dimensions };
  }
}
