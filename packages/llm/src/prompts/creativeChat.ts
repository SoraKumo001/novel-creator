import { renderPromptTemplate } from "../templateEngine.js";
import { getPromptTemplate } from "./loader.js";

/**
 * 小説創作相談チャット用のシステムプロンプトを構築する。
 */
export interface CreativeChatContext {
  additionalContext?: string[];
  characters?: string[];
  novel?: {
    title: string;
    description?: string | null;
    styleGuide?: string | null;
  };
  settings?: string[];
  styleGuide?: string | null;
}

// アプリ機能カタログ（出典: doc/features-and-workflows.md — 内容を更新する際はそちらも参照のこと）
export const APP_USAGE_GUIDE = `- 基本の流れ: ①概要 (Alt+1: 執筆スタイル・文体ガイド設定含む) → ②構想 (Alt+2: ストーリー構想・あらすじ相談) → ③人物 (Alt+3) → ④設定 (Alt+4) → ⑤伏線管理 (Alt+5) → ⑥タイムライン (Alt+6) → ⑦プロット (Alt+7) → ⑧本文執筆 (Alt+8) → ⑨エクスポート
- 創作チャット: アイデア出し・相談・壁打ち。会話から構想・人物・設定・伏線・年表・プロットを抽出してワンクリックで小説へ反映可能
- 人物・設定管理: GUIフォーム / Markdown一括編集、スラッシュ（/）区切りの複数階層カテゴリ（例: 採取ギルド / 幹部 / ギルド長）、AI下書き生成、セクション単位のAI編集
- プロット・章・節管理: プロットの段階的生成、章・節の並べ替え、あらすじ同期
- 本文執筆: AIインライン推敲（Ctrl+K）、ルビ記法（｜漢字《るび》）や傍点（《《強調》》）プレビュー、縦書きプレビュー、文字数目標
- 整合性・分析: 口調・一人称ブレチェック、設定影響分析、伏線・時系列管理、感情アーク図、4ペルソナ模擬査読
- 校正・履歴・出力: AI校正、編集差分履歴・復元、全文エクスポート（txt/markdown）`;

export function creativeChatSystemPrompt(
  context?: CreativeChatContext
): string {
  let novelContext = "";
  if (context?.novel) {
    novelContext += `\n\n# 現在相談中の小説情報
- タイトル: ${context.novel.title}
- あらすじ・概要: ${context.novel.description || "（未設定）"}`;

    const guide = context.styleGuide || context.novel.styleGuide;
    if (guide?.trim()) {
      novelContext += `\n\n# 登録済みの執筆スタイル・文体ガイドライン\n${guide.trim()}`;
    }

    if (context.settings && context.settings.length > 0) {
      novelContext += `\n\n# 登録済みの世界観・設定情報\n${context.settings.map((s) => `- ${s}`).join("\n")}`;
    }

    if (context.characters && context.characters.length > 0) {
      novelContext += `\n\n# 登録済みの登場人物情報\n${context.characters.map((c) => `- ${c}`).join("\n")}`;
    }

    if (context.additionalContext && context.additionalContext.length > 0) {
      novelContext += `\n\n# 関連する追加コンテキスト\n${context.additionalContext.map((c) => `- ${c}`).join("\n")}`;
    }
  } else {
    novelContext +=
      "\n\n# コンテキスト\n現在、特定の小説は選択されていません。汎用的な小説・創作の相談として応対してください。";
  }

  const template = getPromptTemplate("creativeChat");
  return renderPromptTemplate(template.body, {
    appUsageGuide: APP_USAGE_GUIDE,
    novelContext,
  });
}
