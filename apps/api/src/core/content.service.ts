import { chapters, contents, sections } from "@novel-creator/db";
import { eq } from "drizzle-orm";
import { appLogger } from "../middleware/logger.js";
import { upsertEntityEmbedding } from "../rag.js";
import { insertEditHistory } from "./history.service.js";
import { assertFound, type ServiceContext } from "./types.js";

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
    description = "手動保存"
  ) {
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
        }
      }
    } catch (e) {
      appLogger.warn("failed to record content history", e);
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
