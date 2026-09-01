import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { chapters } from '@novel-creator/db';
import type { ServiceContext } from '../types.js';
import { NovelDomainService } from '../novel.service.js';
import { CharacterDomainService } from '../character.service.js';
import { SettingDomainService } from '../setting.service.js';
import { ChapterDomainService } from '../chapter.service.js';
import { SectionDomainService } from '../section.service.js';
import { ForeshadowingDomainService } from '../foreshadowing.service.js';
import { TimelineDomainService } from '../timeline.service.js';
import { searchContext } from '../../rag.js';
import { scopedTool } from './scopedTool.js';

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
export const TRUNCATION_SUFFIX = '...(切り詰め)';

/**
 * 長文テキストを max 文字に切り詰める。
 * 切り詰めた場合は末尾に TRUNCATION_SUFFIX を付与し、LLM が省略を認識できるようにする。
 * null / undefined は null のまま返す。
 */
export function truncateText(
  text: string | null | undefined,
  max: number = MAX_TEXT_LENGTH,
): string | null {
  if (text == null) return null;
  if (text.length <= max) return text;
  return `${text.slice(0, max)}${TRUNCATION_SUFFIX}`;
}

export interface TruncationResult<T> {
  /** 表示対象となる切り詰め後の配列 */
  items: T[];
  /** 元の配列の総件数 */
  total: number;
  /** 実際に表示する件数 */
  shown: number;
  /** 省略された件数 */
  omitted: number;
  /** 件数切り詰めが発生した場合の省略明示文言（未発生時は null） */
  notice: string | null;
}

/**
 * 配列を max 件までに切り詰め、件数情報と省略明示文言を返す。
 */
export function truncateList<T>(items: readonly T[], max: number): TruncationResult<T> {
  const total = items.length;
  const sliced = items.slice(0, max);
  const omitted = total - sliced.length;
  return {
    items: sliced,
    total,
    shown: sliced.length,
    omitted,
    notice: omitted > 0 ? truncationNotice(total, sliced.length) : null,
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
  chapter: { novelId: string | null | undefined } | null | undefined,
): boolean {
  if (!boundNovelId) return false;
  return chapter?.novelId === boundNovelId;
}

/**
 * 創作相談チャット用の小説データ読み取りツール群を作成する。
 * 各ツールは AI SDK の tool() 形式で定義され、LLM による自律的な小説情報参照を可能にする。
 */

export function createReadTools(
  ctx: ServiceContext,
  defaultNovelId?: string | null,
): Record<string, unknown> {
  const novelService = new NovelDomainService(ctx);
  const characterService = new CharacterDomainService(ctx);
  const settingService = new SettingDomainService(ctx);
  const chapterService = new ChapterDomainService(ctx);
  const sectionService = new SectionDomainService(ctx);
  const foreshadowingService = new ForeshadowingDomainService(ctx);
  const timelineService = new TimelineDomainService(ctx);

  const resolveNovelId = (providedId?: string | null): string | null => {
    return providedId || defaultNovelId || null;
  };

  return {
    getNovelInfo: scopedTool({
      description: '小説の基本情報（タイトル、あらすじ、概要）を取得します。',
      parameters: z.object({
        novelId: z.string().optional().describe('対象の小説ID（省略時は現在の相談対象小説）'),
      }),
      resolve: ({ novelId }) => resolveNovelId(novelId),
      errorMessage: '指定された小説が見つかりませんでした。',
      run: async (targetId) => {
        const detail = await novelService.getNovelDetail(targetId);
        return {
          id: detail.novel.id,
          title: detail.novel.title,
          description: detail.novel.description,
          storyOutline: truncateText(detail.novel.storyOutline, 2000),
          chapterCount: detail.chapters.length,
          characterCount: detail.characters.length,
          settingCount: detail.settings.length,
          createdAt: detail.novel.createdAt,
          updatedAt: detail.novel.updatedAt,
        };
      },
    }),

    getStoryOutline: scopedTool({
      description:
        '小説のストーリー構想（全体のあらすじ、序盤・中盤・今後の展開候補、結末、構想メモ）のマークダウン内容を取得します。構成や今後の展開・結末の相談時に参照してください。',
      parameters: z.object({
        novelId: z.string().optional().describe('対象の小説ID（省略時は現在の相談対象小説）'),
      }),
      resolve: ({ novelId }) => resolveNovelId(novelId),
      errorMessage: 'ストーリー構想の取得に失敗しました。',
      run: async (targetId) => {
        const detail = await novelService.getNovelDetail(targetId);
        return {
          title: detail.novel.title,
          storyOutline: detail.novel.storyOutline || '（ストーリー構想はまだ作成されていません）',
        };
      },
    }),

    getCharacters: scopedTool({
      description:
        '小説に登場するキャラクター一覧または特定のキャラクターの詳細を取得します。名前やカテゴリで絞り込み可能です。',
      parameters: z.object({
        novelId: z.string().optional().describe('対象の小説ID（省略時は現在の相談対象小説）'),
        name: z.string().optional().describe('検索するキャラクター名またはキーワード（部分一致）'),
        category: z.string().optional().describe('キャラクターカテゴリ（主要人物、敵役など）'),
      }),
      resolve: ({ novelId }) => resolveNovelId(novelId),
      errorMessage: 'キャラクター情報の取得に失敗しました。',
      run: async (targetId, { name, category }) => {
        let list = await characterService.listCharacters(targetId);
        if (name) {
          const query = name.toLowerCase();
          list = list.filter(
            (c) =>
              c.name.toLowerCase().includes(query) ||
              (c.description && c.description.toLowerCase().includes(query)),
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
            id: c.id,
            name: c.name,
            category: c.category,
            description: truncateText(c.description),
            traits: c.traits,
          })),
        };
      },
    }),

    getSettings: scopedTool({
      description:
        '小説の世界観・設定（用語、地理、魔法、組織、アイテム等）の一覧または特定設定の詳細を取得します。',
      parameters: z.object({
        novelId: z.string().optional().describe('対象の小説ID（省略時は現在の相談対象小説）'),
        name: z.string().optional().describe('検索する設定名またはキーワード（部分一致）'),
        category: z.string().optional().describe('設定カテゴリ（世界観、地理、魔法体系など）'),
      }),
      resolve: ({ novelId }) => resolveNovelId(novelId),
      errorMessage: '設定情報の取得に失敗しました。',
      run: async (targetId, { name, category }) => {
        let list = await settingService.listSettings(targetId);
        if (name) {
          const query = name.toLowerCase();
          list = list.filter(
            (s) =>
              s.name.toLowerCase().includes(query) ||
              (s.description && s.description.toLowerCase().includes(query)),
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
            id: s.id,
            name: s.name,
            category: s.category,
            description: truncateText(s.description),
          })),
        };
      },
    }),

    getPlotAndChapters: scopedTool({
      description:
        '小説の全章（Chapter）および各節（Section）の構成、プロット・あらすじ一覧を取得します。',
      parameters: z.object({
        novelId: z.string().optional().describe('対象の小説ID（省略時は現在の相談対象小説）'),
      }),
      resolve: ({ novelId }) => resolveNovelId(novelId),
      errorMessage: '章・プロット情報の取得に失敗しました。',
      run: async (targetId) => {
        const chapterRows = await chapterService.listChapters(targetId);
        const chapterTrunc = truncateList(chapterRows, MAX_STRUCTURE_ITEMS);
        const chaptersWithSections = await Promise.all(
          chapterTrunc.items.map(async (ch) => {
            const sections = await sectionService.listSections(ch.id);
            const sectionTrunc = truncateList(sections, MAX_STRUCTURE_ITEMS);
            return {
              id: ch.id,
              title: ch.title,
              order: ch.order,
              summary: truncateText(ch.summary),
              sections: sectionTrunc.items.map((sec) => ({
                id: sec.id,
                title: sec.title,
                order: sec.order,
                summary: truncateText(sec.summary),
              })),
              ...(sectionTrunc.notice ? { truncatedSections: sectionTrunc.notice } : {}),
            };
          }),
        );
        return {
          chapterCount: chapterRows.length,
          ...(chapterTrunc.notice ? { truncated: chapterTrunc.notice } : {}),
          chapters: chaptersWithSections,
        };
      },
    }),

    getSectionContent: scopedTool({
      description: '指定された節（Section）の本文テキストを取得します。',
      parameters: z.object({
        sectionId: z.string().describe('取得対象の節ID（Section ID）'),
      }),
      // バインドされた novelId にスコープを限定する（LLM による指定は受け付けない）。
      resolve: () => defaultNovelId || null,
      errorMessage: '指定された節または本文が見つかりませんでした。',
      run: async (scopedNovelId, { sectionId }) => {
        const { section, content } = await sectionService.getSectionWithContent(sectionId);
        // novelId スコープ判定: sections テーブルに novelId カラムはないため、
        // 親章（chapters）の novelId がバインドされた小説と一致するかを確認する。
        const [chapter] = await ctx.db
          .select()
          .from(chapters)
          .where(eq(chapters.id, section.chapterId));
        if (!isSectionInScope(scopedNovelId, chapter)) {
          return {
            error:
              '指定された節が見つかりません（他の小説に属しているため、現在の相談対象からは参照できません）。',
          };
        }
        return {
          sectionId: section.id,
          title: section.title,
          summary: truncateText(section.summary),
          content: content ? truncateText(content.body) : '（本文はまだ作成されていません）',
        };
      },
    }),

    getForeshadowings: scopedTool({
      description:
        '小説に登録されている伏線の一覧、進捗状況（未回収/回収済/破棄）、詳細説明を取得します。',
      parameters: z.object({
        novelId: z.string().optional().describe('対象の小説ID（省略時は現在の相談対象小説）'),
        status: z
          .enum(['unresolved', 'resolved', 'abandoned'])
          .optional()
          .describe(
            '伏線のステータスで絞り込み（unresolved: 未回収, resolved: 回収済, abandoned: 破棄）',
          ),
      }),
      resolve: ({ novelId }) => resolveNovelId(novelId),
      errorMessage: '伏線情報の取得に失敗しました。',
      run: async (targetId, { status }) => {
        let list = await foreshadowingService.getForeshadowingsByNovel(targetId);
        if (status) {
          list = list.filter((f) => f.status === status);
        }
        const trunc = truncateList(list, MAX_STRUCTURE_ITEMS);
        return {
          count: list.length,
          ...(trunc.notice ? { truncated: trunc.notice } : {}),
          foreshadowings: trunc.items.map((f) => ({
            id: f.id,
            title: f.title,
            status: f.status,
            description: truncateText(f.description),
            placedSectionId: f.placedSectionId,
            resolvedSectionId: f.resolvedSectionId,
            createdAt: f.createdAt,
          })),
        };
      },
    }),

    getTimelines: scopedTool({
      description: '作中の時系列・年表イベントの一覧を取得します。',
      parameters: z.object({
        novelId: z.string().optional().describe('対象の小説ID（省略時は現在の相談対象小説）'),
      }),
      resolve: ({ novelId }) => resolveNovelId(novelId),
      errorMessage: 'タイムライン情報の取得に失敗しました。',
      run: async (targetId) => {
        const list = await timelineService.listTimelines(targetId);
        const trunc = truncateList(list, MAX_STRUCTURE_ITEMS);
        return {
          count: list.length,
          ...(trunc.notice ? { truncated: trunc.notice } : {}),
          timelines: trunc.items.map((t) => ({
            id: t.id,
            event: truncateText(t.event),
            timestamp: t.timestamp,
            order: t.order,
            sectionId: t.sectionId,
          })),
        };
      },
    }),

    searchNovelKnowledge: scopedTool({
      description:
        '質問やキーワードに関連する小説情報（設定・人物・本文等）をセマンティック検索（ベクトル検索）します。',
      parameters: z.object({
        query: z.string().describe('検索キーワードまたは質問文'),
        novelId: z.string().optional().describe('対象の小説ID（省略時は現在の相談対象小説）'),
      }),
      resolve: ({ novelId }) => resolveNovelId(novelId),
      errorMessage: '関連ナレッジの検索に失敗しました。',
      run: async (targetId, { query }) => {
        const ragResult = await searchContext(
          ctx.vectorStore,
          ctx.embedding,
          targetId,
          { query },
          ctx.env,
        );
        // セマンティック検索結果もカテゴリごとに件数上限を適用する（topK 超過に備える）。
        const charTrunc = truncateList(ragResult.characters, MAX_SEARCH_ITEMS);
        const settingTrunc = truncateList(ragResult.settings, MAX_SEARCH_ITEMS);
        return {
          ...(charTrunc.notice || settingTrunc.notice
            ? {
                truncated:
                  [charTrunc.notice, settingTrunc.notice].filter(Boolean).join(' / ') || null,
              }
            : {}),
          characters: charTrunc.items.map((c) => truncateText(c)),
          settings: settingTrunc.items.map((s) => truncateText(s)),
        };
      },
    }),
  };
}
