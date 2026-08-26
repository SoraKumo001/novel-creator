import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Button } from '@/components/Button.js';
import { MarkdownText } from '@/components/MarkdownText.js';
import { QUICK_PROMPTS, useChat, type QuickPrompt } from '@/hooks/useChat.js';
import { useNovels } from '@/hooks/useNovels.js';
import { useToast } from '@/hooks/useToast.js';
import { ChatInsertEntityModal } from './ChatInsertEntityModal.js';

export function ChatDrawer() {
  const {
    isOpen,
    closeChat,
    selectedNovelId,
    setSelectedNovelId,
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
    error,
    sendMessage,
    abortStream,
  } = useChat();

  const { novels } = useNovels();
  const toast = useToast();

  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showHistoryView, setShowHistoryView] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitleInput, setEditTitleInput] = useState('');
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [insertModalSource, setInsertModalSource] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

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

  const handleSaveTitle = async (id: string) => {
    if (!editTitleInput.trim()) return;
    try {
      await updateSessionTitle(id, editTitleInput.trim());
      setEditingSessionId(null);
      toast.success('タイトルを変更しました');
    } catch {
      toast.error('タイトルの変更に失敗しました');
    }
  };

  const handleDeleteSession = async (id: string) => {
    try {
      await deleteSession(id);
      setDeletingSessionId(null);
      toast.success('相談履歴を削除しました');
    } catch {
      toast.error('削除に失敗しました');
    }
  };

  if (!isOpen) return null;

  const currentNovel = novels.find((n) => n.id === selectedNovelId);

  return (
    <aside
      aria-label="創作相談チャット"
      className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border bg-surface shadow-2xl transition-all duration-300 sm:w-[480px] md:w-[540px]"
    >
      {/* ヘッダー */}
      <header className="flex shrink-0 items-center justify-between border-b border-border bg-surface-muted/90 px-4 py-3 backdrop-blur">
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
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
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
            <div className="flex items-center gap-1.5 text-[11px] text-muted">
              <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              <span className="truncate">設定・人物・プロット壁打ち</span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {/* 新規チャットボタン */}
          <button
            type="button"
            onClick={handleStartNewChat}
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium text-primary shadow-sm transition hover:bg-primary-subtle hover:text-primary-subtle-fg"
            title="新しい相談を始める"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-3.5 w-3.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span>新規</span>
          </button>

          {/* 履歴一覧切り替えボタン */}
          <button
            type="button"
            onClick={() => setShowHistoryView((prev) => !prev)}
            className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs font-medium shadow-sm transition ${
              showHistoryView
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-surface text-foreground-secondary hover:bg-surface-hover hover:text-foreground'
            }`}
            title="相談履歴一覧"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-3.5 w-3.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>履歴 ({sessions.length})</span>
          </button>

          {/* 閉じるボタン */}
          <button
            type="button"
            onClick={closeChat}
            className="rounded-lg p-1.5 text-muted hover:bg-surface-hover hover:text-foreground"
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

      {/* 小説コンテキスト選択バー */}
      <div className="flex items-center justify-between gap-2 border-b border-border bg-primary-subtle px-4 py-2 text-xs">
        <label
          htmlFor="chat-novel-select"
          className="flex shrink-0 items-center gap-1 font-medium text-foreground-secondary"
        >
          <span>📚 相談対象:</span>
        </label>
        <select
          id="chat-novel-select"
          value={selectedNovelId ?? ''}
          onChange={(e) => setSelectedNovelId(e.target.value ? e.target.value : null)}
          className="w-full max-w-[260px] truncate rounded border border-border bg-surface px-2 py-1 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">（小説を指定しない・全般相談）</option>
          {novels.map((n) => (
            <option key={n.id} value={n.id}>
              {n.title}
            </option>
          ))}
        </select>
      </div>

      {/* 履歴一覧ビュー */}
      {showHistoryView ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
              {currentNovel ? `「${currentNovel.title}」の相談履歴` : '全般の相談履歴'}
            </h3>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={handleStartNewChat}
              className="!py-1 !text-xs"
            >
              ＋ 新規相談
            </Button>
          </div>

          {sessions.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted">
              まだこの小説に関する相談履歴はありません。
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((sess) => {
                const isSelected = sess.id === currentSessionId;
                const isEditing = sess.id === editingSessionId;
                const isDeleting = sess.id === deletingSessionId;
                const dateStr = sess.updatedAt
                  ? new Date(sess.updatedAt).toLocaleString('ja-JP', {
                      month: 'numeric',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '';

                return (
                  <div
                    key={sess.id}
                    className={`group relative rounded-xl border p-3 transition ${
                      isSelected
                        ? 'border-primary bg-primary-subtle'
                        : 'border-border bg-surface hover:border-primary/50 hover:bg-surface-hover'
                    }`}
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editTitleInput}
                          onChange={(e) => setEditTitleInput(e.target.value)}
                          className="flex-1 rounded border border-primary px-2 py-1 text-xs text-foreground bg-surface focus:outline-none"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void handleSaveTitle(sess.id);
                            if (e.key === 'Escape') setEditingSessionId(null);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveTitle(sess.id)}
                          className="rounded bg-primary px-2 py-1 text-[11px] text-primary-foreground hover:bg-primary-hover"
                        >
                          保存
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingSessionId(null)}
                          className="rounded bg-surface-muted px-2 py-1 text-[11px] text-foreground-secondary hover:bg-surface-hover"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div
                          className="cursor-pointer"
                          onClick={() => handleSelectSession(sess.id)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h4
                              className={`text-sm font-medium leading-snug line-clamp-2 ${
                                isSelected ? 'text-primary font-bold' : 'text-foreground'
                              }`}
                            >
                              {sess.title}
                            </h4>
                          </div>
                          <div className="mt-1 flex items-center justify-between text-[11px] text-muted">
                            <span>{dateStr}</span>
                            {isSelected && (
                              <span className="text-primary font-medium">開いています</span>
                            )}
                          </div>
                        </div>

                        {/* アクションボタン */}
                        <div className="mt-2 flex items-center justify-end gap-2 border-t border-border-subtle pt-2 opacity-80 group-hover:opacity-100">
                          {isDeleting ? (
                            <div className="flex items-center gap-1 text-xs">
                              <span className="text-danger">削除しますか?</span>
                              <button
                                type="button"
                                onClick={() => handleDeleteSession(sess.id)}
                                className="rounded bg-danger px-1.5 py-0.5 text-[10px] text-white hover:bg-danger-hover"
                              >
                                削除
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingSessionId(null)}
                                className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] text-foreground-secondary hover:bg-surface-hover"
                              >
                                取消
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingSessionId(sess.id);
                                  setEditTitleInput(sess.title);
                                }}
                                className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] text-muted hover:bg-surface-hover hover:text-foreground"
                                title="タイトル変更"
                              >
                                ✏️ 編集
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingSessionId(sess.id)}
                                className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] text-danger-subtle-fg hover:bg-danger-subtle hover:text-danger"
                                title="削除"
                              >
                                🗑️ 削除
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* メイン対話エリア */
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* ローディング */}
          {loadingMessages && (
            <div className="flex items-center justify-center py-8 text-muted">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
              <span className="text-xs">相談ログを読み込み中...</span>
            </div>
          )}

          {/* メッセージが空の場合の初期画面 */}
          {!loadingMessages && messages.length === 0 && !isStreaming && (
            <div className="py-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-subtle text-2xl text-primary">
                💡
              </div>
              <h3 className="text-base font-bold text-foreground">
                {currentNovel ? `「${currentNovel.title}」の創作相談` : '小説の創作相談'}
              </h3>
              <p className="mt-1 text-xs text-muted">
                設定、キャラクター、プロット、シーン描写など何でも相談できます。
                対話履歴は自動で保存され、後からいつでも見返すことができます。
              </p>

              <div className="mt-6 text-left">
                <div className="mb-2 text-xs font-semibold text-muted uppercase tracking-wider">
                  クイック相談メニュー
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {QUICK_PROMPTS.map((qp) => (
                    <button
                      key={qp.id}
                      type="button"
                      onClick={() => handleQuickPrompt(qp)}
                      className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3 text-left transition hover:border-primary/50 hover:bg-surface-hover"
                    >
                      <span className="text-xl shrink-0">{qp.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-foreground">{qp.title}</div>
                        <div className="text-[11px] text-muted truncate">{qp.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* メッセージリスト */}
          {!loadingMessages &&
            messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} group`}
                >
                  <div className="flex items-center gap-1.5 mb-1 px-1">
                    <span className="text-[11px] font-medium text-muted">
                      {isUser ? 'あなた' : 'AIアシスタント'}
                    </span>
                  </div>
                  <div
                    className={`relative max-w-[92%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                      isUser
                        ? 'bg-primary text-primary-foreground rounded-br-none'
                        : 'border border-border bg-surface text-foreground rounded-bl-none'
                    }`}
                  >
                    {isUser ? (
                      <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                    ) : (
                      <div>
                        <MarkdownText content={msg.content} />
                        {/* アクションボタン */}
                        <div className="mt-2 flex items-center justify-end gap-1.5 pt-1 border-t border-border-subtle">
                          {/* データ反映ボタン */}
                          <button
                            type="button"
                            onClick={() => setInsertModalSource(msg.content)}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary-subtle hover:text-primary-subtle-fg"
                            title="この回答から人物や設定を小説データに登録"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={1.5}
                              stroke="currentColor"
                              className="h-3.5 w-3.5"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                              />
                            </svg>
                            <span>データに反映</span>
                          </button>

                          {/* コピーボタン */}
                          <button
                            type="button"
                            onClick={() => handleCopy(msg.content, msg.id)}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] text-muted hover:bg-surface-hover hover:text-foreground"
                            title="内容をコピー"
                          >
                            {copiedId === msg.id ? (
                              <>
                                <svg
                                  className="h-3 w-3 text-success"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                                <span className="text-success font-medium">コピー完了</span>
                              </>
                            ) : (
                              <>
                                <svg
                                  className="h-3 w-3"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                  />
                                </svg>
                                <span>コピー</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

          {/* ストリーミング中のメッセージ */}
          {isStreaming && (
            <div className="flex flex-col items-start">
              <div className="flex items-center gap-1.5 mb-1 px-1">
                <span className="text-[11px] font-medium text-muted">AIアシスタント</span>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
              </div>
              <div className="max-w-[92%] rounded-2xl rounded-bl-none border border-border bg-surface px-4 py-3 text-sm text-foreground shadow-sm">
                {streamingContent ? (
                  <MarkdownText content={streamingContent} />
                ) : (
                  <div className="flex items-center gap-2 text-muted">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-primary" />
                    <span className="text-xs">思考中...</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* エラー表示 */}
          {error && (
            <div className="rounded-lg border border-danger-border bg-danger-subtle p-3 text-xs text-danger-subtle-fg">
              <div className="font-bold">エラーが発生しました</div>
              <div>{error}</div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      )}

      {/* クイックプロンプトバー（メッセージがあるときも展開可能） */}
      {!showHistoryView && messages.length > 0 && !isStreaming && (
        <div className="flex gap-1.5 overflow-x-auto border-t border-border bg-surface-muted/50 px-3 py-2 text-xs">
          {QUICK_PROMPTS.map((qp) => (
            <button
              key={qp.id}
              type="button"
              onClick={() => handleQuickPrompt(qp)}
              className="shrink-0 inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 text-foreground-secondary transition hover:border-primary hover:text-primary"
            >
              <span>{qp.icon}</span>
              <span>{qp.title}</span>
            </button>
          ))}
        </div>
      )}

      {/* フッター（入力欄） */}
      {!showHistoryView && (
        <footer className="shrink-0 border-t border-border bg-surface p-3">
          <div className="relative">
            <textarea
              ref={textareaRef}
              rows={2}
              value={input}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              placeholder={
                currentNovel
                  ? `「${currentNovel.title}」について質問・相談... (Ctrl+Enterで送信)`
                  : '創作の質問・相談を入力... (Ctrl+Enterで送信)'
              }
              className="w-full resize-none rounded-xl border border-border bg-surface-muted p-3 pr-24 text-sm text-foreground placeholder:text-muted focus:border-primary focus:bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1">
              {isStreaming ? (
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  onClick={abortStream}
                  className="!px-2.5 !py-1 !text-xs"
                >
                  停止
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="!px-3 !py-1 !text-xs"
                >
                  送信
                </Button>
              )}
            </div>
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-muted">
            <span>Ctrl + Enter で素早く送信</span>
            {currentNovel && (
              <span className="truncate max-w-[200px]">連動: {currentNovel.title}</span>
            )}
          </div>
        </footer>
      )}

      {/* データ反映モーダル */}
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
