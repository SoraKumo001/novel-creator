import { useState } from "react";
import { useCustomPrompts } from "@/hooks/useCustomPrompts.js";
import { useToast } from "@/hooks/useToast.js";
import type {
  CreateCustomPromptInput,
  CustomPrompt,
  UpdateCustomPromptInput,
} from "@/lib/types.js";
import { Button } from "./Button.js";
import { CustomPromptModal } from "./CustomPromptModal.js";
import { Modal } from "./Modal.js";

interface CustomPromptManagerModalProps {
  novelId?: string | null;
  onClose: () => void;
  open: boolean;
}

export function CustomPromptManagerModal({
  open,
  onClose,
  novelId,
}: CustomPromptManagerModalProps) {
  const {
    prompts,
    loading,
    error,
    createPrompt,
    updatePrompt,
    deletePrompt,
    seedPresets,
  } = useCustomPrompts({ novelId, autoFetch: open });

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [editingPrompt, setEditingPrompt] = useState<CustomPrompt | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const toast = useToast();

  const filteredPrompts = prompts.filter((p) => {
    if (selectedCategory === "all") {
      return true;
    }
    return p.category === selectedCategory;
  });

  const handleOpenNew = () => {
    setEditingPrompt(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (prompt: CustomPrompt) => {
    setEditingPrompt(prompt);
    setModalOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (
      !window.confirm(
        `カスタムプロンプト「${name}」を削除してもよろしいですか？`
      )
    ) {
      return;
    }
    try {
      await deletePrompt(id);
      toast.success("プロンプトを削除しました");
    } catch {
      toast.error("削除に失敗しました");
    }
  };

  const handleSeed = async () => {
    try {
      await seedPresets();
      toast.success("標準プリセットプロンプトを復元しました");
    } catch {
      toast.error("プリセットの復元に失敗しました");
    }
  };

  const handleModalSubmit = async (
    data: CreateCustomPromptInput | UpdateCustomPromptInput
  ) => {
    if (editingPrompt) {
      await updatePrompt(editingPrompt.id, data as UpdateCustomPromptInput);
      toast.success("プロンプトを更新しました");
    } else {
      await createPrompt(data as CreateCustomPromptInput);
      toast.success("新しいプロンプトを登録しました");
    }
  };

  return (
    <>
      <Modal
        isOpen={open}
        onClose={onClose}
        title="🪄 カスタムプロンプト管理"
        size="lg"
      >
        <div className="space-y-4">
          {/* ヘッダー操作バー */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-border border-b pb-3">
            {/* カテゴリフィルタ */}
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {[
                { id: "all", label: "すべて" },
                { id: "inline", label: "インライン推敲" },
                { id: "generation", label: "本文・プロット" },
                { id: "chat", label: "創作相談" },
                { id: "general", label: "汎用" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedCategory(tab.id)}
                  className={`cursor-pointer rounded-md px-2.5 py-1 font-medium text-xs transition ${
                    selectedCategory === tab.id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={handleSeed}
                title="初期プリセットを追加・復元"
              >
                🔄 プリセット復元
              </Button>
              <Button size="sm" variant="primary" onClick={handleOpenNew}>
                ＋ プロンプト新規作成
              </Button>
            </div>
          </div>

          {/* プロンプト一覧 */}
          {loading ? (
            <div className="py-12 text-center text-muted-foreground text-xs">
              読み込み中...
            </div>
          ) : error ? (
            <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-danger text-xs">
              {error}
            </div>
          ) : filteredPrompts.length === 0 ? (
            <div className="space-y-2 py-12 text-center">
              <span className="text-3xl">🪄</span>
              <p className="text-muted-foreground text-xs">
                登録されているプロンプトがありません
              </p>
              <Button size="sm" variant="secondary" onClick={handleOpenNew}>
                最初のプロンプトを登録する
              </Button>
            </div>
          ) : (
            <div className="grid max-h-[60vh] grid-cols-1 gap-3 overflow-y-auto pr-1 md:grid-cols-2">
              {filteredPrompts.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-col justify-between space-y-2.5 rounded-xl border border-border bg-surface p-3.5 shadow-sm transition hover:border-primary/50"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="shrink-0 text-xl">
                          {p.icon || "🪄"}
                        </span>
                        <div className="min-w-0">
                          <h4 className="truncate font-bold text-foreground text-xs">
                            {p.name}
                          </h4>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <span className="rounded border border-border/60 bg-muted px-1.5 py-0.2">
                              {p.category === "inline"
                                ? "インライン推敲"
                                : p.category === "generation"
                                  ? "生成"
                                  : p.category === "chat"
                                    ? "相談"
                                    : "汎用"}
                            </span>
                            <span>{p.novelId ? "作品専用" : "全作品共通"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(p)}
                          className="cursor-pointer rounded p-1 text-muted-foreground text-xs hover:bg-muted hover:text-primary"
                          title="編集"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(p.id, p.name)}
                          className="cursor-pointer rounded p-1 text-muted-foreground text-xs hover:bg-muted hover:text-danger"
                          title="削除"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {p.description && (
                      <p className="line-clamp-2 text-[11px] text-muted-foreground leading-relaxed">
                        {p.description}
                      </p>
                    )}

                    {/* テンプレートプレビュー */}
                    <div className="max-h-20 overflow-y-auto whitespace-pre-wrap rounded border border-border/70 bg-surface-raised p-2 font-mono text-[10px] text-muted-foreground leading-relaxed">
                      {p.userPrompt}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end border-border border-t pt-2">
            <Button size="sm" variant="secondary" onClick={onClose}>
              閉じる
            </Button>
          </div>
        </div>
      </Modal>

      <CustomPromptModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleModalSubmit}
        editingPrompt={editingPrompt}
        novelId={novelId}
      />
    </>
  );
}
