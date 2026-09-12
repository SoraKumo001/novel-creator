import { glossaryEntries } from "@novel-creator/db";
import { eq } from "drizzle-orm";
import { appLogger } from "../middleware/logger.js";
import { upsertEntityEmbedding } from "../rag.js";
import { assertFound, type ServiceContext, ValidationError } from "./types.js";

export function glossaryToText(g: {
  term: string;
  reading?: string | null;
  category?: string;
  description?: string | null;
  aliases?: string[] | null;
}): string {
  const reading = g.reading?.trim() ? `（${g.reading.trim()}）` : "";
  const aliases =
    g.aliases && g.aliases.length > 0 ? `\n別名: ${g.aliases.join("、")}` : "";
  return `[${g.category ?? "未分類"}] ${g.term}${reading}\n${g.description ?? ""}${aliases}`;
}

export class GlossaryDomainService {
  constructor(private readonly ctx: ServiceContext) {}

  async listGlossary(novelId: string) {
    return this.ctx.db
      .select()
      .from(glossaryEntries)
      .where(eq(glossaryEntries.novelId, novelId));
  }

  async getGlossary(id: string) {
    const [row] = await this.ctx.db
      .select()
      .from(glossaryEntries)
      .where(eq(glossaryEntries.id, id));
    assertFound(row, "Glossary entry not found");
    return row;
  }

  async createGlossary(data: {
    novelId: string;
    term: string;
    reading?: string | null;
    category?: string;
    description?: string | null;
    aliases?: string[];
  }) {
    if (!data.term?.trim()) {
      throw new ValidationError("Term is required");
    }

    const [row] = await this.ctx.db
      .insert(glossaryEntries)
      .values({
        aliases: data.aliases ?? [],
        category: data.category ?? "未分類",
        description: data.description ?? null,
        novelId: data.novelId,
        reading: data.reading ?? null,
        term: data.term,
      })
      .returning();

    await upsertEntityEmbedding(
      this.ctx.vectorStore,
      this.ctx.embedding,
      row.novelId,
      "glossary",
      row.id,
      glossaryToText(row),
      this.ctx.env
    );

    return row;
  }

  async updateGlossary(
    id: string,
    data: {
      term?: string;
      reading?: string | null;
      category?: string;
      description?: string | null;
      aliases?: string[];
    }
  ) {
    const [row] = await this.ctx.db
      .update(glossaryEntries)
      .set({
        ...(data.term === undefined ? {} : { term: data.term }),
        ...(data.reading === undefined ? {} : { reading: data.reading }),
        ...(data.category === undefined ? {} : { category: data.category }),
        ...(data.description === undefined
          ? {}
          : { description: data.description }),
        ...(data.aliases === undefined ? {} : { aliases: data.aliases }),
        updatedAt: new Date(),
      })
      .where(eq(glossaryEntries.id, id))
      .returning();
    assertFound(row, "Glossary entry not found");

    await upsertEntityEmbedding(
      this.ctx.vectorStore,
      this.ctx.embedding,
      row.novelId,
      "glossary",
      row.id,
      glossaryToText(row),
      this.ctx.env
    );

    return row;
  }

  async deleteGlossary(id: string) {
    const [row] = await this.ctx.db
      .delete(glossaryEntries)
      .where(eq(glossaryEntries.id, id))
      .returning();
    assertFound(row, "Glossary entry not found");
    try {
      await this.ctx.vectorStore.deleteByEntity("glossary", id);
    } catch (err) {
      appLogger.warn("failed to delete glossary embedding", err);
    }
    return row;
  }
}
