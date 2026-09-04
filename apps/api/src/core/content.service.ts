import { chapters, contents, sections } from "@novel-creator/db";
import { eq } from "drizzle-orm";
import { appLogger } from "../middleware/logger.js";
import { upsertEntityEmbedding } from "../rag.js";
import { insertEditHistory, purgeOldHistories } from "./history.service.js";
import { AppError, assertFound, type ServiceContext } from "./types.js";

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }
  // 日本語は文字数、それ以外は空白区切りの単語数で概算する。
  const japanese = trimmed.match(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/g);
  if (japanese && japanese.length > 0) {
    return japanese.length;
  }
  return trimmed.split(/\s+/).length;
}

export class ContentDomainService {
  constructor(private readonly ctx: ServiceContext) {}

  async getContent(sectionId: string) {
    const [row] = await this.ctx.db
      .select()
      .from(contents)
      .where(eq(contents.sectionId, sectionId));
    assertFound(row, "Content not found");
    return row;
  }

  async updateContent(
    sectionId: string,
    body: string,
    description = "手動保存",
    options: { expectedUpdatedAt?: string | Date } = {}
  ) {
    // 楽観ロック: クライアントが保持していた updatedAt と不一致なら 409 を返す。
    // expectedUpdatedAt 未指定時は従来どおり上書きする（API 互換性維持）。
    if (options.expectedUpdatedAt !== undefined) {
      const [existing] = await this.ctx.db
        .select()
        .from(contents)
        .where(eq(contents.sectionId, sectionId));
      if (existing?.updatedAt) {
        const expected = new Date(options.expectedUpdatedAt).getTime();
        const actual = new Date(existing.updatedAt).getTime();
        if (!Number.isNaN(expected) && expected !== actual) {
          throw new AppError(
            "本文が他の端末で更新されています。最新の内容を確認してから保存してください。",
            { code: "CONFLICT", status: 409 }
          );
        }
      }
    }

    const wordCount = countWords(body);
    const [row] = await this.ctx.db
      .insert(contents)
      .values({ body, sectionId, wordCount })
      .onConflictDoUpdate({
        set: { body, updatedAt: new Date(), wordCount },
        target: contents.sectionId,
      })
      .returning();

    // 履歴を記録（失敗しても本文保存自体は成功させる）
    let novelId: string | undefined;
    try {
      const [sec] = await this.ctx.db
        .select()
        .from(sections)
        .where(eq(sections.id, sectionId));
      if (sec) {
        const [ch] = await this.ctx.db
          .select()
          .from(chapters)
          .where(eq(chapters.id, sec.chapterId));
        if (ch) {
          novelId = ch.novelId;
          await insertEditHistory(this.ctx.db, {
            content: body,
            description,
            entityId: sectionId,
            entityType: "content",
            novelId: ch.novelId,
            title: sec.title || `節 ${sec.order}`,
            wordCount,
          });
          try {
            await purgeOldHistories(this.ctx.db, {
              entityId: sectionId,
              entityType: "content",
              novelId: ch.novelId,
            });
          } catch (purgeError) {
            appLogger.warn("failed to purge old content histories", {
              error:
                purgeError instanceof Error
                  ? purgeError.message
                  : String(purgeError),
              sectionId,
            });
          }
        }
      }
    } catch (e) {
      // 履歴記録の失敗は本文保存の成功に影響させないが、原因追跡のため error で残す
      appLogger.error("failed to record content history", {
        error: e instanceof Error ? e.message : String(e),
        novelId,
        sectionId,
      });
    }

    // 本文のベクトルを更新（失敗しても本文保存は成功させる）
    if (novelId) {
      try {
        await upsertEntityEmbedding(
          this.ctx.vectorStore,
          this.ctx.embedding,
          novelId,
          "content",
          sectionId,
          body,
          this.ctx.env
        );
      } catch (e) {
        appLogger.warn("failed to upsert content embedding", e);
      }
    }

    return row;
  }
}
