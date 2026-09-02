import {
  type KeyboardEvent,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/Button.js";
import { LLMModelSelector } from "@/components/LLMModelSelector.js";
import { MarkdownText } from "@/components/MarkdownText.js";
import {
  type ChatFocusContext,
  type ChatMessage,
  QUICK_PROMPTS,
  type QuickPrompt,
  useChatStreamingState,
  useChatUI,
} from "@/context/ChatContext.js";
import { useNovels } from "@/hooks/useNovels.js";
import { usePinnedSessions } from "@/hooks/usePinnedSessions.js";
import { useToast } from "@/hooks/useToast.js";
import { ChatInsertEntityModal } from "./ChatInsertEntityModal.js";
import { ChatSessionList } from "./ChatSessionList.js";
import { StreamingStatus } from "./StreamingStatus.js";
import { ToolActivity } from "./ToolActivity.js";

type DrawerWidth = "normal" | "wide" | "full";
type ChatLayoutMode = "overlay" | "docked";

/** focus 情報から相談フォーカス用のプリフィルテキストを生成する（純関数・テスト可能） */
export function buildChatPrefill(focus: ChatFocusContext): string {
  if (focus.selectedText?.trim()) {
    const selected = focus.selectedText.trim();
    return `【選択中のテキスト（${focus.title}）】\n${selected}\n\nこの部分について相談したいです：\n`;
  }

  const header = `${focus.title}について相談したいです。`;
  const summary = focus.summary?.trim();
  if (!summary) {
    return `${header}\n\n`;
  }
  return `${header}\n\n--- 現在の内容 ---\n${summary}\n--- ここまで ---\n\n`;
}

interface ChatMessageItemProps {
  copiedId: string | null;
  message: ChatMessage;
  onCopy: (content: string, id: string) => void;
  onInsertEntity: (content: string) => void;
}

const ChatMessageItem = memo(function ChatMessageItem({
  message: m,
  copiedId,
  onCopy,
  onInsertEntity,
}: ChatMessageItemProps) {
  const isUser = m.role === "user";
  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
      <div className="mb-1 flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
        <span>{isUser ? "あなた" : "AIパートナー"}</span>
      </div>
      <div
        className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-sm shadow-xs ${
          isUser
            ? "rounded-br-xs bg-primary text-primary-foreground"
            : "rounded-bl-xs border border-border bg-surface-raised text-foreground"
        }`}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">{m.content}</div>
        ) : (
          <>
            {/* AI のツール呼び出し活動 & 思考プロセス（v7 パーツから抽出。無ければ非表示） */}
            <ToolActivity parts={m.parts} isStreaming={false} />
            {m.content && <MarkdownText content={m.content} />}
          </>
        )}
      </div>

      {/* アシスタントメッセージのアクションバー */}
      {!isUser && (
        <div className="mt-1 flex items-center gap-2 px-1 text-[11px] text-muted-foreground">
          <button
            type="button"
            onClick={() => onCopy(m.content, m.id)}
            className="cursor-pointer hover:text-foreground"
          >
            {copiedId === m.id ? "✓ コピー完了" : "📋 コピー"}
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={() => onInsertEntity(m.content)}
            className="cursor-pointer font-medium hover:text-primary"
          >
            📥 設定・人物へ取り込む
          </button>
        </div>
      )}
    </div>
  );
});

export function ChatDrawer() {
  // 低頻度: 開閉・フォーカス・セッション選択などの操作系
  const {
    isOpen,
    closeChat,
    chatFocus,
    consumeFocus,
    selectedNovelId,
    setSelectedNovelId,
    selectedModelConfigId,
    setSelectedModelConfigId,
    sessions,
    currentSessionId,
    currentSession,
    loadingMessages,
    startNewChat,
    selectSession,
    deleteSession,
    updateSessionTitle,
  } = useChatUI();

  // 高頻度: メッセージ・ストリーミング状態
  const {
    messages,
    isStreaming,
    streamingContent,
    streamingParts,
    progress,
    error,
    lastPrompt,
    sendMessage,
    retryLastMessage,
    clearError,
    abortStream,
  } = useChatStreamingState();

  const { novels } = useNovels();
  const toast = useToast();

  const [drawerWidth, setDrawerWidth] = useState<DrawerWidth>(
    () =>
      (localStorage.getItem("novel-creator:chat-width") as DrawerWidth) ||
      "normal"
  );
  const [layoutMode, setLayoutMode] = useState<ChatLayoutMode>(
    () =>
      (localStorage.getItem(
        "novel-creator:chat-layout-mode"
      ) as ChatLayoutMode) || "docked"
  );
  const { pinnedIds, togglePin } = usePinnedSessions();

  const [input, setInput] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showHistoryView, setShowHistoryView] = useState(false);
  const [insertModalSource, setInsertModalSource] = useState<string | null>(
    null
  );

  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isUserScrolledUpRef = useRef(false);
  const scrollRafRef = useRef<number | null>(null);

  const handleWidthChange = (width: DrawerWidth) => {
    setDrawerWidth(width);
    localStorage.setItem("novel-creator:chat-width", width);
  };

  const handleLayoutModeChange = (mode: ChatLayoutMode) => {
    setLayoutMode(mode);
    localStorage.setItem("novel-creator:chat-layout-mode", mode);
  };

  const handleMessagesScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 60;
    isUserScrolledUpRef.current = !isAtBottom;
  };

  // チャットオープン時や履歴切り替え時の初期スクロール & フォーカス
  useEffect(() => {
    if (isOpen && !showHistoryView) {
      isUserScrolledUpRef.current = false;
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop =
          messagesContainerRef.current.scrollHeight;
      }
      textareaRef.current?.focus();
    }
  }, [isOpen, showHistoryView]);

  // 新規メッセージ追加時のスクロール
  useEffect(() => {
    if (isOpen && !showHistoryView && !isUserScrolledUpRef.current) {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop =
          messagesContainerRef.current.scrollHeight;
      }
    }
  }, [messages.length, isOpen, showHistoryView]);

  // ストリーミング中の自動スクロール追従（requestAnimationFrameでスロットル & 非ブロッキング）
  useEffect(() => {
    if (!isStreaming || isUserScrolledUpRef.current) {
      return;
    }
    if (scrollRafRef.current == null) {
      scrollRafRef.current = requestAnimationFrame(() => {
        if (messagesContainerRef.current && !isUserScrolledUpRef.current) {
          messagesContainerRef.current.scrollTop =
            messagesContainerRef.current.scrollHeight;
        }
        scrollRafRef.current = null;
      });
    }
    return () => {
      if (scrollRafRef.current != null) {
        cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    };
  }, [streamingContent, streamingParts, isStreaming]);

  // エディタからの「AIと相談」フォーカスが未消費なら入力欄にプリフィルする。
  // 既存入力は上書きせず末尾へ追記し、消費後はクリアして二重プリフィルを防ぐ。
  useEffect(() => {
    if (!isOpen || !chatFocus) {
      return;
    }
    const prefill = buildChatPrefill(chatFocus);
    setInput((prev) => (prev ? `${prev}\n\n${prefill}` : prefill));
    consumeFocus();
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    });
  }, [isOpen, chatFocus, consumeFocus]);

  // 送信ハンドラ
  const handleSend = async () => {
    if (!input.trim() || isStreaming) {
      return;
    }
    const text = input;
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    await sendMessage(text);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleQuickPrompt = async (qp: QuickPrompt) => {
    await sendMessage(qp.prompt);
  };

  const handleCopy = useCallback(
    async (content: string, id: string) => {
      try {
        await navigator.clipboard.writeText(content);
        setCopiedId(id);
        toast.success("クリップボードにコピーしました");
        setTimeout(() => setCopiedId(null), 2000);
      } catch {
        toast.error("コピーに失敗しました");
      }
    },
    [toast]
  );

  const handleInsertEntity = useCallback((content: string) => {
    setInsertModalSource(content);
  }, []);

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const target = e.target;
    target.style.height = "auto";
    target.style.height = `${Math.min(target.scrollHeight, 180)}px`;
  };

  const handleStartNewChat = () => {
    setShowHistoryView(false);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    startNewChat();
  };

  const handleSelectSession = (id: string) => {
    selectSession(id);
    setShowHistoryView(false);
  };

  const handleSaveTitle = async (id: string, newTitle: string) => {
    const ok = await updateSessionTitle(id, newTitle);
    if (ok) {
      toast.success("タイトルを変更しました");
    } else {
      toast.error("タイトルの変更に失敗しました");
    }
    return ok;
  };

  const handleDeleteSession = async (id: string) => {
    try {
      await deleteSession(id);
      toast.success("相談履歴を削除しました");
    } catch {
      toast.error("削除に失敗しました");
    }
  };

  if (!isOpen) {
    return null;
  }

  const currentNovel = novels.find((n) => n.id === selectedNovelId);

  const isFull = drawerWidth === "full";

  // 幅クラス（標準 / ワイド）
  const widthClasses =
    drawerWidth === "wide"
      ? "sm:w-[680px] md:w-[760px]"
      : "sm:w-[480px] md:w-[520px]";

  const containerClasses = isFull
    ? "fixed inset-0 z-50 flex flex-col bg-surface shadow-2xl transition-all duration-200 w-screen h-screen"
    : layoutMode === "docked"
      ? `relative z-20 flex flex-col h-full shrink-0 border-l border-border bg-surface shadow-md transition-all duration-200 max-md:fixed max-md:inset-y-0 max-md:right-0 max-md:z-50 w-full ${widthClasses}`
      : `fixed inset-y-0 right-0 z-50 flex flex-col border-l border-border bg-surface shadow-2xl transition-all duration-200 w-full ${widthClasses}`;

  return (
    <aside aria-label="創作相談チャット" className={containerClasses}>
      {/* ヘッダー */}
      <header className="flex shrink-0 items-center justify-between border-border border-b bg-surface-raised/90 px-4 py-3 backdrop-blur">
        <div className="mr-3 flex min-w-0 flex-1 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-4 w-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h2
              className="truncate font-bold text-foreground text-sm"
              title={currentSession ? currentSession.title : "AI創作相談"}
            >
              {currentSession ? currentSession.title : "AI創作相談"}
            </h2>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              <span className="truncate">設定・人物・プロット壁打ち</span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {/* 配置モード切り替え（重ねる ⇔ 占有） */}
          <button
            type="button"
            onClick={() =>
              handleLayoutModeChange(
                layoutMode === "docked" ? "overlay" : "docked"
              )
            }
            className={`cursor-pointer rounded-lg border p-1.5 text-xs transition ${
              layoutMode === "docked"
                ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                : "border-border bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground"
            }`}
            title={
              layoutMode === "docked"
                ? "右側エリアを占有中（クリックで重ねて表示に変更）"
                : "重ねて表示中（クリックで右側エリアを占有して画面分割）"
            }
            aria-label="配置モード切り替え"
          >
            {layoutMode === "docked" ? (
              /* ドッキング中アイコン（右分割パネル） */
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4"
              >
                <path
                  fillRule="evenodd"
                  d="M2 4.75A2.75 2.75 0 014.75 2h10.5A2.75 2.75 0 0118 4.75v10.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25V4.75zm10.5-.75H4.75c-.69 0-1.25.56-1.25 1.25v10.5c0 .69.56 1.25 1.25 1.25H12.5V4z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              /* フローティング中アイコン（重ねる） */
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4"
              >
                <path d="M3.25 4A2.25 2.25 0 001 6.25v7.5A2.25 2.25 0 003.25 16h7.5A2.25 2.25 0 0013 13.75v-7.5A2.25 2.25 0 0010.75 4h-7.5zM15 7.25a.75.75 0 00-1.5 0v6.5c0 .414-.336.75-.75.75h-6.5a.75.75 0 000 1.5h6.5A2.25 2.25 0 0015 13.75v-6.5z" />
              </svg>
            )}
          </button>

          {/* 幅切り替え（サイクル: 標準 -> ワイド -> 全画面） */}
          <button
            type="button"
            onClick={() => {
              const nextWidth: DrawerWidth =
                drawerWidth === "normal"
                  ? "wide"
                  : drawerWidth === "wide"
                    ? "full"
                    : "normal";
              handleWidthChange(nextWidth);
            }}
            className="flex cursor-pointer items-center gap-1 rounded-lg border border-border bg-surface p-1.5 text-muted-foreground text-xs transition hover:bg-surface-hover hover:text-foreground"
            title={`チャット幅: ${
              drawerWidth === "normal"
                ? "標準 (クリックでワイド幅へ)"
                : drawerWidth === "wide"
                  ? "ワイド (クリックで全画面へ)"
                  : "全画面 (クリックで標準幅へ)"
            }`}
            aria-label="チャット幅切り替え"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path
                fillRule="evenodd"
                d="M13.2 2.24a.75.75 0 00.04 1.06l2.1 1.95H11a.75.75 0 000 1.5h4.34l-2.1 1.95a.75.75 0 101.02 1.1l3.5-3.25a.75.75 0 000-1.1l-3.5-3.25a.75.75 0 00-1.06.04zm-6.4 15.52a.75.75 0 00-.04-1.06l-2.1-1.95H9a.75.75 0 000-1.5H4.66l2.1-1.95a.75.75 0 10-1.02-1.1l-3.5 3.25a.75.75 0 000 1.1l3.5 3.25a.75.75 0 001.06-.04z"
                clipRule="evenodd"
              />
            </svg>
            <span className="font-medium text-[10px] text-muted-foreground uppercase">
              {drawerWidth === "normal"
                ? "標準"
                : drawerWidth === "wide"
                  ? "ワイド"
                  : "全画面"}
            </span>
          </button>

          {/* 新規チャットボタン */}
          <button
            type="button"
            onClick={handleStartNewChat}
            className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1.5 font-medium text-primary text-xs shadow-xs transition hover:bg-primary/10"
            title="新しい相談を始める"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-3.5 w-3.5"
            >
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            <span className="text-xs">新規</span>
          </button>

          {/* 履歴一覧切り替えボタン */}
          <button
            type="button"
            onClick={() => setShowHistoryView((prev) => !prev)}
            className={`inline-flex cursor-pointer items-center gap-1 rounded-lg border px-2 py-1.5 font-medium text-xs shadow-xs transition ${
              showHistoryView
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface text-foreground hover:bg-surface-hover"
            }`}
            title="相談履歴一覧"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-3.5 w-3.5"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-xs">{sessions.length}</span>
          </button>

          {/* 閉じるボタン */}
          <button
            type="button"
            onClick={closeChat}
            className="cursor-pointer rounded-lg p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
            title="閉じる"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </header>

      {/* 小説コンテキスト & LLMモデル選択バー */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-border border-b bg-surface-raised/50 px-4 py-2 text-xs">
        <div className="flex min-w-0 items-center gap-1.5">
          <label
            htmlFor="chat-novel-select"
            className="flex shrink-0 items-center gap-1 font-medium text-muted-foreground"
          >
            <span>📚 対象:</span>
          </label>
          <select
            id="chat-novel-select"
            value={selectedNovelId ?? ""}
            onChange={(e) =>
              setSelectedNovelId(e.target.value ? e.target.value : null)
            }
            className="max-w-45 truncate rounded border border-border bg-surface px-2 py-1 text-foreground text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">（全般相談）</option>
            {novels.map((n) => (
              <option key={n.id} value={n.id}>
                {n.title}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <LLMModelSelector
            value={selectedModelConfigId}
            onChange={setSelectedModelConfigId}
            size="sm"
          />
        </div>
      </div>

      {/* 履歴一覧ビュー */}
      {showHistoryView ? (
        <ChatSessionList
          sessions={sessions}
          currentSessionId={currentSessionId}
          currentNovelTitle={currentNovel ? currentNovel.title : null}
          pinnedIds={pinnedIds}
          onTogglePin={togglePin}
          onSelectSession={handleSelectSession}
          onSaveTitle={handleSaveTitle}
          onDeleteSession={handleDeleteSession}
          onStartNewChat={handleStartNewChat}
        />
      ) : (
        /* メッセージチャットビュー */
        <>
          <div
            ref={messagesContainerRef}
            onScroll={handleMessagesScroll}
            className="flex-1 space-y-4 overflow-y-auto p-4"
          >
            {messages.length === 0 && !streamingContent && (
              <div className="space-y-4 py-6">
                <div className="text-center">
                  <span className="text-3xl">✨</span>
                  <h3 className="mt-2 font-bold text-foreground text-sm">
                    AI創作パートナーへようこそ
                  </h3>
                  <p className="mx-auto mt-1 max-w-xs text-muted-foreground text-xs">
                    設定、登場人物、プロット、シーン展開の相談など、創作に関するアイデア出しをサポートします。
                  </p>
                </div>

                <div className="space-y-2 pt-2">
                  <div className="px-1 font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
                    クイック相談テンプレート
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {QUICK_PROMPTS.map((qp) => (
                      <button
                        key={qp.id}
                        type="button"
                        onClick={() => handleQuickPrompt(qp)}
                        disabled={isStreaming}
                        className="group flex flex-col rounded-xl border border-border bg-surface p-2.5 text-left text-xs transition hover:border-primary/50 hover:bg-surface-hover"
                      >
                        <div className="flex items-center gap-1.5 font-semibold text-foreground group-hover:text-primary">
                          <span>{qp.icon}</span>
                          <span>{qp.title}</span>
                        </div>
                        <span className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                          {qp.description}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((m) => (
              <ChatMessageItem
                key={m.id}
                message={m}
                copiedId={copiedId}
                onCopy={handleCopy}
                onInsertEntity={handleInsertEntity}
              />
            ))}

            {/* ストリーミング中のリアルタイム表示 */}
            {isStreaming && (
              <StreamingStatus
                streamingContent={streamingContent}
                streamingParts={streamingParts}
                progress={progress}
              />
            )}

            {loadingMessages && (
              <div className="py-8 text-center text-muted-foreground text-xs">
                メッセージを読み込み中...
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="space-y-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3.5 text-destructive text-xs shadow-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-4 w-4 shrink-0"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>エラーが発生しました</span>
                  </div>
                  <button
                    type="button"
                    onClick={clearError}
                    className="cursor-pointer p-0.5 text-destructive/70 text-xs hover:text-destructive"
                    title="閉じる"
                  >
                    ✕
                  </button>
                </div>
                <div className="max-h-36 overflow-y-auto whitespace-pre-wrap break-words rounded border border-destructive/20 bg-background/60 p-2 font-mono text-[11px] text-foreground/90">
                  {error}
                </div>
                {lastPrompt && (
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        clearError();
                        void retryLastMessage();
                      }}
                      disabled={isStreaming}
                      className="h-7 text-xs"
                    >
                      🔄 もう一度試す
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 入力フォーム */}
          <div className="shrink-0 border-border border-t bg-surface p-3">
            <div className="relative flex flex-col gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleTextareaInput}
                onKeyDown={handleKeyDown}
                placeholder="創作の相談を入力... (Ctrl + Enter で送信)"
                rows={1}
                disabled={isStreaming}
                className="max-h-45 w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-foreground text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">
                  Ctrl + Enter で送信
                </span>
                <div className="flex items-center gap-2">
                  {isStreaming ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="danger"
                      onClick={abortStream}
                    >
                      ■ 停止
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="primary"
                      onClick={handleSend}
                      disabled={!input.trim()}
                    >
                      送信
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 設定・人物取り込みモーダル */}
      {insertModalSource && (
        <ChatInsertEntityModal
          isOpen={!!insertModalSource}
          onClose={() => setInsertModalSource(null)}
          sourceText={insertModalSource}
          defaultNovelId={selectedNovelId}
          novels={novels}
        />
      )}
    </aside>
  );
}
