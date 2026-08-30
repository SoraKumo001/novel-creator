/**
 * ストーリー構想（あらすじ・今後の展開・結末・メモ等）をマークダウン文書として直列化・解析・編集するユーティリティ。
 */

import {
  buildMarkdownCategoryTree,
  findSectionByLine,
  scanMarkdownSections,
  type MarkdownCategoryNode,
} from './markdownCore.js';

/** フォーカストラッキング用のストーリー構想セクション情報（行範囲付き）。 */
export interface StoryOutlineSectionRange {
  category: string;
  title: string;
  name: string;
  /** `#` または `##` 見出し行の 0 始まり行番号。 */
  headingLine: number;
  /** 本文開始行（見出しの次行）の 0 始まり行番号。 */
  startLine: number;
  /** 本文終端行（次の見出しの前行、または文書末尾）の 0 始まり行番号（含む）。 */
  endLine: number;
  /** セクション本文。 */
  content: string;
}

/** ツリーノード。 */
export type StoryOutlineCategoryNode = MarkdownCategoryNode;

/**
 * マークダウン文書を走査し、行範囲情報を含むセクション配列を返す。
 */
export function scanStoryOutlineSectionRanges(markdown: string): StoryOutlineSectionRange[] {
  const rawSections = scanMarkdownSections(markdown);
  return rawSections.map((raw) => {
    const cleanBodyLines = [...raw.bodyLines];
    while (cleanBodyLines.length > 0 && cleanBodyLines[0].trim() === '') cleanBodyLines.shift();
    while (cleanBodyLines.length > 0 && cleanBodyLines[cleanBodyLines.length - 1].trim() === '') {
      cleanBodyLines.pop();
    }

    return {
      category: raw.category,
      title: raw.name,
      name: raw.name,
      headingLine: raw.headingLine,
      startLine: raw.startLine,
      endLine: raw.endLine,
      content: cleanBodyLines.join('\n'),
    };
  });
}

/**
 * カーソル位置（0 始まり行番号）から所属する構想セクションを特定する。
 */
export function findStoryOutlineSectionByLine(
  markdown: string,
  lineNumber: number,
): StoryOutlineSectionRange | null {
  const ranges = scanStoryOutlineSectionRanges(markdown);
  return findSectionByLine(ranges, lineNumber);
}

/**
 * マークダウンからカテゴリ構造ツリーを構築する。
 */
export function buildStoryOutlineCategoryTree(markdown: string): StoryOutlineCategoryNode[] {
  return buildMarkdownCategoryTree(markdown);
}

/**
 * ストーリー構想のプリセットテンプレート一覧
 */
export interface StoryOutlineTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
}

export const STORY_OUTLINE_TEMPLATES: StoryOutlineTemplate[] = [
  {
    id: 'standard_kishotenketsu',
    name: '起承転結・標準テンプレート',
    description: '王道構成。全体のログラインから導入、中盤の展開、結末までを網羅',
    template: `# 作品コンセプト & ログライン
- **ログライン（1行要約）**:
- **テーマ**:
- **ターゲット読者・読後感**:

# 全体あらすじ
（ここに作品全体の概要・あらすじを記入）

# ストーリー構成
## 起（序盤・導入）
- **日常と発端**:
- **主人公の目的・動機**:

## 承（中盤・展開）
- **旅立ち・試練**:
- **仲間やライバルとの出会い**:

## 転（転換点・クライマックス）
- **最大の危機・衝撃の事実**:
- **決戦・選択**:

## 結（結末・エンディング）
- **事件の解決・結末**:
- **主人公の変化・余韻・後日談**:

# 今後の展開候補 & 分岐アイデア
- 案A:
- 案B:

# 構想メモ & 未解決の課題
- [ ]
`,
  },
  {
    id: 'three_act_structure',
    name: '三幕構成テンプレート',
    description: 'ハリウッド映画やエンタメ小説の標準。設定・対立・解決の3フェーズ',
    template: `# コンセプト & ログライン
- **ログライン**:
- **主眼・メッセージ**:

# 全体あらすじ


# 第1幕：設定（Setup）
## 日常の世界とインサイティング・インシデント（事件の引き金）
-

## プロットポイント1（後戻りできない決断）
-

# 第2幕：対立（Confrontation）
## 試練・障害とミッドポイント（重大な転換）
-

## プロットポイント2（最大の危機・オール・イズ・ロスト）
-

# 第3幕：解決（Resolution）
## クライマックス（最終対決・真実の対峙）
-

## 結末（新しい日常・エピローグ）
-

# 検討中の展開・結末メモ
-
`,
  },
  {
    id: 'web_novel_serialized',
    name: 'Web小説・連載向け構成テンプレート',
    description: '序盤の強い引き、テンポの良い中盤、読者を惹きつける引きとクライマックス',
    template: `# タイトル案 & キャッチコピー
- **キャッチコピー**:
- **あらすじ（Web掲載用）**:

# メインギミック・主人公の強み
- **主人公の独自能力/特徴**:
- **周囲の反応・カタルシスポイント**:

# 第1部：導入と初期の無双・成り上がり
## 追放・覚醒・スタートダッシュ
-

## 初期イベント・最初の大きな勝利
-

# 第2部：世界の広がりとライバル・強敵
## 新たな勢力との接触
-

## 危機・今後の展開候補
-

# 最終章：大決戦と大団円
## クライマックス
-

## 結末・エピローグ
-

# 伏線・設定メモ
-
`,
  },
];
