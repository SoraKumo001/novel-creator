/**
 * OverviewView の分析4ボタンと EditorToolbar のAI推敲メニューの共通データ定義。
 * id / icon / label / description のデータのみを持ち、
 * onClick 等のハンドラや表示条件は呼び出し側で付与する設計。
 */
export interface AnalysisActionDef {
  description: string;
  icon: string;
  id: string;
  label: string;
}

/** OverviewView「ストーリー分析 & 創作レビュー」カードの4ボタン。 */
export const OVERVIEW_ANALYSIS_ACTIONS: readonly AnalysisActionDef[] = [
  {
    id: "story-arc",
    icon: "📈",
    label: "感情アーク & テンション",
    description: "全章節の盛り上がり度・緊張感の起伏をグラフで可視化・診断",
  },
  {
    id: "voice-check",
    icon: "🎭",
    label: "キャラクター口調チェッカー",
    description: "一人称・二人称・語尾のブレやキャラ崩壊を一括検出",
  },
  {
    id: "persona-review",
    icon: "👥",
    label: "模擬読者・編集部レビュー",
    description: "商業編集者や考察派ファン等4名のペルソナが作品を査読",
  },
  {
    id: "heatmap",
    icon: "📊",
    label: "人物出現頻度ヒートマップ",
    description: "誰がどの章に出ているかをマトリックス表示し出番偏りを防止",
  },
];

/**
 * EditorToolbar「AI推敲・分析」メニューの項目。
 * 実行中の文言変化（例: 抽出中...）や表示条件は呼び出し側で扱う。
 */
export const EDITOR_AI_MENU_ACTIONS: readonly AnalysisActionDef[] = [
  {
    id: "proofread",
    icon: "✨",
    label: "本文校正・推敲",
    description: "誤字・文体・視点ブレを点検",
  },
  {
    id: "voice-check",
    icon: "🎭",
    label: "口調・一貫性チェック",
    description: "人物設定とセリフのズレを検出",
  },
  {
    id: "persona-review",
    icon: "👥",
    label: "4ペルソナ模擬査読",
    description: "編集者・読者・評論家レビュー",
  },
  {
    id: "chat",
    icon: "💬",
    label: "チャットで相談・壁打ち",
    description: "この話の展開や設定をAIと相談",
  },
  {
    id: "custom-prompts",
    icon: "🪄",
    label: "カスタムプロンプト管理",
    description: "推敲・生成プロンプトの作成・編集",
  },
  {
    id: "extract",
    icon: "⚡",
    label: "整合性更新（設定抽出）",
    description: "本文から新設定・年表を抽出",
  },
];
