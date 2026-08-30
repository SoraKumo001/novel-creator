import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Button } from '@/components/Button.js';
import { LLMModelSelector } from '@/components/LLMModelSelector.js';
import { MarkdownText } from '@/components/MarkdownText.js';
import { QUICK_PROMPTS, useChat, type QuickPrompt } from '@/hooks/useChat.js';
import type { ChatFocusContext } from '@/context/ChatContext.js';
import { useNovels } from '@/hooks/useNovels.js';
import { usePinnedSessions } from '@/hooks/usePinnedSessions.js';
import { useToast } from '@/hooks/useToast.js';
import { ChatInsertEntityModal } from './ChatInsertEntityModal.js';
import { ChatSessionList } from './ChatSessionList.js';
import { ToolActivity } from './ToolActivity.js';

type DrawerWidth = 'normal' | 'wide' | 'full';

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

export function ChatDrawer() {
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
    messages,
    isStreaming,
    streamingContent,
    streamingParts,
    error,
    sendMessage,
    abortStream,
  } = useChat();

  const { novels } = useNovels();
  const toast = useToast();

  const [drawerWidth, setDrawerWidth] = useState<DrawerWidth>(() => {
    return (localStorage.getItem('novel-creator:chat-width') as DrawerWidth) || 'normal';
  });
  const { pinnedIds, togglePin } = usePinnedSessions();

  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showHistoryView, setShowHistoryView] = useState(false);
  const [insertModalSource, setInsertModalSource] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const handleWidthChange = (width: DrawerWidth) => {
    setDrawerWidth(width);
    localStorage.setItem('novel-creator:chat-width', width);
  };

  // メッセージやストリーミング更新時に最下部にスクロール
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && !showHistoryView) {
      scrollToBottom();
      textareaRef.current?.focus();
    }
  }, [isOpen, messages, streamingContent, showHistoryView]);

  // エディタからの「AIと相談」フォーカスが未消費なら入力欄にプリフィルする。
  // 既存入力は上書きせず末尾へ追記し、消費後はクリアして二重プリフィルを防ぐ。
  useEffect(() => {
    if (!isOpen || !chatFocus) return;
    const prefill = buildChatPrefill(chatFocus);
    setInput((prev) => (prev ? `${prev}\n\n${prefill}` : prefill));
    consumeFocus();
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    });
  }, [isOpen, chatFocus, consumeFocus]);

  // 送信ハンドラ
  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    const text = input;
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    await sendMessage(text);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleQuickPrompt = async (qp: QuickPrompt) => {
    await sendMessage(qp.prompt);
  };

  const handleCopy = async (content: string, id: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      toast.success('クリップボードにコピーしました');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('コピーに失敗しました');
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const target = e.target;
    target.style.height = 'auto';
    target.style.height = `${Math.min(target.scrollHeight, 180)}px`;
  };

  const handleStartNewChat = () => {
    setShowHistoryView(false);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
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
      toast.success('タイトルを変更しました');
    } else {
      toast.error('タイトルの変更に失敗しました');
    }
    return ok;
  };

  const handleDeleteSession = async (id: string) => {
    try {
      await deleteSession(id);
      toast.success('相談履歴を削除しました');
    } catch {
      toast.error('削除に失敗しました');
    }
  };

  if (!isOpen) return null;

  const currentNovel = novels.find((n) => n.id === selectedNovelId);

  // 幅クラス
  const widthClasses = {
    normal: 'sm:w-[480px] md:w-[520px]',
    wide: 'sm:w-[680px] md:w-[760px]',
    full: 'w-full',
  }[drawerWidth];

  return (
    <aside
      aria-label="創作相談チャット"
      className={`fixed inset-y-0 right-0 z-50 flex flex-col border-l border-border bg-surface shadow-2xl transition-all duration-300 ${widthClasses}`}
    >
      {/* ヘッダー */}
      <header className="flex shrink-0 items-center justify-between border-b border-border bg-surface-raised/90 px-4 py-3 backdrop-blur">
        <div className="flex min-w-0 flex-1 items-center gap-2 mr-3">
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
              className="truncate text-sm font-bold text-foreground"
              title={currentSession ? currentSession.title : 'AI創作相談'}
            >
              {currentSession ? currentSession.title : 'AI創作相談'}
            </h2>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              <span className="truncate">設定・人物・プロット壁打ち</span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {/* 幅切り替えボタン */}
          <div className="hidden sm:flex items-center rounded-lg border border-border bg-surface p-0.5 text-xs text-muted-foreground">
            <button
              type="button"
              onClick={() => handleWidthChange('normal')}
              className={`px-2 py-0.5 rounded transition ${
                drawerWidth === 'normal'
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'hover:text-foreground'
              }`}
              title="標準幅"
            >
              標準
            </button>
            <button
              type="button"
              onClick={() => handleWidthChange('wide')}
              className={`px-2 py-0.5 rounded transition ${
                drawerWidth === 'wide'
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'hover:text-foreground'
              }`}
              title="ワイド幅"
            >
              ワイド
            </button>
            <button
              type="button"
              onClick={() => handleWidthChange('full')}
              className={`px-2 py-0.5 rounded transition ${
                drawerWidth === 'full'
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'hover:text-foreground'
              }`}
              title="全画面"
            >
              全画面
            </button>
          </div>

          {/* 新規チャットボタン */}
          <button
            type="button"
            onClick={handleStartNewChat}
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium text-primary shadow-xs transition hover:bg-primary/10"
            title="新しい相談を始める"
          >
            <span>＋ 新規</span>
          </button>

          {/* 履歴一覧切り替えボタン */}
          <button
            type="button"
            onClick={() => setShowHistoryView((prev) => !prev)}
            className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs font-medium shadow-xs transition ${
              showHistoryView
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-surface text-foreground hover:bg-surface-hover'
            }`}
            title="相談履歴一覧"
          >
            <span>履歴 ({sessions.length})</span>
          </button>

          {/* 閉じるボタン */}
          <button
            type="button"
            onClick={closeChat}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground cursor-pointer"
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </header>

      {/* 小説コンテキスト & LLMモデル選択バー */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-raised/50 px-4 py-2 text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <label
            htmlFor="chat-novel-select"
            className="flex shrink-0 items-center gap-1 font-medium text-muted-foreground"
          >
            <span>📚 対象:</span>
          </label>
          <select
            id="chat-novel-select"
            value={selectedNovelId ?? ''}
            onChange={(e) => setSelectedNovelId(e.target.value ? e.target.value : null)}
            className="max-w-45 truncate rounded border border-border bg-surface px-2 py-1 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && !streamingContent && (
              <div className="space-y-4 py-6">
                <div className="text-center">
                  <span className="text-3xl">✨</span>
                  <h3 className="mt-2 font-bold text-foreground text-sm">
                    AI創作パートナーへようこそ
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                    設定、登場人物、プロット、シーン展開の相談など、創作に関するアイデア出しをサポートします。
                  </p>
                </div>

                <div className="space-y-2 pt-2">
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                    クイック相談テンプレート
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {QUICK_PROMPTS.map((qp) => (
                      <button
                        key={qp.id}
                        type="button"
                        onClick={() => handleQuickPrompt(qp)}
                        disabled={isStreaming}
                        className="flex flex-col text-left p-2.5 rounded-xl border border-border bg-surface hover:border-primary/50 hover:bg-surface-hover transition text-xs group"
                      >
                        <div className="flex items-center gap-1.5 font-semibold text-foreground group-hover:text-primary">
                          <span>{qp.icon}</span>
                          <span>{qp.title}</span>
                        </div>
                        <span className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                          {qp.description}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <div key={m.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-muted-foreground">
                    <span>{isUser ? 'あなた' : 'AIパートナー'}</span>
                  </div>
                  <div
                    className={`rounded-2xl px-4 py-2.5 max-w-[88%] text-sm shadow-xs ${
                      isUser
                        ? 'bg-primary text-primary-foreground rounded-br-xs'
                        : 'bg-surface-raised border border-border text-foreground rounded-bl-xs'
                    }`}
                  >
                    {isUser ? (
                      <div className="whitespace-pre-wrap">{m.content}</div>
                    ) : (
                      <>
                        {/* AI のツール呼び出し活動（v7 パーツから抽出。無ければ非表示） */}
                        <ToolActivity parts={m.parts} />
                        {m.content && <MarkdownText content={m.content} />}
                      </>
                    )}
                  </div>

                  {/* アシスタントメッセージのアクションバー */}
                  {!isUser && (
                    <div className="flex items-center gap-2 mt-1 px-1 text-[11px] text-muted-foreground">
                      <button
                        type="button"
                        onClick={() => handleCopy(m.content, m.id)}
                        className="hover:text-foreground"
                      >
                        {copiedId === m.id ? '✓ コピー完了' : '📋 コピー'}
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() => setInsertModalSource(m.content)}
                        className="hover:text-primary font-medium"
                      >
                        📥 設定・人物へ取り込む
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* ストリーミング中のリアルタイム表示 */}
            {isStreaming && (
              <div className="flex flex-col items-start space-y-1">
                {streamingContent || (streamingParts && streamingParts.length > 0) ? (
                  <>
                    <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-primary font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
                      <span>AIパートナーが入力中...</span>
                    </div>
                    <div className="rounded-2xl rounded-bl-xs bg-surface-raised border border-primary/30 px-4 py-2.5 max-w-[88%] text-sm text-foreground shadow-xs">
                      {/* ツール呼び出しはテキスト生成前でも随時表示する */}
                      <ToolActivity parts={streamingParts} />
                      {streamingContent && <MarkdownText content={streamingContent} />}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2 rounded-2xl rounded-bl-xs bg-surface-raised border border-border px-4 py-3 text-xs text-muted-foreground shadow-xs animate-pulse">
                    <span className="h-2 w-2 rounded-full bg-primary animate-ping" />
                    <span>AIパートナーが思考中...（小説データと文脈を参照しています）</span>
                  </div>
                )}
              </div>
            )}

            {loadingMessages && (
              <div className="py-8 text-center text-xs text-muted-foreground">
                メッセージを読み込み中...
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* 入力フォーム */}
          <div className="border-t border-border bg-surface p-3 shrink-0">
            <div className="relative flex flex-col gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleTextareaInput}
                onKeyDown={handleKeyDown}
                placeholder="創作の相談を入力... (Ctrl + Enter で送信)"
                rows={1}
                disabled={isStreaming}
                className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary max-h-45"
              />
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">Ctrl + Enter で送信</span>
                <div className="flex items-center gap-2">
                  {isStreaming ? (
                    <Button type="button" size="sm" variant="danger" onClick={abortStream}>
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
