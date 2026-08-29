import { tool } from 'ai';
import { z } from 'zod';
import type { ServiceContext } from '../types.js';
import { NovelDomainService } from '../novel.service.js';
import { CharacterDomainService } from '../character.service.js';
import { SettingDomainService } from '../setting.service.js';
import { ChapterDomainService } from '../chapter.service.js';
import { SectionDomainService } from '../section.service.js';
import { ForeshadowingDomainService } from '../foreshadowing.service.js';
import { TimelineDomainService } from '../timeline.service.js';
import { searchContext } from '../../rag.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createTool = tool as any;

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
    getNovelInfo: createTool({
      description: '小説の基本情報（タイトル、あらすじ、概要）を取得します。',
      parameters: z.object({
        novelId: z.string().optional().describe('対象の小説ID（省略時は現在の相談対象小説）'),
      }),
      execute: async ({ novelId }: { novelId?: string }) => {
        const targetId = resolveNovelId(novelId);
        if (!targetId) {
          return { error: '対象の小説が指定されていません。' };
        }
        try {
          const detail = await novelService.getNovelDetail(targetId);
          return {
            id: detail.novel.id,
            title: detail.novel.title,
            description: detail.novel.description,
            chapterCount: detail.chapters.length,
            characterCount: detail.characters.length,
            settingCount: detail.settings.length,
            createdAt: detail.novel.createdAt,
            updatedAt: detail.novel.updatedAt,
          };
        } catch {
          return { error: '指定された小説が見つかりませんでした。' };
        }
      },
    }),

    getCharacters: createTool({
      description:
        '小説に登場するキャラクター一覧または特定のキャラクターの詳細を取得します。名前やカテゴリで絞り込み可能です。',
      parameters: z.object({
        novelId: z.string().optional().describe('対象の小説ID（省略時は現在の相談対象小説）'),
        name: z.string().optional().describe('検索するキャラクター名またはキーワード（部分一致）'),
        category: z.string().optional().describe('キャラクターカテゴリ（主要人物、敵役など）'),
      }),
      execute: async ({
        novelId,
        name,
        category,
      }: {
        novelId?: string;
        name?: string;
        category?: string;
      }) => {
        const targetId = resolveNovelId(novelId);
        if (!targetId) {
          return { error: '対象の小説が指定されていません。' };
        }
        try {
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
            characters: list.map((c) => ({
              id: c.id,
              name: c.name,
              category: c.category,
              description: c.description,
              traits: c.traits,
            })),
          };
        } catch {
          return { error: 'キャラクター情報の取得に失敗しました。' };
        }
      },
    }),

    getSettings: createTool({
      description:
        '小説の世界観・設定（用語、地理、魔法、組織、アイテム等）の一覧または特定設定の詳細を取得します。',
      parameters: z.object({
        novelId: z.string().optional().describe('対象の小説ID（省略時は現在の相談対象小説）'),
        name: z.string().optional().describe('検索する設定名またはキーワード（部分一致）'),
        category: z.string().optional().describe('設定カテゴリ（世界観、地理、魔法体系など）'),
      }),
      execute: async ({
        novelId,
        name,
        category,
      }: {
        novelId?: string;
        name?: string;
        category?: string;
      }) => {
        const targetId = resolveNovelId(novelId);
        if (!targetId) {
          return { error: '対象の小説が指定されていません。' };
        }
        try {
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
            settings: list.map((s) => ({
              id: s.id,
              name: s.name,
              category: s.category,
              description: s.description,
            })),
          };
        } catch {
          return { error: '設定情報の取得に失敗しました。' };
        }
      },
    }),

    getPlotAndChapters: createTool({
      description:
        '小説の全章（Chapter）および各節（Section）の構成、プロット・あらすじ一覧を取得します。',
      parameters: z.object({
        novelId: z.string().optional().describe('対象の小説ID（省略時は現在の相談対象小説）'),
      }),
      execute: async ({ novelId }: { novelId?: string }) => {
        const targetId = resolveNovelId(novelId);
        if (!targetId) {
          return { error: '対象の小説が指定されていません。' };
        }
        try {
          const chapters = await chapterService.listChapters(targetId);
          const chaptersWithSections = await Promise.all(
            chapters.map(async (ch) => {
              const sections = await sectionService.listSections(ch.id);
              return {
                id: ch.id,
                title: ch.title,
                order: ch.order,
                summary: ch.summary,
                sections: sections.map((sec) => ({
                  id: sec.id,
                  title: sec.title,
                  order: sec.order,
                  summary: sec.summary,
                })),
              };
            }),
          );
          return {
            chapterCount: chaptersWithSections.length,
            chapters: chaptersWithSections,
          };
        } catch {
          return { error: '章・プロット情報の取得に失敗しました。' };
        }
      },
    }),

    getSectionContent: createTool({
      description: '指定された節（Section）の本文テキストを取得します。',
      parameters: z.object({
        sectionId: z.string().describe('取得対象の節ID（Section ID）'),
      }),
      execute: async ({ sectionId }: { sectionId: string }) => {
        try {
          const { section, content } = await sectionService.getSectionWithContent(sectionId);
          return {
            sectionId: section.id,
            title: section.title,
            summary: section.summary,
            content: content ? content.body : '（本文はまだ作成されていません）',
          };
        } catch {
          return { error: '指定された節または本文が見つかりませんでした。' };
        }
      },
    }),

    getForeshadowings: createTool({
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
      execute: async ({
        novelId,
        status,
      }: {
        novelId?: string;
        status?: 'unresolved' | 'resolved' | 'abandoned';
      }) => {
        const targetId = resolveNovelId(novelId);
        if (!targetId) {
          return { error: '対象の小説が指定されていません。' };
        }
        try {
          let list = await foreshadowingService.getForeshadowingsByNovel(targetId);
          if (status) {
            list = list.filter((f) => f.status === status);
          }
          return {
            count: list.length,
            foreshadowings: list.map((f) => ({
              id: f.id,
              title: f.title,
              status: f.status,
              description: f.description,
              placedSectionId: f.placedSectionId,
              resolvedSectionId: f.resolvedSectionId,
              createdAt: f.createdAt,
            })),
          };
        } catch {
          return { error: '伏線情報の取得に失敗しました。' };
        }
      },
    }),

    getTimelines: createTool({
      description: '作中の時系列・年表イベントの一覧を取得します。',
      parameters: z.object({
        novelId: z.string().optional().describe('対象の小説ID（省略時は現在の相談対象小説）'),
      }),
      execute: async ({ novelId }: { novelId?: string }) => {
        const targetId = resolveNovelId(novelId);
        if (!targetId) {
          return { error: '対象の小説が指定されていません。' };
        }
        try {
          const list = await timelineService.listTimelines(targetId);
          return {
            count: list.length,
            timelines: list.map((t) => ({
              id: t.id,
              event: t.event,
              timestamp: t.timestamp,
              order: t.order,
              sectionId: t.sectionId,
            })),
          };
        } catch {
          return { error: 'タイムライン情報の取得に失敗しました。' };
        }
      },
    }),

    searchNovelKnowledge: createTool({
      description:
        '質問やキーワードに関連する小説情報（設定・人物・本文等）をセマンティック検索（ベクトル検索）します。',
      parameters: z.object({
        query: z.string().describe('検索キーワードまたは質問文'),
        novelId: z.string().optional().describe('対象の小説ID（省略時は現在の相談対象小説）'),
      }),
      execute: async ({ query, novelId }: { query: string; novelId?: string }) => {
        const targetId = resolveNovelId(novelId);
        if (!targetId) {
          return { error: '対象の小説が指定されていません。' };
        }
        try {
          const ragResult = await searchContext(
            ctx.vectorStore,
            ctx.embedding,
            targetId,
            { query },
            ctx.env,
          );
          return {
            characters: ragResult.characters,
            settings: ragResult.settings,
          };
        } catch {
          return { error: '関連ナレッジの検索に失敗しました。' };
        }
      },
    }),
  };
}
