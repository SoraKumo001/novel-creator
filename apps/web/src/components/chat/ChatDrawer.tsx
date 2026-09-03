import { LLMModelSelector } from "@/components/LLMModelSelector.js";
import { Loading } from "@/components/Loading.js";
import { Select } from "@/components/Select.js";
import { QUICK_PROMPTS } from "@/context/ChatContext.js";
import {
  ChatErrorPanel,
  ChatInputBar,
  ChatWelcomePanel,
} from "./ChatDrawerPanels.js";
import { ChatMessageItem } from "./ChatMessageItem.js";
import { ChatSessionList } from "./ChatSessionList.js";
import { StreamingStatus } from "./StreamingStatus.js";
import { useChatDrawer } from "./useChatDrawer.js";

// 互換のための再エクスポート（既存テストの import パスを維持する）
export {
  buildChatPrefill,
  buildChatPromptWithFocus,
  buildContextAppendedPrompt,
} from "./chatPrompt.js";
export type { ChatLayoutMode, DrawerWidth } from "./useChatDrawer.js";

export function ChatDrawer() {
  const d = useChatDrawer();

  if (!d.isOpen) {
    return null;
  }

  const isFull = d.drawerWidth === "full";

  // 幅クラス（標準 / ワイド）
  const widthClasses =
    d.drawerWidth === "wide"
      ? "sm:w-[680px] md:w-[760px]"
      : "sm:w-[480px] md:w-[520px]";

  const containerClasses = isFull
    ? "fixed inset-0 z-50 flex flex-col bg-surface shadow-2xl transition-all duration-200 motion-reduce:transition-none w-screen h-screen"
    : d.layoutMode === "docked"
      ? `relative z-20 flex flex-col h-full shrink-0 border-l border-border bg-surface shadow-md transition-all duration-200 motion-reduce:transition-none max-md:fixed max-md:inset-y-0 max-md:right-0 max-md:z-50 w-full ${widthClasses}`
      : `fixed inset-y-0 right-0 z-50 flex flex-col border-l border-border bg-surface shadow-2xl transition-all duration-200 motion-reduce:transition-none w-full ${widthClasses}`;

  return (
    <aside
      aria-label="創作相談チャット"
      className={containerClasses}
      role={d.isDialog ? "dialog" : undefined}
      aria-modal={d.isDialog ? "true" : undefined}
    >
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
              title={d.currentSession ? d.currentSession.title : "AI創作相談"}
            >
              {d.currentSession ? d.currentSession.title : "AI創作相談"}
            </h2>
            <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              <span className="truncate">設定・人物・プロット壁打ち</span>
              <span
                className="max-w-[10rem] truncate rounded-md border border-border bg-surface px-1.5 py-px font-medium text-foreground/80"
                title={
                  d.currentNovelTitle
                    ? `対象の小説: ${d.currentNovelTitle}`
                    : "対象: 全般相談（小説を選んでいません）"
                }
              >
                📚 {d.currentNovelTitle ?? "全般相談"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 max-sm:gap-0.5">
          {/* 配置モード切り替え（重ねる ⇔ 占有。狭幅では常時オーバーレイのため非表示） */}
          <button
            type="button"
            onClick={() =>
              d.handleLayoutModeChange(
                d.layoutMode === "docked" ? "overlay" : "docked"
              )
            }
            className={`cursor-pointer rounded-lg border p-1.5 text-xs transition max-sm:hidden ${
              d.layoutMode === "docked"
                ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                : "border-border bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground"
            }`}
            title={
              d.layoutMode === "docked"
                ? "右側エリアを占有中（クリックで重ねて表示に変更）"
                : "重ねて表示中（クリックで右側エリアを占有して画面分割）"
            }
            aria-label="配置モード切り替え"
          >
            {d.layoutMode === "docked" ? (
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

          {/* 幅切り替え（サイクル: 標準 -> ワイド -> 全画面。狭幅では常時全幅のため非表示） */}
          <button
            type="button"
            onClick={() => {
              const next =
                d.drawerWidth === "normal"
                  ? "wide"
                  : d.drawerWidth === "wide"
                    ? "full"
                    : "normal";
              d.handleWidthChange(next);
            }}
            className="flex cursor-pointer items-center gap-1 rounded-lg border border-border bg-surface p-1.5 text-muted-foreground text-xs transition hover:bg-surface-hover hover:text-foreground max-sm:hidden"
            title={`チャット幅: ${
              d.drawerWidth === "normal"
                ? "標準 (クリックでワイド幅へ)"
                : d.drawerWidth === "wide"
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
              {d.drawerWidth === "normal"
                ? "標準"
                : d.drawerWidth === "wide"
                  ? "ワイド"
                  : "全画面"}
            </span>
          </button>

          {/* 新規チャットボタン */}
          <button
            type="button"
            onClick={d.handleStartNewChat}
            className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1.5 font-medium text-primary text-xs shadow-xs transition hover:bg-primary/10 motion-reduce:transition-none"
            title={
              d.isStreaming
                ? "返信中です。新規相談を始めると返信が止まります（確認します）"
                : "新しい相談を始める"
            }
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
            onClick={() => d.setShowHistoryView((prev) => !prev)}
            aria-pressed={d.showHistoryView}
            aria-label={
              d.showHistoryView ? "相談内容に戻る" : "相談履歴一覧を開く"
            }
            className={`inline-flex cursor-pointer items-center gap-1 rounded-lg border px-2 py-1.5 font-medium text-xs shadow-xs transition ${
              d.showHistoryView
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
            <span className="text-xs">{d.sessions.length}</span>
          </button>

          {/* 閉じるボタン */}
          <button
            type="button"
            onClick={d.closeChat}
            aria-label="チャットを閉じる"
            className="cursor-pointer rounded-lg p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
            title="閉じる（Esc）"
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
            <span aria-hidden="true">📚</span> 対象:
          </label>
          <Select
            id="chat-novel-select"
            value={d.selectedNovelId ?? ""}
            onChange={(e) =>
              d.handleNovelChange(e.target.value ? e.target.value : null)
            }
            title={
              d.isStreaming
                ? "返信中です。切り替えると返信が止まります（確認します）"
                : d.input.trim()
                  ? "入力中の下書きは自動保存されます（切り替え時に確認します）"
                  : "相談対象の小説を選ぶ"
            }
            className="max-w-[11.25rem] truncate px-2 py-1 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">（全般相談）</option>
            {d.novels.map((n) => (
              <option key={n.id} value={n.id}>
                {n.title}
              </option>
            ))}
          </Select>
        </div>

        <div
          className="flex items-center gap-1.5"
          title={
            d.isStreaming
              ? "返信中です。モデル切替は次の返信から反映されます"
              : "返信に使うモデルを選ぶ"
          }
        >
          <LLMModelSelector
            value={d.selectedModelConfigId}
            onChange={d.handleModelChange}
            size="sm"
          />
        </div>
      </div>

      <span aria-live="polite" className="sr-only">
        {d.copyNotice ?? ""}
      </span>

      {/* 履歴一覧ビュー */}
      {d.showHistoryView ? (
        <ChatSessionList
          sessions={d.sessions}
          currentSessionId={d.currentSessionId}
          currentNovelTitle={d.currentNovelTitle}
          pinnedIds={d.pinnedIds}
          onTogglePin={d.togglePin}
          onSelectSession={d.handleSelectSession}
          onSaveTitle={d.onSaveTitle}
          onDeleteSession={d.onDeleteSession}
          onStartNewChat={d.handleStartNewChat}
        />
      ) : (
        /* メッセージチャットビュー */
        <>
          <div className="relative flex min-h-0 flex-1 flex-col">
            <div
              ref={d.messagesContainerRef}
              onScroll={d.handleMessagesScroll}
              role="log"
              aria-live="polite"
              aria-busy={d.isStreaming}
              aria-label="チャットメッセージ一覧"
              className="flex-1 space-y-4 overflow-y-auto p-4"
            >
              {d.messages.length === 0 && !d.streamingContent && (
                <ChatWelcomePanel
                  prompts={QUICK_PROMPTS}
                  isStreaming={d.isStreaming}
                  onQuickPrompt={(qp) => void d.handleQuickPrompt(qp)}
                />
              )}

              {d.messages.map((m) => (
                <ChatMessageItem
                  key={m.id}
                  message={m}
                  isFull={isFull}
                  copiedId={d.copiedId}
                  onCopy={(content, id) => void d.handleCopy(content, id)}
                />
              ))}

              {/* ストリーミング中のリアルタイム表示 */}
              {d.isStreaming && (
                <StreamingStatus
                  streamingContent={d.streamingContent}
                  streamingParts={d.streamingParts}
                  progress={d.progress}
                  isFull={isFull}
                />
              )}

              {d.loadingMessages && (
                <Loading size="sm" message="メッセージを読み込み中..." />
              )}

              {d.error && (
                <ChatErrorPanel
                  error={d.error}
                  lastPrompt={d.lastPrompt}
                  isStreaming={d.isStreaming}
                  failedDraft={d.failedDraft}
                  onClose={d.clearError}
                  onRestoreDraft={d.restoreFailedDraft}
                  onRetry={() => {
                    d.clearError();
                    void d.retryLastMessage();
                  }}
                />
              )}
            </div>

            {d.showJumpButton && !d.showHistoryView && (
              <button
                type="button"
                onClick={d.scrollToBottom}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 cursor-pointer rounded-full border border-border bg-surface-raised px-3 py-1.5 font-medium text-foreground text-xs shadow-md transition hover:bg-surface-hover motion-reduce:transition-none"
                aria-label="最新のメッセージへ移動する"
              >
                ↓ 最新へ
              </button>
            )}
          </div>

          {/* 入力フォーム */}
          <ChatInputBar
            chatFocus={d.chatFocus}
            input={d.input}
            isStreaming={d.isStreaming}
            textareaRef={d.textareaRef}
            failedDraft={d.failedDraft}
            onConsumeFocus={d.consumeFocus}
            onTextareaInput={d.handleTextareaInput}
            onKeyDown={d.handleKeyDown}
            onSend={() => void d.handleSend()}
            onAbort={() => void d.abortStream()}
            onRestoreDraft={d.restoreFailedDraft}
            onDismissFailedDraft={d.dismissFailedDraft}
          />
        </>
      )}
    </aside>
  );
}
