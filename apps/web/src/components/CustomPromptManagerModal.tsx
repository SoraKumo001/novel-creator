import { useState } from 'react';
import { Button } from './Button.js';
import { Modal } from './Modal.js';
import { CustomPromptModal } from './CustomPromptModal.js';
import { useCustomPrompts } from '@/hooks/useCustomPrompts.js';
import { useToast } from '@/hooks/useToast.js';
import type {
  CreateCustomPromptInput,
  CustomPrompt,
  UpdateCustomPromptInput,
} from '@/lib/types.js';

interface CustomPromptManagerModalProps {
  open: boolean;
  onClose: () => void;
  novelId?: string | null;
}

export function CustomPromptManagerModal({
  open,
  onClose,
  novelId,
}: CustomPromptManagerModalProps) {
  const { prompts, loading, error, createPrompt, updatePrompt, deletePrompt, seedPresets } =
    useCustomPrompts({ novelId, autoFetch: open });

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingPrompt, setEditingPrompt] = useState<CustomPrompt | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const toast = useToast();

  const filteredPrompts = prompts.filter((p) => {
    if (selectedCategory === 'all') return true;
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
    if (!window.confirm(`カスタムプロンプト「${name}」を削除してもよろしいですか？`)) return;
    try {
      await deletePrompt(id);
      toast.success('プロンプトを削除しました');
    } catch {
      toast.error('削除に失敗しました');
    }
  };

  const handleSeed = async () => {
    try {
      await seedPresets();
      toast.success('標準プリセットプロンプトを復元しました');
    } catch {
      toast.error('プリセットの復元に失敗しました');
    }
  };

  const handleModalSubmit = async (data: CreateCustomPromptInput | UpdateCustomPromptInput) => {
    if (editingPrompt) {
      await updatePrompt(editingPrompt.id, data as UpdateCustomPromptInput);
      toast.success('プロンプトを更新しました');
    } else {
      await createPrompt(data as CreateCustomPromptInput);
      toast.success('新しいプロンプトを登録しました');
    }
  };

  return (
    <>
      <Modal isOpen={open} onClose={onClose} title="🪄 カスタムプロンプト管理" size="lg">
        <div className="space-y-4">
          {/* ヘッダー操作バー */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            {/* カテゴリフィルタ */}
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {[
                { id: 'all', label: 'すべて' },
                { id: 'inline', label: 'インライン推敲' },
                { id: 'generation', label: '本文・プロット' },
                { id: 'chat', label: '創作相談' },
                { id: 'general', label: '汎用' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedCategory(tab.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition ${
                    selectedCategory === tab.id
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
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
            <div className="py-12 text-center text-xs text-muted-foreground">読み込み中...</div>
          ) : error ? (
            <div className="p-4 rounded-lg bg-danger/10 border border-danger/30 text-xs text-danger">
              {error}
            </div>
          ) : filteredPrompts.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <span className="text-3xl">🪄</span>
              <p className="text-xs text-muted-foreground">登録されているプロンプトがありません</p>
              <Button size="sm" variant="secondary" onClick={handleOpenNew}>
                最初のプロンプトを登録する
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
              {filteredPrompts.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-border bg-surface p-3.5 space-y-2.5 hover:border-primary/50 transition shadow-sm flex flex-col justify-between"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xl shrink-0">{p.icon || '🪄'}</span>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-foreground truncate">{p.name}</h4>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <span className="bg-muted px-1.5 py-0.2 rounded border border-border/60">
                              {p.category === 'inline'
                                ? 'インライン推敲'
                                : p.category === 'generation'
                                  ? '生成'
                                  : p.category === 'chat'
                                    ? '相談'
                                    : '汎用'}
                            </span>
                            <span>{p.novelId ? '作品専用' : '全作品共通'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(p)}
                          className="text-xs text-muted-foreground hover:text-primary p-1 rounded hover:bg-muted cursor-pointer"
                          title="編集"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(p.id, p.name)}
                          className="text-xs text-muted-foreground hover:text-danger p-1 rounded hover:bg-muted cursor-pointer"
                          title="削除"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {p.description && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                        {p.description}
                      </p>
                    )}

                    {/* テンプレートプレビュー */}
                    <div className="rounded bg-surface-raised border border-border/70 p-2 text-[10px] font-mono text-muted-foreground max-h-20 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                      {p.userPrompt}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-border">
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
