/**
 * 小説情報（タイトル・あらすじ・登場人物・設定）から
 * 執筆スタイル・文体ガイドラインのドラフトを自動生成するプロンプト。
 */

export interface GenerateStyleGuideDraftContext {
  novelTitle: string;
  description?: string | null;
  characters?: string[];
  settings?: string[];
}

export function generateStyleGuideDraftPrompt(context: GenerateStyleGuideDraftContext): string {
  const characters = context.characters?.length
    ? context.characters.map((c) => `- ${c}`).join('\n')
    : '（登録なし）';
  const settings = context.settings?.length
    ? context.settings.map((s) => `- ${s}`).join('\n')
    : '（登録なし）';

  return `あなたはプロの文芸編集者・小説作法ディレクターです。
以下の小説の基本情報、あらすじ、登場人物、世界観設定を分析し、
この作品の魅力・世界観・テンポを最大限に引き出す「執筆スタイル・文体ガイドライン（Markdown形式）」の最適なドラフトを作成してください。

# 小説情報
- 作品タイトル: ${context.novelTitle}
- あらすじ・概要: ${context.description || '（未設定）'}

# 登場人物
${characters}

# 世界観・設定
${settings}

# 生成の指針
1. **視点・人称の選定**: 作品のジャンル（ライトノベル、ハイファンタジー、現代日常、群像劇等）や主人公の性格に最適な視点（一人称/三人称一元等）と一人称（俺/私/僕等）を提案・定義してください。
2. **文体・トーンの定義**: 作品の雰囲気に合わせた文体（軽快、重厚、叙情、コミカル、ハードボイルド等）や地の文と会話のバランスを明記してください。
3. **作法・表記ルール**: 三点リーダー・ダッシュの2連使用、会話文末の句点ルール、ルビ記法（|親文字《るび》）の活用方針などを盛り込んでください。
4. **NG・禁止事項**: 視点ブレ防止や、世界観にそぐわない言葉遣いの禁止などを具体的に記述してください。
5. **シーン別・演出方針**: バトル、心理描写、コメディ掛け合いなど、この作品ならではの演出ポイントがあれば追加してください。
6. **Markdown形式のみを出力**: 見出し（#、##）や箇条書き（-）を用いて構造化し、解説や前置き等の不要なテキストは含めず、ガイドラインのMarkdownテキストのみを出力してください。`;
}
