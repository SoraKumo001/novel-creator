import type { UIMessage } from "ai";
import { createContext } from "react";
import type {
  ChatMessage,
  StreamingProgress,
} from "@/hooks/useChatStreaming.js";
import type { ChatSession } from "@/lib/types.js";

export type { ChatMessage } from "@/hooks/useChatStreaming.js";

export interface QuickPrompt {
  description: string;
  icon: string;
  id: string;
  prompt: string;
  title: string;
}

/**
 * エディタからチャットへ渡す相談フォーカス情報。
 * 「この設定/人物について相談」ボタンから openChat に渡され、
 * ChatDrawer が入力欄へのプリフィルに消費する。
 */
export interface ChatFocusContext {
  entityType:
    | "character"
    | "setting"
    | "foreshadowing"
    | "section"
    | "selection"
    | "markdown_section";
  /** 選択中のテキスト（ある場合） */
  selectedText?: string;
  /** category / 概要 / セクション本文など */
  summary?: string;
  /** 例: 設定「大まかなあらすじ」/ 人物「主人公」/ 第1話「プロローグ」/ 選択テキスト */
  title: string;
}

export const QUICK_PROMPTS: QuickPrompt[] = [
  {
    id: "character-ideas",
    title: "登場人物のアイデア出し",
    description: "世界観に合う魅力的な登場人物案を複数提案",
    prompt:
      "この小説の世界観や設定に合う、魅力的で個性的な新しい登場人物のアイデアを3名ほど提案してください。それぞれの【名前】【役割/身分】【外見・特徴】【性格】【能力/特技】【物語上の動機/目的】【既存キャラとの関係性案】を構造化してまとめてください。",
    icon: "🎭",
  },
  {
    id: "setting-expand",
    title: "世界観・設定の深掘り",
    description: "魔法・文化・地理・組織などの設定を具体化",
    prompt:
      "この小説の世界観設定をより深みのあるものにするためのアイデアを提案してください。特に、魔法/技術体系、国家・組織の対立構造、地理的特徴、文化・風習などの観点から、物語の面白さに直結する要素を具体的に掘り下げてください。",
    icon: "🌍",
  },
  {
    id: "plot-ideas",
    title: "プロット・展開の壁打ち",
    description: "中盤の山場やどんでん返しの展開案をブレスト",
    prompt:
      "この小説のストーリー展開について相談です。読者を惹きつける「中盤の転換点（ツイスト）」や「クライマックスへの盛り上がり」につながる展開のアイデアをいくつか提示してください。伏線やキャラクターの葛藤も絡めた案をお願いします。",
    icon: "📖",
  },
  {
    id: "consistency-check",
    title: "設定・人物の矛盾チェック",
    description: "登録済み設定や人物間の整合性をレビュー",
    prompt:
      "現在登録されている小説情報、世界観設定、登場人物情報を確認し、論理的な矛盾や設定の甘さ、あるいは「もっとこうすると面白くなる・整合性が高まる」改善点があれば指摘・提案してください。",
    icon: "🔍",
  },
  {
    id: "app-usage-guide",
    title: "アプリの使い方を教えて",
    description: "主要機能の場所と簡単な手順を案内",
    prompt:
      "アプリの使い方を教えてください。主要な機能と、その場所（画面やタブ）と簡単な手順を、初心者にも分かるようにまとめてください。",
    icon: "💡",
  },
];

/**
 * 低頻度 context: チャットの開閉・フォーカス・小説/セッション選択など操作系。
 * ストリーミング中（チャンク毎の更新）でも value の参照が変わらないため、
 * Nav / Layout / 各エディタなどの consumer はストリーミングの影響を受けない。
 */
export interface ChatUIContextValue {
  /** openChat に渡された未消費の相談フォーカス（プリフィル用） */
  chatFocus: ChatFocusContext | null;
  clearMessages: () => void;
  closeChat: () => void;
  /** chatFocus を消費済みにする（二重プリフィル防止） */
  consumeFocus: () => void;
  createSession: (
    novelId?: string | null,
    initialTitle?: string
  ) => Promise<ChatSession | null>;
  currentSession: ChatSession | null;
  currentSessionId: string | null;
  deleteSession: (sessionId: string) => Promise<void>;
  isOpen: boolean;
  loadingMessages: boolean;
  loadingSessions: boolean;
  openChat: (targetNovelId?: string | null, focus?: ChatFocusContext) => void;
  refreshSessions: () => Promise<void>;
  selectedModelConfigId: string | null;
  selectedNovelId: string | null;
  selectSession: (sessionId: string) => Promise<void>;

  // セッション関連
  sessions: ChatSession[];
  setSelectedModelConfigId: (id: string | null) => void;
  setSelectedNovelId: (id: string | null) => void;

  startNewChat: () => void;
  toggleChat: () => void;
  updateSessionTitle: (sessionId: string, newTitle: string) => Promise<boolean>;
}

/**
 * 高頻度 context: メッセージ一覧とストリーミング状態。
 * ストリーミング中はチャンク毎に value が新しくなるため、
 * ここを購読する consumer は ChatDrawer（転写領域）など表示に直接関係するものに限定する。
 */
export interface ChatStreamingContextValue {
  abortStream: () => void;
  clearError: () => void;
  error: string | null;
  isStreaming: boolean;
  lastPrompt: string | null;
  messages: ChatMessage[];
  /** バックエンド（data-progress パーツ）由来のリアルタイム進捗。isStreaming 中のみ非 null */
  progress: StreamingProgress | null;
  retryLastMessage: () => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  streamingContent: string;
  /** ストリーミング中のアシスタントメッセージの生 parts（ツール呼び出しの随時表示用） */
  streamingParts: UIMessage["parts"] | null;
}

export const ChatUIContext = createContext<ChatUIContextValue | null>(null);
export const ChatStreamingContext =
  createContext<ChatStreamingContextValue | null>(null);
