import { interactiveCardHover } from "@/components/Card.js";
import { EmptyState } from "@/components/EmptyState.js";
import type { CustomPrompt } from "@/lib/types.js";

export interface CustomPromptListProps {
  error: string | null;
  loading: boolean;
  onCreate: () => void;
  onDelete: (prompt: CustomPrompt) => void;
  onEdit: (prompt: CustomPrompt) => void;
  prompts: CustomPrompt[];
}

/**
 * カスタムプロンプト タブの本文（読み込み中 / エラー / 空状態 / 一覧グリッド）。
 * 表示・文言は分割前と同一。
 */
export function CustomPromptList({
  loading,
  error,
  prompts,
  onCreate,
  onEdit,
  onDelete,
}: CustomPromptListProps): React.JSX.Element {
  return (
    <div className="space-y-4">
      {loading ? (
        <div className="py-12 text-center text-muted-foreground text-xs">
          読み込み中...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-danger text-xs">
          {error}
        </div>
      ) : prompts.length === 0 ? (
        <EmptyState
          title="カスタムプロンプトがまだ登録されていません"
          actionLabel="プロンプトを登録する"
          onAction={onCreate}
          icon={
            <span aria-hidden="true" className="text-3xl">
              🪄
            </span>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {prompts.map((p) => (
            <div
              key={p.id}
              className={`flex flex-col justify-between space-y-2.5 rounded-xl border border-border bg-surface p-4 shadow-sm ${interactiveCardHover}`}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="shrink-0 text-2xl">{p.icon || "🪄"}</span>
                    <div className="min-w-0">
                      <h3 className="truncate font-bold text-foreground text-xs">
                        {p.name}
                      </h3>
                      <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="rounded border border-border/70 bg-muted px-1.5 py-px">
                          {p.category === "inline"
                            ? "インライン推敲"
                            : p.category === "generation"
                              ? "本文・プロット生成"
                              : p.category === "chat"
                                ? "創作相談"
                                : "汎用"}
                        </span>
                        <span>{p.novelId ? "作品専用" : "全作品共通"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onEdit(p)}
                      className="cursor-pointer rounded p-1.5 text-muted-foreground text-xs hover:bg-muted hover:text-primary"
                      title="編集"
                    >
                      ✏️ 編集
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(p)}
                      className="cursor-pointer rounded p-1.5 text-muted-foreground text-xs hover:bg-muted hover:text-danger"
                      title="削除"
                    >
                      🗑️ 削除
                    </button>
                  </div>
                </div>

                {p.description && (
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {p.description}
                  </p>
                )}

                <div className="max-h-32 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border/80 bg-surface-raised p-2.5 font-mono text-muted-foreground text-xs leading-relaxed">
                  {p.userPrompt}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
