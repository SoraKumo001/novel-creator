import { chapters } from "@novel-creator/db";
import type { ToolSet } from "ai";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { searchContext } from "../../rag.js";
import { ChapterDomainService } from "../chapter.service.js";
import { CharacterDomainService } from "../character.service.js";
import { ForeshadowingDomainService } from "../foreshadowing.service.js";
import { NovelDomainService } from "../novel.service.js";
import { SectionDomainService } from "../section.service.js";
import { SettingDomainService } from "../setting.service.js";
import { TimelineDomainService } from "../timeline.service.js";
import type { ServiceContext } from "../types.js";
import { createNovelScope, createTool } from "./scopedTool.js";
import {
  foreshadowingStatusValue,
  novelIdParam,
  type ScopedToolDefinition,
} from "./toolSchemas.js";

// ===== トークン爆発防止のための truncation ヘルパー（pure function） =====

/** 一覧系ツール（getCharacters / getSettings）で返す最大件数 */
export const MAX_LIST_ITEMS = 30;
/** 構造系ツール（getPlotAndChapters / getForeshadowings / getTimelines）で返す最大件数 */
export const MAX_STRUCTURE_ITEMS = 50;
/** セマンティック検索（searchNovelKnowledge）でカテゴリごとに返す最大件数 */
export const MAX_SEARCH_ITEMS = 10;
/** description 等の長文テキストの最大文字数 */
export const MAX_TEXT_LENGTH = 600;
/** 切り詰め時に付与する接尾辞 */
export const TRUNCATION_SUFFIX = "...(切り詰め)";

/**
 * 長文テキストを max 文字に切り詰める。
 * 切り詰めた場合は末尾に TRUNCATION_SUFFIX を付与し、LLM が省略を認識できるようにする。
 * null / undefined は null のまま返す。
 */
export function truncateText(
  text: string | null | undefined,
  max: number = MAX_TEXT_LENGTH
): string | null {
  if (text == null) {
    return null;
  }
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max)}${TRUNCATION_SUFFIX}`;
}

export interface TruncationResult<T> {
  /** 表示対象となる切り詰め後の配列 */
  items: T[];
  /** 件数切り詰めが発生した場合の省略明示文言（未発生時は null） */
  notice: string | null;
  /** 省略された件数 */
  omitted: number;
  /** 実際に表示する件数 */
  shown: number;
  /** 元の配列の総件数 */
  total: number;
}

/**
 * 配列を max 件までに切り詰め、件数情報と省略明示文言を返す。
 */
export function truncateList<T>(
  items: readonly T[],
  max: number
): TruncationResult<T> {
  const total = items.length;
  const sliced = items.slice(0, max);
  const omitted = total - sliced.length;
  return {
    items: sliced,
    notice: omitted > 0 ? truncationNotice(total, sliced.length) : null,
    omitted,
    shown: sliced.length,
    total,
  };
}

/**
 * 件数切り詰めが発生したことを LLM に明示するための文言を生成する。
 */
export function truncationNotice(total: number, shown: number): string {
  return `[truncated: showing ${shown} of ${total}] 残り ${total - shown} 件は省略されました`;
}

/**
 * 節がバインドされた小説に属するかを判定する純関数。
 * sections テーブルには novelId カラムが存在しないため、
 * 親章（chapters）の novelId がバインドされた novelId と一致する場合のみ閲覧を許可する。
 */
export function isSectionInScope(
  boundNovelId: string | null | undefined,
  chapter: { novelId: string | null | undefined } | null | undefined
): boolean {
  if (!boundNovelId) {
    return false;
  }
  return chapter?.novelId === boundNovelId;
}

// ===== 入力スキーマ（テーブル化・単一定義） =====

export const getCharactersInputSchema = z.object({
  category: z
    .string()
    .optional()
    .describe("キャラクターカテゴリ（主要人物、敵役など）"),
  name: z
    .string()
    .optional()
    .describe("検索するキャラクター名またはキーワード（部分一致）"),
  novelId: novelIdParam,
});
export type GetCharactersParams = z.output<typeof getCharactersInputSchema>;

export const getForeshadowingsInputSchema = z.object({
  novelId: novelIdParam,
  status: foreshadowingStatusValue
    .optional()
    .describe(
      "伏線のステータスで絞り込み（unresolved: 未回収, resolved: 回収済, abandoned: 破棄）"
    ),
});
export type GetForeshadowingsParams = z.output<
  typeof getForeshadowingsInputSchema
>;

export const novelScopedInputSchema = z.object({
  novelId: novelIdParam,
});
export type NovelScopedParams = z.output<typeof novelScopedInputSchema>;

export const getSettingsInputSchema = z.object({
  category: z
    .string()
    .optional()
    .describe("設定カテゴリ（世界観、地理、魔法体系など）"),
  name: z
    .string()
    .optional()
    .describe("検索する設定名またはキーワード（部分一致）"),
  novelId: novelIdParam,
});
export type GetSettingsParams = z.output<typeof getSettingsInputSchema>;

export const getSectionContentInputSchema = z.object({
  sectionId: z.string().describe("取得対象の節ID（Section ID）"),
});
export type GetSectionContentParams = z.output<
  typeof getSectionContentInputSchema
>;

export const searchNovelKnowledgeInputSchema = z.object({
  novelId: novelIdParam,
  query: z.string().describe("検索キーワードまたは質問文"),
});
export type SearchNovelKnowledgeParams = z.output<
  typeof searchNovelKnowledgeInputSchema
>;

// ===== ハンドラ用サービス束（明示型） =====

export interface ReadToolServices {
  chapterService: ChapterDomainService;
  characterService: CharacterDomainService;
  foreshadowingService: ForeshadowingDomainService;
  novelService: NovelDomainService;
  sectionService: SectionDomainService;
  settingService: SettingDomainService;
  timelineService: TimelineDomainService;
}

export interface TruncationNoticeFields {
  truncated?: string;
  [key: string]: unknown;
}

/**
 * 創作相談チャット用の小説データ読み取りツール群を作成する。
 * 各ツールは AI SDK の tool() 形式で定義され、LLM による自律的な小説情報参照を可能にする。
 *
 * 入力スキーマはモジュール頂部の単一定義、ハンドラは createReadToolTable の
 * テーブルに集約し、createReadTools ではスコープ解決のみを付与する。
 * 公開シグネチャ・ツール名・入出力形状・実行結果は従来通り。
 */
function createReadToolTable(
  ctx: ServiceContext,
  services: ReadToolServices
): {
  getCharacters: ScopedToolDefinition<
    typeof getCharactersInputSchema,
    Record<string, unknown>
  >;
  getForeshadowings: ScopedToolDefinition<
    typeof getForeshadowingsInputSchema,
    Record<string, unknown>
  >;
  getNovelInfo: ScopedToolDefinition<
    typeof novelScopedInputSchema,
    Record<string, unknown>
  >;
  getPlotAndChapters: ScopedToolDefinition<
    typeof novelScopedInputSchema,
    Record<string, unknown>
  >;
  getSectionContent: ScopedToolDefinition<
    typeof getSectionContentInputSchema,
    Record<string, unknown>
  >;
  getSettings: ScopedToolDefinition<
    typeof getSettingsInputSchema,
    Record<string, unknown>
  >;
  getStoryOutline: ScopedToolDefinition<
    typeof novelScopedInputSchema,
    Record<string, unknown>
  >;
  getTimelines: ScopedToolDefinition<
    typeof novelScopedInputSchema,
    Record<string, unknown>
  >;
  searchNovelKnowledge: ScopedToolDefinition<
    typeof searchNovelKnowledgeInputSchema,
    Record<string, unknown>
  >;
} {
  const {
    novelService,
    characterService,
    settingService,
    chapterService,
    sectionService,
    foreshadowingService,
    timelineService,
  } = services;

  return {
    getCharacters: {
      description:
        "小説に登場するキャラクター一覧または特定のキャラクターの詳細を取得します。名前やカテゴリで絞り込み可能です。",
      errorMessage: "キャラクター情報の取得に失敗しました。",
      handler: async (
        targetId: string,
        { name, category }: GetCharactersParams
      ): Promise<Record<string, unknown>> => {
        let list = await characterService.listCharacters(targetId);
        if (name) {
          const query = name.toLowerCase();
          list = list.filter(
            (c) =>
              c.name.toLowerCase().includes(query) ||
              c.description?.toLowerCase().includes(query)
          );
        }
        if (category) {
          list = list.filter((c) => c.category === category);
        }
        return {
          count: list.length,
          ...(list.length > MAX_LIST_ITEMS
            ? { truncated: truncationNotice(list.length, MAX_LIST_ITEMS) }
            : {}),
          characters: truncateList(list, MAX_LIST_ITEMS).items.map((c) => ({
            category: c.category,
            description: truncateText(c.description),
            id: c.id,
            name: c.name,
            traits: c.traits,
          })),
        };
      },
      inputSchema: getCharactersInputSchema,
    },
    getForeshadowings: {
      description:
        "小説に登録されている伏線の一覧、進捗状況（未回収/回収済/破棄）、詳細説明を取得します。",
      errorMessage: "伏線情報の取得に失敗しました。",
      handler: async (
        targetId: string,
        { status }: GetForeshadowingsParams
      ): Promise<Record<string, unknown>> => {
        let list =
          await foreshadowingService.getForeshadowingsByNovel(targetId);
        if (status) {
          list = list.filter((f) => f.status === status);
        }
        const trunc = truncateList(list, MAX_STRUCTURE_ITEMS);
        return {
          count: list.length,
          ...(trunc.notice ? { truncated: trunc.notice } : {}),
          foreshadowings: trunc.items.map((f) => ({
            createdAt:
              f.createdAt instanceof Date
                ? f.createdAt.toISOString()
                : (f.createdAt ?? null),
            description: truncateText(f.description),
            id: f.id,
            placedSectionId: f.placedSectionId,
            resolvedSectionId: f.resolvedSectionId,
            status: f.status,
            title: f.title,
          })),
        };
      },
      inputSchema: getForeshadowingsInputSchema,
    },
    getNovelInfo: {
      description: "小説の基本情報（タイトル、あらすじ、概要）を取得します。",
      errorMessage: "指定された小説が見つかりませんでした。",
      handler: async (targetId: string): Promise<Record<string, unknown>> => {
        const detail = await novelService.getNovelDetail(targetId);
        return {
          chapterCount: detail.chapters.length,
          characterCount: detail.characters.length,
          createdAt:
            detail.novel.createdAt instanceof Date
              ? detail.novel.createdAt.toISOString()
              : (detail.novel.createdAt ?? null),
          description: detail.novel.description,
          id: detail.novel.id,
          settingCount: detail.settings.length,
          storyOutline: truncateText(detail.novel.storyOutline, 2000),
          title: detail.novel.title,
          updatedAt:
            detail.novel.updatedAt instanceof Date
              ? detail.novel.updatedAt.toISOString()
              : (detail.novel.updatedAt ?? null),
        };
      },
      inputSchema: novelScopedInputSchema,
    },
    getPlotAndChapters: {
      description:
        "小説の全章（Chapter）および各節（Section）の構成、プロット・あらすじ一覧を取得します。",
      errorMessage: "章・プロット情報の取得に失敗しました。",
      handler: async (targetId: string): Promise<Record<string, unknown>> => {
        const chapterRows = await chapterService.listChapters(targetId);
        const chapterTrunc = truncateList(chapterRows, MAX_STRUCTURE_ITEMS);
        const chaptersWithSections = await Promise.all(
          chapterTrunc.items.map(async (ch) => {
            const sections = await sectionService.listSections(ch.id);
            const sectionTrunc = truncateList(sections, MAX_STRUCTURE_ITEMS);
            return {
              id: ch.id,
              order: ch.order,
              sections: sectionTrunc.items.map((sec) => ({
                id: sec.id,
                order: sec.order,
                summary: truncateText(sec.summary),
                title: sec.title,
              })),
              summary: truncateText(ch.summary),
              title: ch.title,
              ...(sectionTrunc.notice
                ? { truncatedSections: sectionTrunc.notice }
                : {}),
            };
          })
        );
        return {
          chapterCount: chapterRows.length,
          ...(chapterTrunc.notice ? { truncated: chapterTrunc.notice } : {}),
          chapters: chaptersWithSections,
        };
      },
      inputSchema: novelScopedInputSchema,
    },
    getSectionContent: {
      description: "指定された節（Section）の本文テキストを取得します。",
      errorMessage: "指定された節または本文が見つかりませんでした。",
      handler: async (
        scopedNovelId: string,
        { sectionId }: GetSectionContentParams
      ): Promise<Record<string, unknown>> => {
        const { section, content } =
          await sectionService.getSectionWithContent(sectionId);
        // novelId スコープ判定: sections テーブルに novelId カラムはないため、
        // 親章（chapters）の novelId がバインドされた小説と一致するかを確認する。
        const [chapter] = await ctx.db
          .select()
          .from(chapters)
          .where(eq(chapters.id, section.chapterId));
        if (!isSectionInScope(scopedNovelId, chapter)) {
          return {
            error:
              "指定された節が見つかりません（他の小説に属しているため、現在の相談対象からは参照できません）。",
          };
        }
        return {
          content: content
            ? truncateText(content.body)
            : "（本文はまだ作成されていません）",
          sectionId: section.id,
          summary: truncateText(section.summary),
          title: section.title,
        };
      },
      inputSchema: getSectionContentInputSchema,
    },
    getSettings: {
      description:
        "小説の世界観・設定（用語、地理、魔法、組織、アイテム等）の一覧または特定設定の詳細を取得します。",
      errorMessage: "設定情報の取得に失敗しました。",
      handler: async (
        targetId: string,
        { name, category }: GetSettingsParams
      ): Promise<Record<string, unknown>> => {
        let list = await settingService.listSettings(targetId);
        if (name) {
          const query = name.toLowerCase();
          list = list.filter(
            (s) =>
              s.name.toLowerCase().includes(query) ||
              s.description?.toLowerCase().includes(query)
          );
        }
        if (category) {
          list = list.filter((s) => s.category === category);
        }
        return {
          count: list.length,
          ...(list.length > MAX_LIST_ITEMS
            ? { truncated: truncationNotice(list.length, MAX_LIST_ITEMS) }
            : {}),
          settings: truncateList(list, MAX_LIST_ITEMS).items.map((s) => ({
            category: s.category,
            description: truncateText(s.description),
            id: s.id,
            name: s.name,
          })),
        };
      },
      inputSchema: getSettingsInputSchema,
    },
    getStoryOutline: {
      description:
        "小説のストーリー構想（全体のあらすじ、序盤・中盤・今後の展開候補、結末、構想メモ）のマークダウン内容を取得します。構成や今後の展開・結末の相談時に参照してください。",
      errorMessage: "ストーリー構想の取得に失敗しました。",
      handler: async (targetId: string): Promise<Record<string, unknown>> => {
        const detail = await novelService.getNovelDetail(targetId);
        return {
          storyOutline:
            detail.novel.storyOutline ||
            "（ストーリー構想はまだ作成されていません）",
          title: detail.novel.title,
        };
      },
      inputSchema: novelScopedInputSchema,
    },
    getTimelines: {
      description: "作中の時系列・年表イベントの一覧を取得します。",
      errorMessage: "タイムライン情報の取得に失敗しました。",
      handler: async (targetId: string): Promise<Record<string, unknown>> => {
        const list = await timelineService.listTimelines(targetId);
        const trunc = truncateList(list, MAX_STRUCTURE_ITEMS);
        return {
          count: list.length,
          ...(trunc.notice ? { truncated: trunc.notice } : {}),
          timelines: trunc.items.map((t) => ({
            event: truncateText(t.event),
            id: t.id,
            order: t.order,
            sectionId: t.sectionId,
            timestamp: t.timestamp,
          })),
        };
      },
      inputSchema: novelScopedInputSchema,
    },
    searchNovelKnowledge: {
      description:
        "質問やキーワードに関連する小説情報（設定・人物・本文等）をセマンティック検索（ベクトル検索）します。",
      errorMessage: "関連ナレッジの検索に失敗しました。",
      handler: async (
        targetId: string,
        { query }: SearchNovelKnowledgeParams
      ): Promise<Record<string, unknown>> => {
        const ragResult = await searchContext(
          ctx.vectorStore,
          ctx.embedding,
          targetId,
          { query },
          ctx.env
        );
        // セマンティック検索結果もカテゴリごとに件数上限を適用する（topK 超過に備える）。
        const charTrunc = truncateList(ragResult.characters, MAX_SEARCH_ITEMS);
        const settingTrunc = truncateList(ragResult.settings, MAX_SEARCH_ITEMS);
        return {
          ...(charTrunc.notice || settingTrunc.notice
            ? {
                truncated:
                  [charTrunc.notice, settingTrunc.notice]
                    .filter(Boolean)
                    .join(" / ") || null,
              }
            : {}),
          characters: charTrunc.items.map((c) => truncateText(c)),
          settings: settingTrunc.items.map((s) => truncateText(s)),
        };
      },
      inputSchema: searchNovelKnowledgeInputSchema,
    },
  };
}

export type ReadToolName =
  | "getCharacters"
  | "getForeshadowings"
  | "getNovelInfo"
  | "getPlotAndChapters"
  | "getSectionContent"
  | "getSettings"
  | "getStoryOutline"
  | "getTimelines"
  | "searchNovelKnowledge";

export function createReadTools(
  ctx: ServiceContext,
  defaultNovelId?: string | null
): ToolSet {
  const novelService = new NovelDomainService(ctx);
  const characterService = new CharacterDomainService(ctx);
  const settingService = new SettingDomainService(ctx);
  const chapterService = new ChapterDomainService(ctx);
  const sectionService = new SectionDomainService(ctx);
  const foreshadowingService = new ForeshadowingDomainService(ctx);
  const timelineService = new TimelineDomainService(ctx);

  const novelScope = createNovelScope(defaultNovelId);

  const table = createReadToolTable(ctx, {
    chapterService,
    characterService,
    foreshadowingService,
    novelService,
    sectionService,
    settingService,
    timelineService,
  });

  return {
    getCharacters: createTool({
      ...table.getCharacters,
      scope: novelScope.fromParam,
    }),
    getForeshadowings: createTool({
      ...table.getForeshadowings,
      scope: novelScope.fromParam,
    }),
    getNovelInfo: createTool({
      ...table.getNovelInfo,
      scope: novelScope.fromParam,
    }),
    getPlotAndChapters: createTool({
      ...table.getPlotAndChapters,
      scope: novelScope.fromParam,
    }),
    // バインドされた novelId にスコープを限定する（LLM による指定は受け付けない）。
    getSectionContent: createTool({
      ...table.getSectionContent,
      scope: novelScope.boundOnly,
    }),
    getSettings: createTool({
      ...table.getSettings,
      scope: novelScope.fromParam,
    }),
    getStoryOutline: createTool({
      ...table.getStoryOutline,
      scope: novelScope.fromParam,
    }),
    getTimelines: createTool({
      ...table.getTimelines,
      scope: novelScope.fromParam,
    }),
    searchNovelKnowledge: createTool({
      ...table.searchNovelKnowledge,
      scope: novelScope.fromParam,
    }),
  };
}
