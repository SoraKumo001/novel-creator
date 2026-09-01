import { useState } from "react";
import { Button } from "@/components/Button.js";
import type { ChatSession } from "@/lib/types.js";

interface ChatSessionListProps {
  currentNovelTitle: string | null;
  currentSessionId: string | null;
  onDeleteSession: (id: string) => Promise<void>;
  onSaveTitle: (id: string, newTitle: string) => Promise<boolean>;
  onSelectSession: (id: string) => void;
  onStartNewChat: () => void;
  onTogglePin: (id: string) => void;
  pinnedIds: Set<string>;
  sessions: ChatSession[];
}

// 相談履歴一覧ビュー（検索・ピン留め・タイトル編集・削除確認を含む）
export function ChatSessionList({
  sessions,
  currentSessionId,
  currentNovelTitle,
  pinnedIds,
  onTogglePin,
  onSelectSession,
  onSaveTitle,
  onDeleteSession,
  onStartNewChat,
}: ChatSessionListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitleInput, setEditTitleInput] = useState("");
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(
    null
  );

  const handleSaveTitle = async (id: string) => {
    if (!editTitleInput.trim()) {
      return;
    }
    const ok = await onSaveTitle(id, editTitleInput.trim());
    if (ok) {
      setEditingSessionId(null);
    }
  };

  const handleDeleteSession = async (id: string) => {
    await onDeleteSession(id);
    setDeletingSessionId(null);
  };

  const togglePinSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onTogglePin(id);
  };

  // 検索・ピン留めソート済みセッション
  const filteredSessions = sessions
    .filter((s) => {
      if (!searchQuery.trim()) {
        return true;
      }
      return s.title.toLowerCase().includes(searchQuery.toLowerCase());
    })
    .sort((a, b) => {
      const aPinned = pinnedIds.has(a.id) ? 1 : 0;
      const bPinned = pinnedIds.has(b.id) ? 1 : 0;
      if (aPinned !== bPinned) {
        return bPinned - aPinned;
      }
      return 0;
    });

  return (
    <div className="flex-1 space-y-3 overflow-y-auto p-4">
      <div className="flex items-center justify-between border-border border-b pb-2">
        <h3 className="font-bold text-muted-foreground text-xs uppercase tracking-wider">
          {currentNovelTitle
            ? `「${currentNovelTitle}」の相談履歴`
            : "全般の相談履歴"}
        </h3>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={onStartNewChat}
          className="py-1! text-xs!"
        >
          ＋ 新規相談
        </Button>
      </div>

      {/* 検索入力 */}
      {sessions.length > 0 && (
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="履歴を検索..."
            className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-foreground text-xs placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute top-1.5 right-2 text-muted-foreground text-xs hover:text-foreground"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {filteredSessions.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-xs">
          {searchQuery
            ? "検索条件に一致する相談履歴はありません。"
            : "まだ相談履歴はありません。"}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredSessions.map((sess) => {
            const isSelected = sess.id === currentSessionId;
            const isEditing = sess.id === editingSessionId;
            const isDeleting = sess.id === deletingSessionId;
            const isPinned = pinnedIds.has(sess.id);
            const dateStr = sess.updatedAt
              ? new Date(sess.updatedAt).toLocaleString("ja-JP", {
                  month: "numeric",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "";

            return (
              <div
                key={sess.id}
                className={`group relative rounded-xl border p-3 transition ${
                  isSelected
                    ? "border-primary bg-primary/10"
                    : "border-border bg-surface hover:border-primary/50 hover:bg-surface-hover"
                }`}
              >
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editTitleInput}
                      onChange={(e) => setEditTitleInput(e.target.value)}
                      className="flex-1 rounded border border-primary bg-surface px-2 py-1 text-foreground text-xs focus:outline-none"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          void handleSaveTitle(sess.id);
                        }
                        if (e.key === "Escape") {
                          setEditingSessionId(null);
                        }
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
                      className="rounded bg-surface-raised px-2 py-1 text-[11px] text-foreground hover:bg-surface-hover"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <div>
                    <div
                      className="cursor-pointer"
                      onClick={() => onSelectSession(sess.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4
                          className={`line-clamp-2 font-medium text-sm leading-snug ${
                            isSelected
                              ? "font-bold text-primary"
                              : "text-foreground"
                          }`}
                        >
                          {isPinned && (
                            <span className="mr-1 text-amber-500">★</span>
                          )}
                          {sess.title}
                        </h4>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>{dateStr}</span>
                        {isSelected && (
                          <span className="font-medium text-primary">
                            開いています
                          </span>
                        )}
                      </div>
                    </div>

                    {/* アクションボタン */}
                    <div className="mt-2 flex items-center justify-end gap-1 border-border/50 border-t pt-2 opacity-80 transition group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={(e) => togglePinSession(e, sess.id)}
                        className={`rounded p-1 text-xs transition ${
                          isPinned
                            ? "text-amber-500 hover:text-amber-600"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        title={isPinned ? "ピン留め解除" : "上部にピン留め"}
                      >
                        {isPinned ? "★ 固定中" : "☆ ピン留め"}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingSessionId(sess.id);
                          setEditTitleInput(sess.title);
                        }}
                        className="rounded p-1 text-muted-foreground text-xs hover:text-foreground"
                        title="タイトル変更"
                      >
                        ✏️ 編集
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingSessionId(sess.id);
                        }}
                        className="rounded p-1 text-destructive text-xs hover:bg-destructive/10"
                        title="削除"
                      >
                        🗑️ 削除
                      </button>
                    </div>
                  </div>
                )}

                {/* 削除確認モーダル風インライン表示 */}
                {isDeleting && (
                  <div className="mt-2 rounded-lg border border-destructive/20 bg-destructive/10 p-2 text-xs">
                    <p className="mb-1 font-semibold text-destructive">
                      この相談履歴を削除しますか？
                    </p>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setDeletingSessionId(null)}
                        className="rounded bg-surface px-2 py-1 text-foreground"
                      >
                        キャンセル
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSession(sess.id)}
                        className="rounded bg-destructive px-2 py-1 text-white"
                      >
                        削除する
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
