import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { DomainServices } from "../core/services.js";
import {
  NotFoundError,
  type ServiceContext,
  ValidationError,
} from "../core/types.js";
import { appLogger } from "../middleware/logger.js";
import { searchContext } from "../rag.js";
import {
  assertChapterScope,
  assertCharacterScope,
  assertForeshadowingScope,
  assertHistoryScope,
  assertNovelScope,
  assertSectionScope,
  assertSettingScope,
} from "./scope-guard.js";
import { assertSectionBelongsToNovel } from "./section-guard.js";
import { batchMax20 } from "./validation.js";

/**
 * MCP ツール群を McpServer インスタンスへ登録する。
 * novelId を受け取る入口では先にスコープガードを適用する。
 */
export function registerMcpTools(
  server: McpServer,
  services: DomainServices,
  ctx: ServiceContext
): void {
  const auth = ctx.mcpAuth;
  // ==========================================
  // 1. 小説管理 (Novels)
  // ==========================================

  server.tool("list_novels", "小説一覧を取得します。", {}, async () => {
    try {
      const novels = await services.novel.listNovels();
      if (auth?.novelId) {
        const scoped = novels.filter((n) => n.id === auth.novelId);
        return {
          content: [{ type: "text", text: JSON.stringify(scoped, null, 2) }],
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(novels, null, 2) }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `小説一覧の取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  });

  server.tool(
    "get_novel",
    "指定された小説の詳細情報（タイトル、概要、あらすじ、執筆方針、章一覧、登場人物、設定サマリ）を取得します。",
    {
      novelId: z.string().describe("小説ID (UUID)"),
    },
    async ({ novelId }) => {
      try {
        assertNovelScope(auth, novelId);
        const detail = await services.novel.getNovelDetail(novelId);
        return {
          content: [{ type: "text", text: JSON.stringify(detail, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `小説詳細の取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "create_novel",
    "新規小説を作成します。",
    {
      description: z.string().optional().describe("小説の概要・ログライン"),
      storyOutline: z
        .string()
        .optional()
        .describe("全体のストーリーあらすじ・大まかな展開"),
      styleGuide: z
        .string()
        .optional()
        .describe("執筆方針・文体ルール・ターゲット読者層"),
      title: z.string().describe("小説タイトル"),
    },
    async ({ title, description, styleGuide, storyOutline }) => {
      try {
        if (auth?.novelId) {
          throw new ValidationError("Scoped MCP key cannot create novels");
        }
        const novel = await services.novel.createNovel({
          description,
          storyOutline,
          styleGuide,
          title,
        });
        return {
          content: [
            {
              type: "text",
              text: `小説を作成しました:\n${JSON.stringify(novel, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `小説の作成に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "update_novel",
    "小説のタイトル、概要、あらすじ、執筆方針などを更新します。",
    {
      description: z.string().optional().describe("小説の概要・ログライン"),
      novelId: z.string().describe("小説ID (UUID)"),
      storyOutline: z
        .string()
        .optional()
        .describe("全体のストーリーあらすじ・大まかな展開"),
      styleGuide: z
        .string()
        .optional()
        .describe("執筆方針・文体ルール・ターゲット読者層"),
      title: z.string().optional().describe("小説タイトル"),
    },
    async ({ novelId, title, description, styleGuide, storyOutline }) => {
      try {
        assertNovelScope(auth, novelId);
        const updated = await services.novel.updateNovel(novelId, {
          description,
          storyOutline,
          styleGuide,
          title,
        });
        return {
          content: [
            {
              type: "text",
              text: `小説を更新しました:\n${JSON.stringify(updated, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `小説の更新に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "delete_novel",
    "小説を削除します。関連するすべての章、節、本文、登場人物、設定もカスケード削除されます。",
    {
      novelId: z.string().describe("削除対象の小説ID (UUID)"),
    },
    async ({ novelId }) => {
      try {
        assertNovelScope(auth, novelId);
        await services.novel.deleteNovel(novelId);
        return {
          content: [
            {
              type: "text",
              text: `小説 (ID: ${novelId}) を正常に削除しました。`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `小説の削除に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ==========================================
  // 2. プロット・構成管理 (Chapters & Sections)
  // ==========================================

  server.tool(
    "get_plot_outline",
    "小説の全章および全節（シーン）の一覧と概要を取得します。format='markdown' を指定するとパース用Markdownテキストとして取得できます。",
    {
      format: z
        .enum(["json", "markdown"])
        .optional()
        .default("json")
        .describe("出力形式 (json または markdown)"),
      novelId: z.string().describe("小説ID (UUID)"),
    },
    async ({ novelId, format }) => {
      try {
        assertNovelScope(auth, novelId);
        if (format === "markdown") {
          const markdown = await services.chapter.getMarkdown(novelId);
          return {
            content: [{ type: "text", text: markdown }],
          };
        }
        const chaptersWithSections =
          await services.chapter.listChaptersWithSections(novelId);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(chaptersWithSections, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `プロット構成の取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "save_plot_outline_markdown",
    "プロット全体のMarkdownを一括解析し、既存の章・節との差分を検出して自動更新・作成・削除を行います。大規模修正時は個別CRUD連打より本ツールを優先。plotは <!-- chapterId/sectionId --> を保持すること。",
    {
      markdown: z
        .string()
        .describe(
          "プロットMarkdown（# 章タイトル \\n 章概要 \\n ## 節タイトル \\n 節概要 の構造）"
        ),
      novelId: z.string().describe("小説ID (UUID)"),
    },
    async ({ novelId, markdown }) => {
      try {
        assertNovelScope(auth, novelId);
        const result = await services.chapter.saveMarkdown(novelId, markdown);
        return {
          content: [
            {
              type: "text",
              text: `プロット構成をMarkdownから同期しました:\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `プロットMarkdownの反映に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "create_chapter",
    "小説に新しい章を追加します。大規模修正（3件以上/全体再構成）は get_*/save_*_markdown を優先。",
    {
      novelId: z.string().describe("小説ID (UUID)"),
      order: z.number().optional().describe("章の並び順番号（省略時は末尾）"),
      summary: z.string().optional().describe("章の概要・プロット"),
      title: z.string().describe("章のタイトル"),
    },
    async ({ novelId, title, order, summary }) => {
      try {
        assertNovelScope(auth, novelId);
        const chapter = await services.chapter.createChapter({
          novelId,
          order,
          summary,
          title,
        });
        return {
          content: [
            {
              type: "text",
              text: `章を作成しました:\n${JSON.stringify(chapter, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `章の作成に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "update_chapter",
    "指定された章のタイトル、概要、並び順を更新します。大規模修正（3件以上/全体再構成）は get_*/save_*_markdown を優先。",
    {
      chapterId: z.string().describe("章ID (UUID)"),
      order: z.number().optional().describe("章の並び順番号"),
      summary: z.string().optional().describe("章の概要"),
      title: z.string().optional().describe("章のタイトル"),
    },
    async ({ chapterId, title, order, summary }) => {
      try {
        await assertChapterScope(services, auth, chapterId);
        const chapter = await services.chapter.updateChapter(chapterId, {
          order,
          summary,
          title,
        });
        return {
          content: [
            {
              type: "text",
              text: `章を更新しました:\n${JSON.stringify(chapter, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `章の更新に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "delete_chapter",
    "章を削除します。含まれる節および本文もカスケード削除されます。",
    {
      chapterId: z.string().describe("章ID (UUID)"),
    },
    async ({ chapterId }) => {
      try {
        await assertChapterScope(services, auth, chapterId);
        await services.chapter.deleteChapter(chapterId);
        return {
          content: [
            { type: "text", text: `章 (ID: ${chapterId}) を削除しました。` },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `章の削除に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "create_section",
    "指定した章の中に新しい節（シーン）を追加します。大規模修正（3件以上/全体再構成）は get_*/save_*_markdown を優先。",
    {
      chapterId: z.string().describe("親章のID (UUID)"),
      order: z.number().optional().describe("節の並び順番号（省略時は末尾）"),
      summary: z.string().optional().describe("節の概要・あらすじ・出来事"),
      title: z.string().optional().describe("節のタイトル"),
    },
    async ({ chapterId, title, order, summary }) => {
      try {
        await assertChapterScope(services, auth, chapterId);
        const section = await services.section.createSection({
          chapterId,
          order,
          summary,
          title,
        });
        return {
          content: [
            {
              type: "text",
              text: `節を作成しました:\n${JSON.stringify(section, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `節の作成に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "update_section",
    "節のタイトル、概要、並び順を更新します。大規模修正（3件以上/全体再構成）は get_*/save_*_markdown を優先。",
    {
      order: z.number().optional().describe("節の並び順番号"),
      sectionId: z.string().describe("節ID (UUID)"),
      summary: z.string().optional().describe("節の概要・出来事"),
      title: z.string().optional().describe("節のタイトル"),
    },
    async ({ sectionId, title, order, summary }) => {
      try {
        await assertSectionScope(services, auth, sectionId);
        const section = await services.section.updateSection(sectionId, {
          order,
          summary,
          title,
        });
        return {
          content: [
            {
              type: "text",
              text: `節を更新しました:\n${JSON.stringify(section, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `節の更新に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "delete_section",
    "節を削除します。本文も削除されます。",
    {
      sectionId: z.string().describe("節ID (UUID)"),
    },
    async ({ sectionId }) => {
      try {
        await assertSectionScope(services, auth, sectionId);
        await services.section.deleteSection(sectionId);
        return {
          content: [
            { type: "text", text: `節 (ID: ${sectionId}) を削除しました。` },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `節の削除に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ==========================================
  // 3. 本文執筆・取得 (Contents)
  // ==========================================

  server.tool(
    "get_section_content",
    "指定された節の本文、文字数、節情報、最終更新日時を取得します。",
    {
      sectionId: z.string().describe("節ID (UUID)"),
    },
    async ({ sectionId }) => {
      try {
        await assertSectionScope(services, auth, sectionId);
        const sectionWithContent =
          await services.section.getSectionWithContent(sectionId);
        return {
          content: [
            { type: "text", text: JSON.stringify(sectionWithContent, null, 2) },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `節本文の取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "save_section_content",
    "指定された節の本文を保存・更新します。自動で文字数が集計され、編集履歴の保存とVectorDBへのEmbedding更新が行われます。",
    {
      body: z.string().describe("保存する小説本文テキスト"),
      description: z
        .string()
        .optional()
        .default("MCP外部LLMによる執筆・更新")
        .describe("変更理由や履歴の説明"),
      sectionId: z.string().describe("節ID (UUID)"),
    },
    async ({ sectionId, body, description }) => {
      try {
        await assertSectionScope(services, auth, sectionId);
        const updated = await services.content.updateContent(
          sectionId,
          body,
          description
        );
        return {
          content: [
            {
              type: "text",
              text: `節本文を保存しました:\n文字数: ${updated.wordCount}\n更新日時: ${updated.updatedAt?.toISOString() ?? "now"}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `節本文の保存に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ==========================================
  // 4. 登場人物管理 (Characters)
  // ==========================================

  server.tool(
    "list_characters",
    "小説の登場人物一覧を取得します。カテゴリやキーワードで絞り込み可能です。",
    {
      category: z
        .string()
        .optional()
        .describe("役割カテゴリ（例: 主要人物, 敵役, サブキャラクター等）"),
      name: z.string().optional().describe("名前またはキーワード（部分一致）"),
      novelId: z.string().describe("小説ID (UUID)"),
    },
    async ({ novelId, category, name }) => {
      try {
        assertNovelScope(auth, novelId);
        let list = await services.character.listCharacters(novelId);
        if (category) {
          list = list.filter((c) => c.category === category);
        }
        if (name) {
          const q = name.toLowerCase();
          list = list.filter(
            (c) =>
              c.name.toLowerCase().includes(q) ||
              c.description?.toLowerCase().includes(q)
          );
        }
        return {
          content: [{ type: "text", text: JSON.stringify(list, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `登場人物一覧の取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "get_character",
    "特定の登場人物の詳細情報を取得します。",
    {
      characterId: z.string().describe("登場人物ID (UUID)"),
    },
    async ({ characterId }) => {
      try {
        await assertCharacterScope(services, auth, characterId);
        const character = await services.character.getCharacter(characterId);
        return {
          content: [{ type: "text", text: JSON.stringify(character, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `登場人物の取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "create_character",
    "新しい登場人物を登録します。自動でVectorDBへのEmbedding登録が行われます。大規模修正（3件以上/全体再構成）は get_*/save_*_markdown を優先。",
    {
      category: z
        .string()
        .default("未分類")
        .describe("役割カテゴリ（例: 主人公, ヒロイン, 敵役, 師匠 等）"),
      description: z
        .string()
        .optional()
        .describe("外見、性格、背景、動機、口調などの詳細説明"),
      name: z.string().describe("登場人物名"),
      novelId: z.string().describe("小説ID (UUID)"),
      traits: z
        .array(z.string())
        .optional()
        .default([])
        .describe('特徴タグの配列（例: ["冷静沈着", "銀髪", "剣士"]）'),
    },
    async ({ novelId, name, category, description, traits }) => {
      try {
        assertNovelScope(auth, novelId);
        const character = await services.character.createCharacter({
          category,
          description,
          name,
          novelId,
          traits,
        });
        return {
          content: [
            {
              type: "text",
              text: `登場人物を作成しました:\n${JSON.stringify(character, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `登場人物の作成に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "update_character",
    "登場人物の情報を更新します。VectorDBのEmbeddingも自動更新されます。大規模修正（3件以上/全体再構成）は get_*/save_*_markdown を優先。",
    {
      category: z.string().optional().describe("役割カテゴリ"),
      characterId: z.string().describe("登場人物ID (UUID)"),
      description: z.string().optional().describe("詳細説明"),
      name: z.string().optional().describe("登場人物名"),
      traits: z.array(z.string()).optional().describe("特徴タグの配列"),
    },
    async ({ characterId, name, category, description, traits }) => {
      try {
        await assertCharacterScope(services, auth, characterId);
        const updated = await services.character.updateCharacter(characterId, {
          category,
          description,
          name,
          traits,
        });
        return {
          content: [
            {
              type: "text",
              text: `登場人物を更新しました:\n${JSON.stringify(updated, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `登場人物の更新に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "delete_character",
    "登場人物を削除します。VectorDBのEmbeddingも自動削除されます。",
    {
      characterId: z.string().describe("登場人物ID (UUID)"),
    },
    async ({ characterId }) => {
      try {
        await assertCharacterScope(services, auth, characterId);
        await services.character.deleteCharacter(characterId);
        return {
          content: [
            {
              type: "text",
              text: `登場人物 (ID: ${characterId}) を削除しました。`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `登場人物の削除に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "save_characters_markdown",
    "登場人物全体のMarkdownテキストを一括解析し、既存の登場人物リストと同期・更新します。大規模修正時は個別CRUD連打より本ツールを優先。",
    {
      markdown: z.string().describe("登場人物Markdownテキスト"),
      novelId: z.string().describe("小説ID (UUID)"),
    },
    async ({ novelId, markdown }) => {
      try {
        assertNovelScope(auth, novelId);
        const result = await services.character.saveMarkdown(novelId, markdown);
        return {
          content: [
            {
              type: "text",
              text: `登場人物Markdownを同期しました:\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `登場人物Markdownの同期に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ==========================================
  // 5. 世界観・設定管理 (Settings)
  // ==========================================

  server.tool(
    "list_settings",
    "小説の世界観・設定一覧を取得します。カテゴリやキーワードで絞り込み可能です。",
    {
      category: z
        .string()
        .optional()
        .describe(
          "カテゴリ（例: 世界観, 魔法・能力, 地理・国家, 歴史・事件, アイテム等）"
        ),
      name: z
        .string()
        .optional()
        .describe("設定名またはキーワード（部分一致）"),
      novelId: z.string().describe("小説ID (UUID)"),
    },
    async ({ novelId, category, name }) => {
      try {
        assertNovelScope(auth, novelId);
        let list = await services.setting.listSettings(novelId, category);
        if (name) {
          const q = name.toLowerCase();
          list = list.filter(
            (s) =>
              s.name.toLowerCase().includes(q) ||
              s.description?.toLowerCase().includes(q)
          );
        }
        return {
          content: [{ type: "text", text: JSON.stringify(list, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `設定一覧の取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "get_setting",
    "特定の設定の詳細情報を取得します。",
    {
      settingId: z.string().describe("設定ID (UUID)"),
    },
    async ({ settingId }) => {
      try {
        await assertSettingScope(services, auth, settingId);
        const setting = await services.setting.getSetting(settingId);
        return {
          content: [{ type: "text", text: JSON.stringify(setting, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `設定詳細の取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "create_setting",
    "新しい世界観・設定を登録します。VectorDBへのEmbedding登録が自動で行われます。大規模修正（3件以上/全体再構成）は get_*/save_*_markdown を優先。",
    {
      category: z
        .string()
        .describe(
          "カテゴリ（例: 世界観, 魔法体系, 地理, 組織・国家, 歴史, ルール・法則 等）"
        ),
      description: z
        .string()
        .optional()
        .describe("設定の詳細説明、作中ルール、制約条件"),
      name: z.string().describe("設定名"),
      novelId: z.string().describe("小説ID (UUID)"),
    },
    async ({ novelId, category, name, description }) => {
      try {
        assertNovelScope(auth, novelId);
        const setting = await services.setting.createSetting({
          category,
          description,
          name,
          novelId,
        });
        return {
          content: [
            {
              type: "text",
              text: `設定を作成しました:\n${JSON.stringify(setting, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `設定の作成に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "update_setting",
    "設定の情報を更新します。VectorDBのEmbeddingも自動更新されます。大規模修正（3件以上/全体再構成）は get_*/save_*_markdown を優先。",
    {
      category: z.string().optional().describe("カテゴリ"),
      description: z.string().optional().describe("詳細説明"),
      name: z.string().optional().describe("設定名"),
      settingId: z.string().describe("設定ID (UUID)"),
    },
    async ({ settingId, category, name, description }) => {
      try {
        await assertSettingScope(services, auth, settingId);
        const updated = await services.setting.updateSetting(settingId, {
          category,
          description,
          name,
        });
        return {
          content: [
            {
              type: "text",
              text: `設定を更新しました:\n${JSON.stringify(updated, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `設定の更新に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "delete_setting",
    "設定を削除します。VectorDBのEmbeddingも自動削除されます。",
    {
      settingId: z.string().describe("設定ID (UUID)"),
    },
    async ({ settingId }) => {
      try {
        await assertSettingScope(services, auth, settingId);
        await services.setting.deleteSetting(settingId);
        return {
          content: [
            { type: "text", text: `設定 (ID: ${settingId}) を削除しました。` },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `設定の削除に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "save_settings_markdown",
    "設定全体のMarkdownテキストを一括解析し、既存の設定リストと同期・更新します。大規模修正時は個別CRUD連打より本ツールを優先。",
    {
      markdown: z.string().describe("設定Markdownテキスト"),
      novelId: z.string().describe("小説ID (UUID)"),
    },
    async ({ novelId, markdown }) => {
      try {
        assertNovelScope(auth, novelId);
        const result = await services.setting.saveMarkdown(novelId, markdown);
        return {
          content: [
            {
              type: "text",
              text: `設定Markdownを同期しました:\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `設定Markdownの同期に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ==========================================
  // 6. 伏線管理 (Foreshadowings)
  // ==========================================

  server.tool(
    "list_foreshadowings",
    "小説に登録されている伏線一覧を取得します。ステータス（未回収/回収済/破棄）での絞り込みが可能です。",
    {
      novelId: z.string().describe("小説ID (UUID)"),
      status: z
        .enum(["unresolved", "resolved", "abandoned"])
        .optional()
        .describe(
          "ステータス絞り込み（unresolved: 未回収, resolved: 回収済, abandoned: 破棄）"
        ),
    },
    async ({ novelId, status }) => {
      try {
        assertNovelScope(auth, novelId);
        let list =
          await services.foreshadowing.getForeshadowingsByNovel(novelId);
        if (status) {
          list = list.filter((f) => f.status === status);
        }
        return {
          content: [{ type: "text", text: JSON.stringify(list, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `伏線一覧の取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "create_foreshadowing",
    "新しい伏線を登録します。大規模修正（3件以上/全体再構成）は get_*/save_*_markdown を優先。",
    {
      category: z
        .string()
        .optional()
        .default("伏線")
        .describe("伏線のカテゴリ"),
      description: z
        .string()
        .optional()
        .describe("伏線の詳細、真相、回収アイデア"),
      novelId: z.string().describe("小説ID (UUID)"),
      plantSectionId: z.string().optional().describe("設置（初出）した節ID"),
      status: z
        .enum(["unresolved", "resolved", "abandoned"])
        .optional()
        .default("unresolved"),
      title: z.string().describe("伏線のタイトル・概要"),
    },
    async ({
      novelId,
      title,
      category,
      description,
      status,
      plantSectionId,
    }) => {
      try {
        assertNovelScope(auth, novelId);
        if (plantSectionId) {
          await assertSectionScope(services, auth, plantSectionId);
        }
        const item = await services.foreshadowing.createForeshadowing(novelId, {
          category,
          description,
          placedSectionId: plantSectionId || null,
          resolvedSectionId: null,
          status,
          title,
        });
        return {
          content: [
            {
              type: "text",
              text: `伏線を登録しました:\n${JSON.stringify(item, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `伏線の登録に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "update_foreshadowing",
    "伏線のステータスや回収節、詳細説明を更新します。大規模修正（3件以上/全体再構成）は get_*/save_*_markdown を優先。",
    {
      description: z.string().optional().describe("詳細説明"),
      foreshadowingId: z.string().describe("伏線ID (UUID)"),
      resolveSectionId: z
        .string()
        .optional()
        .nullable()
        .describe("回収された節ID"),
      status: z
        .enum(["unresolved", "resolved", "abandoned"])
        .optional()
        .describe(
          "ステータス（resolved: 回収済, unresolved: 未回収, abandoned: 破棄）"
        ),
      title: z.string().optional().describe("タイトル"),
    },
    async ({
      foreshadowingId,
      title,
      description,
      status,
      resolveSectionId,
    }) => {
      try {
        await assertForeshadowingScope(services, auth, foreshadowingId);
        if (resolveSectionId) {
          await assertSectionScope(services, auth, resolveSectionId);
        }
        const updated = await services.foreshadowing.updateForeshadowing(
          foreshadowingId,
          {
            description,
            resolvedSectionId: resolveSectionId,
            status,
            title,
          }
        );
        return {
          content: [
            {
              type: "text",
              text: `伏線を更新しました:\n${JSON.stringify(updated, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `伏線の更新に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "delete_foreshadowing",
    "伏線を削除します。",
    {
      foreshadowingId: z.string().describe("伏線ID (UUID)"),
    },
    async ({ foreshadowingId }) => {
      try {
        await assertForeshadowingScope(services, auth, foreshadowingId);
        await services.foreshadowing.deleteForeshadowing(foreshadowingId);
        return {
          content: [
            {
              type: "text",
              text: `伏線 (ID: ${foreshadowingId}) を削除しました。`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `伏線の削除に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ==========================================
  // 7. 年表・タイムライン管理 (Timelines)
  // ==========================================

  server.tool(
    "list_timelines",
    "小説の作中時系列イベント一覧を取得します。",
    {
      novelId: z.string().describe("小説ID (UUID)"),
    },
    async ({ novelId }) => {
      try {
        assertNovelScope(auth, novelId);
        const list = await services.timeline.listTimelines(novelId);
        return {
          content: [{ type: "text", text: JSON.stringify(list, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `タイムライン一覧の取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "create_timeline_event",
    "新しいタイムラインイベントを追加します。大規模修正（3件以上/全体再構成）は get_*/save_*_markdown を優先。",
    {
      event: z.string().describe("出来事の内容"),
      novelId: z.string().describe("小説ID (UUID)"),
      order: z.number().optional().describe("時系列の順序番号"),
      sectionId: z.string().optional().describe("紐付ける節ID"),
      timestamp: z
        .string()
        .optional()
        .describe("作中時期（例: 帝都暦742年、物語開始3年前 等）"),
    },
    async ({ novelId, event, timestamp, order, sectionId }) => {
      try {
        assertNovelScope(auth, novelId);
        if (sectionId) {
          await assertSectionScope(services, auth, sectionId);
        }
        const item = await services.timeline.createTimeline({
          event,
          novelId,
          order,
          sectionId,
          timestamp,
        });
        return {
          content: [
            {
              type: "text",
              text: `タイムラインイベントを作成しました:\n${JSON.stringify(item, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `タイムラインイベントの作成に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "update_timeline_event",
    "タイムラインイベントを更新します。大規模修正（3件以上/全体再構成）は get_*/save_*_markdown を優先。",
    {
      event: z.string().optional().describe("出来事の内容"),
      order: z.number().optional().describe("時系列の順序番号"),
      sectionId: z.string().optional().nullable().describe("紐付ける節ID"),
      timelineId: z.string().describe("タイムラインID (UUID)"),
      timestamp: z.string().optional().describe("作中時期"),
    },
    async ({ timelineId, event, timestamp, order, sectionId }) => {
      try {
        const updated = await services.timeline.updateTimeline(timelineId, {
          event,
          order,
          sectionId,
          timestamp,
        });
        return {
          content: [
            {
              type: "text",
              text: `タイムラインイベントを更新しました:\n${JSON.stringify(updated, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `タイムラインイベントの更新に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "delete_timeline_event",
    "タイムラインイベントを削除します。",
    {
      timelineId: z.string().describe("タイムラインID (UUID)"),
    },
    async ({ timelineId }) => {
      try {
        await services.timeline.deleteTimeline(timelineId);
        return {
          content: [
            {
              type: "text",
              text: `タイムラインイベント (ID: ${timelineId}) を削除しました。`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `タイムラインイベントの削除に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ==========================================
  // 8. 知識検索・整合性照合 (RAG & Search)
  // ==========================================

  server.tool(
    "search_novel_knowledge",
    "小説内の設定、登場人物、本文、タイムラインなどの知識からセマンティック類似検索を行い、関連情報を取得します。",
    {
      novelId: z.string().describe("小説ID (UUID)"),
      query: z.string().describe("検索クエリ・質問文・確認したい事柄"),
      topK: z.number().optional().default(5).describe("取得件数 (1〜20)"),
    },
    async ({ novelId, query, topK }) => {
      try {
        assertNovelScope(auth, novelId);
        const results = await searchContext(
          ctx.vectorStore,
          ctx.embedding,
          novelId,
          { query, topK },
          ctx.env
        );
        return {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
        };
      } catch (error) {
        appLogger.warn("[MCP] search_novel_knowledge failed", error);
        return {
          content: [
            {
              type: "text",
              text: `知識検索に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ==========================================
  // 9. 読取専用: 章・節の単体取得 / 履歴参照
  // ==========================================

  server.tool(
    "get_chapter",
    "指定した章1件のタイトル・概要と配下の節メタ情報（タイトル・概要・順序）を取得します。本文は含みません。全章の一覧が必要な場合は get_plot_outline を使ってください。",
    {
      chapterId: z.string().describe("章ID (UUID)"),
    },
    async ({ chapterId }) => {
      try {
        await assertChapterScope(services, auth, chapterId);
        const result = await services.chapter.getChapterWithSections(chapterId);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `章の取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "get_section",
    "指定した節1件のメタ情報（タイトル・概要・順序・所属章ID）を取得します。本文は含みません。本文が必要な場合は get_section_content を使ってください。",
    {
      novelId: z
        .string()
        .optional()
        .describe("小説ID (UUID、指定時は所属検証に使用)"),
      sectionId: z.string().describe("節ID (UUID)"),
    },
    async ({ sectionId, novelId }) => {
      try {
        if (novelId) {
          const guarded = await assertSectionBelongsToNovel(
            services,
            novelId,
            sectionId,
            auth
          );
          return {
            content: [
              { type: "text", text: JSON.stringify(guarded.section, null, 2) },
            ],
          };
        }
        await assertSectionScope(services, auth, sectionId);
        const { section } =
          await services.section.getSectionWithContent(sectionId);
        return {
          content: [{ type: "text", text: JSON.stringify(section, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `節の取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "list_histories",
    "指定した小説の編集履歴一覧を新しい順に取得します。参照専用であり復元は行いません。",
    {
      entityId: z
        .string()
        .optional()
        .describe("対象エンティティID（絞り込み用）"),
      entityType: z
        .string()
        .optional()
        .describe("エンティティ種別（絞り込み用）"),
      limit: z.number().optional().describe("取得件数上限（省略時は50）"),
      novelId: z.string().describe("小説ID (UUID)"),
    },
    async ({ novelId, entityType, entityId, limit }) => {
      try {
        assertNovelScope(auth, novelId);
        const list = await services.history.listHistories(novelId, {
          entityId,
          entityType,
          limit,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(list, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `履歴一覧の取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "get_history",
    "指定した編集履歴1件の詳細を取得します。参照専用であり復元は行いません。",
    {
      historyId: z.string().describe("履歴ID (UUID)"),
    },
    async ({ historyId }) => {
      try {
        await assertHistoryScope(services, auth, historyId);
        const history = await services.history.getHistory(historyId);
        return {
          content: [{ type: "text", text: JSON.stringify(history, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `履歴の取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ==========================================
  // 10. 一括読み書き (Batch)
  // ==========================================

  server.tool(
    "batch_get_section_contents",
    "複数の節の本文を一括取得します（最大20件）。失敗した節は ng に格納され、全体としては部分成功形式で返します。",
    {
      novelId: z.string().describe("小説ID (UUID、所属検証に使用)"),
      sectionIds: batchMax20(z.string()).describe(
        "節ID (UUID) の配列（最大20件）"
      ),
    },
    async ({ novelId, sectionIds }) => {
      try {
        assertNovelScope(auth, novelId);
        const ok: Array<Record<string, unknown>> = [];
        const ng: Array<Record<string, unknown>> = [];
        for (const sectionId of sectionIds) {
          try {
            const { section, content } = await assertSectionBelongsToNovel(
              services,
              novelId,
              sectionId,
              auth
            );
            ok.push({ content, section, sectionId });
          } catch (error) {
            ng.push({
              error: error instanceof Error ? error.message : String(error),
              sectionId,
            });
          }
        }
        return {
          content: [
            { type: "text", text: JSON.stringify({ ng, ok }, null, 2) },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `節本文の一括取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "batch_save_section_contents",
    "複数の節の本文を一括保存・更新します（最大20件）。失敗した節は ng に格納され、全体としては部分成功形式で返します。",
    {
      description: z
        .string()
        .optional()
        .default("MCP外部LLMによる一括執筆・更新")
        .describe("変更理由や履歴の説明"),
      items: batchMax20(
        z.object({
          body: z.string().describe("保存する小説本文テキスト"),
          sectionId: z.string().describe("節ID (UUID)"),
        })
      ).describe("保存対象の配列（最大20件）"),
      novelId: z
        .string()
        .optional()
        .describe("小説ID (UUID、指定時は所属検証に使用)"),
    },
    async ({ novelId, items, description }) => {
      try {
        if (novelId) {
          assertNovelScope(auth, novelId);
        }
        const ok: Array<Record<string, unknown>> = [];
        const ng: Array<Record<string, unknown>> = [];
        for (const item of items) {
          try {
            if (novelId) {
              await assertSectionBelongsToNovel(
                services,
                novelId,
                item.sectionId,
                auth
              );
            } else {
              await assertSectionScope(services, auth, item.sectionId);
            }
            const updated = await services.content.updateContent(
              item.sectionId,
              item.body,
              description
            );
            ok.push({
              sectionId: item.sectionId,
              updatedAt:
                updated.updatedAt instanceof Date
                  ? updated.updatedAt.toISOString()
                  : (updated.updatedAt ?? null),
              wordCount: updated.wordCount,
            });
          } catch (error) {
            ng.push({
              error: error instanceof Error ? error.message : String(error),
              sectionId: item.sectionId,
            });
          }
        }
        return {
          content: [
            { type: "text", text: JSON.stringify({ ng, ok }, null, 2) },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `節本文の一括保存に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "batch_create_foreshadowings",
    "複数の伏線を一括登録します（最大20件）。失敗した件は ng に格納され、全体としては部分成功形式で返します。",
    {
      items: batchMax20(
        z.object({
          category: z
            .string()
            .optional()
            .default("伏線")
            .describe("伏線のカテゴリ"),
          description: z
            .string()
            .optional()
            .describe("伏線の詳細、真相、回収アイデア"),
          plantSectionId: z
            .string()
            .optional()
            .describe("設置（初出）した節ID"),
          status: z
            .enum(["unresolved", "resolved", "abandoned"])
            .optional()
            .default("unresolved"),
          title: z.string().describe("伏線のタイトル・概要"),
        })
      ).describe("登録する伏線の配列（最大20件）"),
      novelId: z.string().describe("小説ID (UUID)"),
    },
    async ({ novelId, items }) => {
      try {
        assertNovelScope(auth, novelId);
        const ok: Array<Record<string, unknown>> = [];
        const ng: Array<Record<string, unknown>> = [];
        for (const [index, item] of items.entries()) {
          try {
            if (item.plantSectionId) {
              await assertSectionScope(services, auth, item.plantSectionId);
            }
            const created = await services.foreshadowing.createForeshadowing(
              novelId,
              {
                category: item.category,
                description: item.description,
                placedSectionId: item.plantSectionId || null,
                resolvedSectionId: null,
                status: item.status,
                title: item.title,
              }
            );
            ok.push(created as unknown as Record<string, unknown>);
          } catch (error) {
            ng.push({
              error: error instanceof Error ? error.message : String(error),
              index,
            });
          }
        }
        return {
          content: [
            { type: "text", text: JSON.stringify({ ng, ok }, null, 2) },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `伏線の一括登録に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "batch_update_foreshadowings",
    "複数の伏線を一括更新します（最大20件）。失敗した件は ng に格納され、全体としては部分成功形式で返します。",
    {
      items: batchMax20(
        z.object({
          description: z.string().optional().describe("詳細説明"),
          foreshadowingId: z.string().describe("伏線ID (UUID)"),
          resolveSectionId: z
            .string()
            .optional()
            .nullable()
            .describe("回収された節ID"),
          status: z
            .enum(["unresolved", "resolved", "abandoned"])
            .optional()
            .describe(
              "ステータス（resolved: 回収済, unresolved: 未回収, abandoned: 破棄）"
            ),
          title: z.string().optional().describe("タイトル"),
        })
      ).describe("更新する伏線の配列（最大20件）"),
    },
    async ({ items }) => {
      try {
        const ok: Array<Record<string, unknown>> = [];
        const ng: Array<Record<string, unknown>> = [];
        for (const [index, item] of items.entries()) {
          try {
            await assertForeshadowingScope(
              services,
              auth,
              item.foreshadowingId
            );
            if (item.resolveSectionId) {
              await assertSectionScope(services, auth, item.resolveSectionId);
            }
            const updated = await services.foreshadowing.updateForeshadowing(
              item.foreshadowingId,
              {
                description: item.description,
                resolvedSectionId: item.resolveSectionId,
                status: item.status,
                title: item.title,
              }
            );
            ok.push(updated as unknown as Record<string, unknown>);
          } catch (error) {
            ng.push({
              error: error instanceof Error ? error.message : String(error),
              foreshadowingId: item.foreshadowingId,
              index,
            });
          }
        }
        return {
          content: [
            { type: "text", text: JSON.stringify({ ng, ok }, null, 2) },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `伏線の一括更新に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "batch_create_timeline_events",
    "複数のタイムラインイベントを一括追加します（最大20件）。失敗した件は ng に格納され、全体としては部分成功形式で返します。",
    {
      items: batchMax20(
        z.object({
          event: z.string().describe("出来事の内容"),
          order: z.number().optional().describe("時系列の順序番号"),
          sectionId: z.string().optional().describe("紐付ける節ID"),
          timestamp: z
            .string()
            .optional()
            .describe("作中時期（例: 帝都暦742年、物語開始3年前 等）"),
        })
      ).describe("追加するイベントの配列（最大20件）"),
      novelId: z.string().describe("小説ID (UUID)"),
    },
    async ({ novelId, items }) => {
      try {
        assertNovelScope(auth, novelId);
        const ok: Array<Record<string, unknown>> = [];
        const ng: Array<Record<string, unknown>> = [];
        for (const [index, item] of items.entries()) {
          try {
            if (item.sectionId) {
              await assertSectionScope(services, auth, item.sectionId);
            }
            const created = await services.timeline.createTimeline({
              event: item.event,
              novelId,
              order: item.order,
              sectionId: item.sectionId,
              timestamp: item.timestamp,
            });
            ok.push(created as unknown as Record<string, unknown>);
          } catch (error) {
            ng.push({
              error: error instanceof Error ? error.message : String(error),
              index,
            });
          }
        }
        return {
          content: [
            { type: "text", text: JSON.stringify({ ng, ok }, null, 2) },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `タイムラインイベントの一括作成に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "batch_update_timeline_events",
    "複数のタイムラインイベントを一括更新します（最大20件）。失敗した件は ng に格納され、全体としては部分成功形式で返します。",
    {
      items: batchMax20(
        z.object({
          event: z.string().optional().describe("出来事の内容"),
          order: z.number().optional().describe("時系列の順序番号"),
          sectionId: z.string().optional().nullable().describe("紐付ける節ID"),
          timelineId: z.string().describe("タイムラインID (UUID)"),
          timestamp: z.string().optional().describe("作中時期"),
        })
      ).describe("更新するイベントの配列（最大20件）"),
    },
    async ({ items }) => {
      try {
        const ok: Array<Record<string, unknown>> = [];
        const ng: Array<Record<string, unknown>> = [];
        for (const [index, item] of items.entries()) {
          try {
            const updated = await services.timeline.updateTimeline(
              item.timelineId,
              {
                event: item.event,
                order: item.order,
                sectionId: item.sectionId,
                timestamp: item.timestamp,
              }
            );
            ok.push(updated as unknown as Record<string, unknown>);
          } catch (error) {
            ng.push({
              error: error instanceof Error ? error.message : String(error),
              index,
              timelineId: item.timelineId,
            });
          }
        }
        return {
          content: [
            { type: "text", text: JSON.stringify({ ng, ok }, null, 2) },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `タイムラインイベントの一括更新に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "get_foreshadowings_markdown",
    "小説の伏線一覧をパース用Markdownテキストとして取得します。",
    {
      novelId: z.string().describe("小説ID (UUID)"),
    },
    async ({ novelId }) => {
      try {
        assertNovelScope(auth, novelId);
        const markdown = await services.foreshadowing.getMarkdown(novelId);
        return {
          content: [{ type: "text", text: markdown }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `伏線Markdownの取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "save_foreshadowings_markdown",
    "伏線全体のMarkdownテキストを一括解析し、既存の伏線リストと同期・更新します。大規模修正時は個別CRUD連打より本ツールを優先。",
    {
      markdown: z.string().describe("伏線Markdownテキスト"),
      novelId: z.string().describe("小説ID (UUID)"),
    },
    async ({ novelId, markdown }) => {
      try {
        assertNovelScope(auth, novelId);
        const result = await services.foreshadowing.saveMarkdown(
          novelId,
          markdown
        );
        return {
          content: [
            {
              type: "text",
              text: `伏線Markdownを同期しました:\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `伏線Markdownの同期に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "get_timelines_markdown",
    "小説の作中時系列イベント一覧をパース用Markdownテキストとして取得します。",
    {
      novelId: z.string().describe("小説ID (UUID)"),
    },
    async ({ novelId }) => {
      try {
        assertNovelScope(auth, novelId);
        const markdown = await services.timeline.getMarkdown(novelId);
        return {
          content: [{ type: "text", text: markdown }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `タイムラインMarkdownの取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "save_timelines_markdown",
    "年表全体のMarkdownテキストを一括解析し、既存のタイムラインリストと同期・更新します。大規模修正時は個別CRUD連打より本ツールを優先。",
    {
      markdown: z.string().describe("年表Markdownテキスト"),
      novelId: z.string().describe("小説ID (UUID)"),
    },
    async ({ novelId, markdown }) => {
      try {
        assertNovelScope(auth, novelId);
        const result = await services.timeline.saveMarkdown(novelId, markdown);
        return {
          content: [
            {
              type: "text",
              text: `タイムラインMarkdownを同期しました:\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `タイムラインMarkdownの同期に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ==========================================
  // 11. アイデアストア (Ideas)
  // ==========================================

  server.tool(
    "create_idea",
    "新しいアイデアを登録します。発想プロンプトで出た案の保存先として使います。",
    {
      body: z.string().optional().describe("アイデアの詳細・展開メモ"),
      novelId: z.string().describe("小説ID (UUID)"),
      source: z
        .string()
        .optional()
        .describe("出どころ（例: twist, what_if, character, seed, manual）"),
      title: z.string().describe("アイデアのタイトル・概要"),
    },
    async ({ novelId, title, body, source }) => {
      try {
        assertNovelScope(auth, novelId);
        const idea = await services.idea.createIdea(novelId, {
          body,
          source,
          title,
        });
        return {
          content: [
            {
              type: "text",
              text: `アイデアを登録しました:\n${JSON.stringify(idea, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `アイデアの登録に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "list_ideas",
    "小説のアイデア一覧を取得します。status未指定時は却下済みを除外します。",
    {
      novelId: z.string().describe("小説ID (UUID)"),
      status: z
        .enum(["draft", "adopted", "rejected"])
        .optional()
        .describe("ステータス絞り込み（指定時のみ却下済みも返す）"),
    },
    async ({ novelId, status }) => {
      try {
        assertNovelScope(auth, novelId);
        const list = await services.idea.listIdeas(novelId, { status });
        return {
          content: [{ type: "text", text: JSON.stringify(list, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `アイデア一覧の取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "update_idea",
    "アイデアのタイトル・詳細を更新します。",
    {
      body: z.string().optional().describe("アイデアの詳細・展開メモ"),
      ideaId: z.string().describe("アイデアID (UUID)"),
      novelId: z.string().describe("小説ID (UUID、所属検証に使用)"),
      title: z.string().optional().describe("アイデアのタイトル・概要"),
    },
    async ({ novelId, ideaId, title, body }) => {
      try {
        assertNovelScope(auth, novelId);
        const idea = await services.idea.getIdea(ideaId);
        if (idea.novelId !== novelId) {
          throw new NotFoundError("Idea", ideaId);
        }
        const updated = await services.idea.updateIdea(ideaId, {
          body,
          title,
        });
        return {
          content: [
            {
              type: "text",
              text: `アイデアを更新しました:\n${JSON.stringify(updated, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `アイデアの更新に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "set_idea_status",
    "アイデアのステータスを変更します（draft/adopted/rejected）。",
    {
      ideaId: z.string().describe("アイデアID (UUID)"),
      novelId: z.string().describe("小説ID (UUID、所属検証に使用)"),
      status: z
        .enum(["draft", "adopted", "rejected"])
        .describe("変更後のステータス"),
    },
    async ({ novelId, ideaId, status }) => {
      try {
        assertNovelScope(auth, novelId);
        const idea = await services.idea.getIdea(ideaId);
        if (idea.novelId !== novelId) {
          throw new NotFoundError("Idea", ideaId);
        }
        const updated = await services.idea.setIdeaStatus(ideaId, status);
        const guide =
          status === "adopted"
            ? "\n採用した案はcreate_chapter等で反映してください。"
            : "";
        return {
          content: [
            {
              type: "text",
              text: `アイデア (ID: ${updated.id}) のステータスを${updated.status}に更新しました。${guide}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `アイデアのステータス更新に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "draw_story_seeds",
    "人物・設定・年表からランダムに要素を抽出して組み合わせ、物語の種を提示します。",
    {
      count: z
        .number()
        .min(1)
        .max(10)
        .optional()
        .default(3)
        .describe("提示する種の数（1〜10、省略時は3）"),
      novelId: z.string().describe("小説ID (UUID)"),
    },
    async ({ novelId, count }) => {
      try {
        assertNovelScope(auth, novelId);
        const [characters, settings, timelines] = await Promise.all([
          services.character.listCharacters(novelId).catch((): never[] => []),
          services.setting.listSettings(novelId).catch((): never[] => []),
          services.timeline.listTimelines(novelId).catch((): never[] => []),
        ]);
        const pick = <T>(items: T[]): T | null =>
          items.length > 0
            ? (items[Math.floor(Math.random() * items.length)] ?? null)
            : null;
        const seeds: Array<Record<string, unknown>> = [];
        for (let i = 0; i < count; i += 1) {
          const character = pick(characters);
          const setting = pick(settings);
          const timeline = pick(timelines);
          if (!character && !setting && !timeline) {
            continue;
          }
          const parts: string[] = [];
          if (character) {
            parts.push(`人物「${character.name}」`);
          }
          if (setting) {
            parts.push(`設定「${setting.name}」`);
          }
          if (timeline) {
            parts.push(`出来事「${timeline.event}」`);
          }
          seeds.push({
            character: character?.name ?? null,
            prompt: `${parts.join("と")}を掛け合わせた物語の種`,
            setting: setting?.name ?? null,
            timeline: timeline?.event ?? null,
          });
        }
        if (seeds.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "まだ種になる要素（人物・設定・年表）が登録されていません。先に人物や設定を登録してください。",
              },
            ],
          };
        }
        return {
          content: [{ type: "text", text: JSON.stringify(seeds, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `物語の種の抽出に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
