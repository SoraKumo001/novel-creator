import { z } from 'zod';
import type { ServiceContext } from '../types.js';
import { scopedTool } from './scopedTool.js';

/**
 * 創作相談チャット用の小説設定提案ツール群（Propose Tools）。
 * LLMは会話中に設定や伏線・プロットの作成・更新を提案するためにこれらのツールを呼び出す。
 * ツール実行時はDBを直接破壊・変更せず、フロントエンドで承認（Human-in-the-loop）するための
 * 構造化された提案ペイロードを返す。
 */
export function createProposeTools(
  _ctx: ServiceContext,
  defaultNovelId?: string | null,
): Record<string, unknown> {
  const resolveNovelId = (providedId?: string | null): string | null => {
    return providedId || defaultNovelId || null;
  };

  return {
    proposeCreateCharacter: scopedTool({
      description:
        '新しい登場人物（キャラクター）の登録をユーザーに提案します。会話の中で新しい人物が考案されたり固まった場合に使用してください。',
      parameters: z.object({
        novelId: z.string().optional().describe('対象の小説ID（省略時は現在の相談対象小説）'),
        name: z.string().describe('キャラクター名'),
        category: z
          .string()
          .optional()
          .default('未分類')
          .describe('役割・身分（例: 主人公, ヒロイン, 敵役, 師匠, 騎士団長 など）'),
        description: z.string().describe('外見、性格、背景、能力、動機などの詳細説明'),
        traits: z
          .array(z.string())
          .optional()
          .default([])
          .describe('特徴・キーワードの配列（例: ["銀髪", "冷静沈着", "炎魔法"]）'),
      }),
      resolve: ({ novelId }) => resolveNovelId(novelId),
      errorMessage: 'キャラクター登録提案の生成に失敗しました。',
      run: (targetId, { name, category = '未分類', description, traits = [] }) => ({
        type: 'proposal',
        proposalType: 'character',
        novelId: targetId,
        data: {
          name,
          category,
          description,
          traits,
        },
        summary: `登場人物「${name}」の設定登録提案`,
      }),
    }),

    proposeCreateSetting: scopedTool({
      description:
        '新しい世界観・設定（用語、地理、魔法体系、組織、アイテムなど）の登録をユーザーに提案します。会話の中で新しい設定が考案された場合に使用してください。',
      parameters: z.object({
        novelId: z.string().optional().describe('対象の小説ID（省略時は現在の相談対象小説）'),
        name: z.string().describe('設定の名称'),
        category: z
          .string()
          .describe(
            'カテゴリ（例: 世界観, 魔法・技術, 地理・場所, 組織・国家, 歴史・事件, アイテム）',
          ),
        description: z.string().describe('設定の詳細説明や作中ルール'),
      }),
      resolve: ({ novelId }) => resolveNovelId(novelId),
      errorMessage: '設定登録提案の生成に失敗しました。',
      run: (targetId, { name, category, description }) => ({
        type: 'proposal',
        proposalType: 'setting',
        novelId: targetId,
        data: {
          name,
          category,
          description,
        },
        summary: `世界観設定「${name}」(${category})の登録提案`,
      }),
    }),

    proposeAddForeshadowing: scopedTool({
      description:
        '新しい伏線の登録をユーザーに提案します。作中に散りばめる謎や回収計画が考案された場合に使用してください。',
      parameters: z.object({
        novelId: z.string().optional().describe('対象の小説ID（省略時は現在の相談対象小説）'),
        title: z.string().describe('伏線のタイトル・概要'),
        description: z.string().describe('伏線の詳細、真相、回収アイデア'),
        status: z
          .enum(['unresolved', 'resolved', 'abandoned'])
          .optional()
          .default('unresolved')
          .describe('ステータス（通常は unresolved）'),
      }),
      resolve: ({ novelId }) => resolveNovelId(novelId),
      errorMessage: '伏線登録提案の生成に失敗しました。',
      run: (targetId, { title, description, status = 'unresolved' }) => ({
        type: 'proposal',
        proposalType: 'foreshadowing',
        novelId: targetId,
        data: {
          title,
          description,
          status,
        },
        summary: `伏線「${title}」の登録提案`,
      }),
    }),

    proposeAddTimelineEvent: scopedTool({
      description: '作中の時系列・年表への新しい出来事（イベント）の追加をユーザーに提案します。',
      parameters: z.object({
        novelId: z.string().optional().describe('対象の小説ID（省略時は現在の相談対象小説）'),
        event: z.string().describe('出来事・イベントの内容'),
        timestamp: z
          .string()
          .optional()
          .describe('作中時期や日時・順序を表す文字列（例: 帝都暦742年、物語開始直前など）'),
      }),
      resolve: ({ novelId }) => resolveNovelId(novelId),
      errorMessage: '年表イベント追加提案の生成に失敗しました。',
      run: (targetId, { event, timestamp }) => ({
        type: 'proposal',
        proposalType: 'timeline',
        novelId: targetId,
        data: {
          event,
          timestamp: timestamp || null,
        },
        summary: `年表イベント「${event}」の追加提案`,
      }),
    }),

    proposeUpdatePlot: scopedTool({
      description: '章のプロット・あらすじの作成または更新をユーザーに提案します。',
      parameters: z.object({
        novelId: z.string().optional().describe('対象の小説ID（省略時は現在の相談対象小説）'),
        chapterTitle: z.string().describe('章のタイトル（例: 第1章 旅立ち）'),
        summary: z.string().describe('提案する章のあらすじ・プロット内容'),
      }),
      resolve: ({ novelId }) => resolveNovelId(novelId),
      errorMessage: 'プロット反映提案の生成に失敗しました。',
      run: (targetId, { chapterTitle, summary }) => ({
        type: 'proposal',
        proposalType: 'plot',
        novelId: targetId,
        data: {
          chapterTitle,
          summary,
        },
        summary: `章「${chapterTitle}」のプロット反映提案`,
      }),
    }),

    proposeUpdateStoryOutline: scopedTool({
      description:
        'ストーリー構想（全体のあらすじ、序盤、中盤、今後の展開、結末など）への追加・更新・ブラッシュアップをユーザーに提案します。会話で良いあらすじや結末案、展開案がまとまった際に使用してください。',
      parameters: z.object({
        novelId: z.string().optional().describe('対象の小説ID（省略時は現在の相談対象小説）'),
        sectionName: z
          .string()
          .describe(
            '反映先セクションまたは見出し名（例: 全体あらすじ, 結末・エンディング, 今後の展開候補, 承（中盤・展開）など）',
          ),
        content: z.string().describe('提案するマークダウン内容・あらすじ・結末テキスト'),
      }),
      resolve: ({ novelId }) => resolveNovelId(novelId),
      errorMessage: 'ストーリー構想更新提案の生成に失敗しました。',
      run: (targetId, { sectionName, content }) => ({
        type: 'proposal',
        proposalType: 'story_outline',
        novelId: targetId,
        data: {
          sectionName,
          content,
        },
        summary: `ストーリー構想「${sectionName}」の更新提案`,
      }),
    }),
  };
}
