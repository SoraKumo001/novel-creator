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
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  };

  const handleSelectSession = async (sessionId: string) => {
    setShowHistoryView(false);
    await selectSession(sessionId);
  };

  const handleSaveTitle = async (sessionId: string) => {
    if (!editTitleInput.trim()) {
      setEditingSessionId(null);
      return;
    }
    await updateSessionTitle(sessionId, editTitleInput.trim());
    setEditingSessionId(null);
    toast.success('相談タイトルを更新しました');
  };

  const handleDeleteSession = async (sessionId: string) => {
    await deleteSession(sessionId);
    setDeletingSessionId(null);
    toast.success('相談履歴を削除しました');
  };

  if (!isOpen) return null;

  const currentNovel = novels.find((n) => n.id === selectedNovelId);

  return (
    <aside
      aria-label="創作相談チャット"
      className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-slate-200 bg-white shadow-2xl transition-all duration-300 sm:w-[480px] md:w-[540px] dark:border-slate-800 dark:bg-slate-900"
    >
      {/* ヘッダー */}
      <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex min-w-0 flex-1 items-center gap-2 mr-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white dark:bg-indigo-500">
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
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h2
              className="truncate text-sm font-bold text-slate-900 dark:text-slate-100"
              title={currentSession ? currentSession.title : 'AI創作相談'}
            >
              {currentSession ? currentSession.title : 'AI創作相談'}
            </h2>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
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
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-indigo-600 shadow-sm transition hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-800 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
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
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
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
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
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
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-indigo-50/50 px-4 py-2 text-xs dark:border-slate-800 dark:bg-indigo-950/20">
        <label
          htmlFor="chat-novel-select"
          className="flex shrink-0 items-center gap-1 font-medium text-slate-600 dark:text-slate-300"
        >
          <span>📚 相談対象:</span>
        </label>
        <select
          id="chat-novel-select"
          value={selectedNovelId ?? ''}
          onChange={(e) => setSelectedNovelId(e.target.value ? e.target.value : null)}
          className="w-full max-w-[260px] truncate rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
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
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
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
            <div className="py-12 text-center text-xs text-slate-400">
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
                        ? 'border-indigo-500 bg-indigo-50/60 dark:border-indigo-500/80 dark:bg-indigo-950/40'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-850 dark:hover:bg-slate-800'
                    }`}
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editTitleInput}
                          onChange={(e) => setEditTitleInput(e.target.value)}
                          className="flex-1 rounded border border-indigo-400 px-2 py-1 text-xs text-slate-800 focus:outline-none dark:bg-slate-800 dark:text-slate-100"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void handleSaveTitle(sess.id);
                            if (e.key === 'Escape') setEditingSessionId(null);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveTitle(sess.id)}
                          className="rounded bg-indigo-600 px-2 py-1 text-[11px] text-white hover:bg-indigo-700"
                        >
                          保存
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingSessionId(null)}
                          className="rounded bg-slate-200 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200"
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
                                isSelected
                                  ? 'text-indigo-700 dark:text-indigo-300 font-bold'
                                  : 'text-slate-800 dark:text-slate-200'
                              }`}
                            >
                              {sess.title}
                            </h4>
                          </div>
                          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                            <span>{dateStr}</span>
                            {isSelected && (
                              <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                                開いています
                              </span>
                            )}
                          </div>
                        </div>

                        {/* アクションボタン */}
                        <div className="mt-2 flex items-center justify-end gap-2 border-t border-slate-100 pt-2 opacity-80 group-hover:opacity-100 dark:border-slate-700/60">
                          {isDeleting ? (
                            <div className="flex items-center gap-1 text-xs">
                              <span className="text-rose-600 dark:text-rose-400">
                                削除しますか?
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDeleteSession(sess.id)}
                                className="rounded bg-rose-600 px-1.5 py-0.5 text-[10px] text-white hover:bg-rose-700"
                              >
                                削除
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingSessionId(null)}
                                className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200"
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
                                className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                                title="タイトル変更"
                              >
                                ✏️ 編集
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingSessionId(sess.id)}
                                className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] text-rose-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
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
            <div className="flex items-center justify-center py-8 text-slate-400">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent mr-2" />
              <span className="text-xs">相談ログを読み込み中...</span>
            </div>
          )}

          {/* メッセージが空の場合の初期画面 */}
          {!loadingMessages && messages.length === 0 && !isStreaming && (
            <div className="py-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-2xl text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
                💡
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                {currentNovel ? `「${currentNovel.title}」の創作相談` : '小説の創作相談'}
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                設定、キャラクター、プロット、シーン描写など何でも相談できます。
                対話履歴は自動で保存され、後からいつでも見返すことができます。
              </p>

              <div className="mt-6 text-left">
                <div className="mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  クイック相談メニュー
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {QUICK_PROMPTS.map((qp) => (
                    <button
                      key={qp.id}
                      type="button"
                      onClick={() => handleQuickPrompt(qp)}
                      className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-indigo-300 hover:bg-indigo-50/50 dark:border-slate-800 dark:bg-slate-800/60 dark:hover:border-indigo-500/50 dark:hover:bg-indigo-950/30"
                    >
                      <span className="text-xl shrink-0">{qp.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {qp.title}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {qp.description}
                        </div>
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
                    <span className="text-[11px] font-medium text-slate-400">
                      {isUser ? 'あなた' : 'AIアシスタント'}
                    </span>
                  </div>
                  <div
                    className={`relative max-w-[92%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                      isUser
                        ? 'bg-indigo-600 text-white rounded-br-none'
                        : 'border border-slate-200 bg-white text-slate-800 rounded-bl-none dark:border-slate-800 dark:bg-slate-800/90 dark:text-slate-100'
                    }`}
                  >
                    {isUser ? (
                      <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                    ) : (
                      <div>
                        <MarkdownText content={msg.content} />
                        {/* アクションボタン */}
                        <div className="mt-2 flex items-center justify-end gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-700/60">
                          {/* データ反映ボタン */}
                          <button
                            type="button"
                            onClick={() => setInsertModalSource(msg.content)}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
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
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                            title="内容をコピー"
                          >
                            {copiedId === msg.id ? (
                              <>
                                <svg
                                  className="h-3 w-3 text-emerald-500"
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
                                <span className="text-emerald-500 font-medium">コピー完了</span>
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
                <span className="text-[11px] font-medium text-slate-400">AIアシスタント</span>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
                </span>
              </div>
              <div className="max-w-[92%] rounded-2xl rounded-bl-none border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm dark:border-slate-800 dark:bg-slate-800/90 dark:text-slate-100">
                {streamingContent ? (
                  <MarkdownText content={streamingContent} />
                ) : (
                  <div className="flex items-center gap-2 text-slate-400">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-indigo-500 [animation-delay:-0.3s]" />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-indigo-500 [animation-delay:-0.15s]" />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-indigo-500" />
                    <span className="text-xs">思考中...</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* エラー表示 */}
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-300">
              <div className="font-bold">エラーが発生しました</div>
              <div>{error}</div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      )}

      {/* クイックプロンプトバー（メッセージがあるときも展開可能） */}
      {!showHistoryView && messages.length > 0 && !isStreaming && (
        <div className="flex gap-1.5 overflow-x-auto border-t border-slate-200 bg-slate-50/50 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900/50">
          {QUICK_PROMPTS.map((qp) => (
            <button
              key={qp.id}
              type="button"
              onClick={() => handleQuickPrompt(qp)}
              className="shrink-0 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600 transition hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-indigo-500 dark:hover:text-indigo-300"
            >
              <span>{qp.icon}</span>
              <span>{qp.title}</span>
            </button>
          ))}
        </div>
      )}

      {/* フッター（入力欄） */}
      {!showHistoryView && (
        <footer className="shrink-0 border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
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
              className="w-full resize-none rounded-xl border border-slate-300 bg-slate-50 p-3 pr-24 text-sm text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:bg-slate-800"
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
          <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
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
