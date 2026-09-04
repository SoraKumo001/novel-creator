import {
  chapters,
  characters,
  novelMembers,
  novels,
  settings,
} from "@novel-creator/db";
import {
  editStoryOutlineDocument,
  editStoryOutlineSection,
  generateJSON,
  generatePlotFromStoryOutline,
  generateText,
} from "@novel-creator/llm";
import { desc, eq } from "drizzle-orm";
import { searchContext } from "../rag.js";
import { insertEditHistory } from "./history.service.js";
import { resolveLLMModel } from "./model-resolver.js";
import { assertFound, type ServiceContext, ValidationError } from "./types.js";

export class NovelDomainService {
  constructor(private readonly ctx: ServiceContext) {}

  /**
   * 小説一覧。本人（members 所属）または admin のみに対象を絞り込む。
   * userId 未指定時（内部利用・後方互換）は全件を返す。
   */
  async listNovels(userId?: string, isAdmin?: boolean) {
    if (!userId || isAdmin) {
      return this.ctx.db.select().from(novels).orderBy(desc(novels.createdAt));
    }
    return this.ctx.db
      .select({
        createdAt: novels.createdAt,
        description: novels.description,
        id: novels.id,
        storyOutline: novels.storyOutline,
        styleGuide: novels.styleGuide,
        title: novels.title,
        updatedAt: novels.updatedAt,
      })
      .from(novels)
      .innerJoin(novelMembers, eq(novelMembers.novelId, novels.id))
      .where(eq(novelMembers.userId, userId))
      .orderBy(desc(novels.createdAt));
  }

  async getNovelDetail(id: string) {
    const [novel] = await this.ctx.db
      .select()
      .from(novels)
      .where(eq(novels.id, id));
    assertFound(novel, "Novel not found");

    const [chapterRows, characterRows, settingRows] = await Promise.all([
      this.ctx.db
        .select()
        .from(chapters)
        .where(eq(chapters.novelId, id))
        .orderBy(chapters.order),
      this.ctx.db.select().from(characters).where(eq(characters.novelId, id)),
      this.ctx.db.select().from(settings).where(eq(settings.novelId, id)),
    ]);

    return {
      chapters: chapterRows,
      characters: characterRows,
      novel,
      settings: settingRows,
    };
  }

  async createNovel(
    data: {
      title: string;
      description?: string | null;
      styleGuide?: string | null;
      storyOutline?: string | null;
    },
    ownerId?: string
  ) {
    if (!data.title?.trim()) {
      throw new ValidationError("Title is required");
    }
    // 作成者の owner 付与は同一トランザクションで行う。
    if (ownerId) {
      return this.ctx.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(novels)
          .values({
            description: data.description ?? null,
            storyOutline: data.storyOutline ?? null,
            styleGuide: data.styleGuide ?? null,
            title: data.title,
          })
          .returning();
        await tx.insert(novelMembers).values({
          novelId: row.id,
          role: "owner",
          userId: ownerId,
        });
        return row;
      });
    }
    const [row] = await this.ctx.db
      .insert(novels)
      .values({
        description: data.description ?? null,
        storyOutline: data.storyOutline ?? null,
        styleGuide: data.styleGuide ?? null,
        title: data.title,
      })
      .returning();
    return row;
  }

  async updateNovel(
    id: string,
    data: {
      title?: string;
      description?: string | null;
      styleGuide?: string | null;
      storyOutline?: string | null;
    }
  ) {
    const [row] = await this.ctx.db
      .update(novels)
      .set({
        ...(data.title === undefined ? {} : { title: data.title }),
        ...(data.description === undefined
          ? {}
          : { description: data.description }),
        ...(data.styleGuide === undefined
          ? {}
          : { styleGuide: data.styleGuide }),
        ...(data.storyOutline === undefined
          ? {}
          : { storyOutline: data.storyOutline }),
        updatedAt: new Date(),
      })
      .where(eq(novels.id, id))
      .returning();
    assertFound(row, "Novel not found");
    return row;
  }

  async getStoryOutline(id: string): Promise<string> {
    const [novel] = await this.ctx.db
      .select({ storyOutline: novels.storyOutline })
      .from(novels)
      .where(eq(novels.id, id));
    assertFound(novel, "Novel not found");
    return novel.storyOutline ?? "";
  }

  async saveStoryOutline(id: string, markdown: string) {
    const [novel] = await this.ctx.db
      .select()
      .from(novels)
      .where(eq(novels.id, id));
    assertFound(novel, "Novel not found");

    const previousMarkdown = novel.storyOutline ?? "";
    const [updated] = await this.ctx.db
      .update(novels)
      .set({
        storyOutline: markdown,
        updatedAt: new Date(),
      })
      .where(eq(novels.id, id))
      .returning();

    if (previousMarkdown.trim() !== markdown.trim()) {
      await insertEditHistory(this.ctx.db, {
        content: markdown,
        description: "ストーリー構想マークダウンを更新",
        entityId: id,
        entityType: "story_outline_markdown",
        novelId: id,
        title: `${novel.title} - ストーリー構想`,
        wordCount: markdown.length,
      });
    }

    return updated;
  }

  async editStoryOutlineSection(
    id: string,
    params: {
      activeSection: { category: string; name: string; content: string };
      instruction: string;
      markdown: string;
      modelConfigId?: string | null;
    }
  ): Promise<string> {
    const [novel] = await this.ctx.db
      .select()
      .from(novels)
      .where(eq(novels.id, id));
    assertFound(novel, "Novel not found");

    let contextSettings: string[] = [];
    let contextCharacters: string[] = [];
    try {
      const context = await searchContext(
        this.ctx.vectorStore,
        this.ctx.embedding,
        id,
        { query: `${params.activeSection.name} ${params.instruction}` },
        this.ctx.env
      );
      contextSettings = context.settings;
      contextCharacters = context.characters;
    } catch {
      // ベクトル検索失敗時は空コンテキストで継続
    }

    const prompt = editStoryOutlineSection(
      params.activeSection,
      params.instruction,
      {
        characters: contextCharacters,
        entireOutlinePreview: params.markdown.slice(0, 3000),
        novelTitle: novel.title,
        settings: contextSettings,
      }
    );

    const llm = await resolveLLMModel(
      this.ctx,
      params.modelConfigId,
      "useDefault"
    );
    return generateText(llm, prompt);
  }

  async editStoryOutlineDocument(
    id: string,
    params: {
      instruction: string;
      markdown: string;
      modelConfigId?: string | null;
    }
  ): Promise<string> {
    const [novel] = await this.ctx.db
      .select()
      .from(novels)
      .where(eq(novels.id, id));
    assertFound(novel, "Novel not found");

    let contextSettings: string[] = [];
    let contextCharacters: string[] = [];
    try {
      const context = await searchContext(
        this.ctx.vectorStore,
        this.ctx.embedding,
        id,
        { query: `${novel.title} ${params.instruction}` },
        this.ctx.env
      );
      contextSettings = context.settings;
      contextCharacters = context.characters;
    } catch {
      // ベクトル検索失敗時は空コンテキストで継続
    }

    const prompt = editStoryOutlineDocument(
      params.markdown,
      params.instruction,
      {
        characters: contextCharacters,
        novelTitle: novel.title,
        settings: contextSettings,
      }
    );

    const llm = await resolveLLMModel(
      this.ctx,
      params.modelConfigId,
      "useDefault"
    );
    return generateText(llm, prompt);
  }

  async generatePlotFromOutline(
    id: string,
    params: {
      storyOutline: string;
      modelConfigId?: string | null;
    }
  ) {
    const [novel] = await this.ctx.db
      .select()
      .from(novels)
      .where(eq(novels.id, id));
    assertFound(novel, "Novel not found");

    let contextSettings: string[] = [];
    let contextCharacters: string[] = [];
    try {
      const context = await searchContext(
        this.ctx.vectorStore,
        this.ctx.embedding,
        id,
        { query: `${novel.title} ${params.storyOutline.slice(0, 500)}` },
        this.ctx.env
      );
      contextSettings = context.settings;
      contextCharacters = context.characters;
    } catch {
      // ベクトル検索失敗時は空コンテキストで継続
    }

    const prompt = generatePlotFromStoryOutline({
      characters: contextCharacters,
      novelTitle: novel.title,
      settings: contextSettings,
      storyOutline: params.storyOutline,
    });

    const llm = await resolveLLMModel(
      this.ctx,
      params.modelConfigId,
      "useDefault"
    );
    return generateJSON<{
      title: string;
      description: string;
      chapters: { title: string; order: number; summary: string }[];
    }>(llm, prompt);
  }

  async deleteNovel(id: string) {
    const [row] = await this.ctx.db
      .delete(novels)
      .where(eq(novels.id, id))
      .returning();
    assertFound(row, "Novel not found");
    return row;
  }
}
