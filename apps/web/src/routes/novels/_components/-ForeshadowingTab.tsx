import { useMemo, useState } from 'react';
import { Button } from '@/components/Button.js';
import { Card } from '@/components/Card.js';
import { ConfirmDialog } from '@/components/ConfirmDialog.js';
import { EmptyState } from '@/components/EmptyState.js';
import { Input } from '@/components/Input.js';
import { Loading } from '@/components/Loading.js';
import { Modal } from '@/components/Modal.js';
import { Textarea } from '@/components/Textarea.js';
import { useChapters } from '@/hooks/useChapters.js';
import { useForeshadowings } from '@/hooks/useForeshadowings.js';
import { useNovel } from '@/hooks/useNovel.js';
import { useToast } from '@/hooks/useToast.js';
import type { CreateForeshadowingInput, Foreshadowing, ForeshadowingStatus } from '@/lib/types.js';
import { IconButton, PencilIcon, PlusIcon, TrashIcon } from './-Icons.js';

interface ForeshadowingTabProps {
  novel: NonNullable<ReturnType<typeof useNovel>['novel']>;
  onRefresh: () => Promise<void>;
}

const STATUS_CONFIG: Record<
  ForeshadowingStatus,
  { label: string; bg: string; text: string; border: string; icon: string }
> = {
  unresolved: {
    label: '未回収',
    bg: 'bg-amber-500/10',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/30',
    icon: '⏳',
  },
  resolved: {
    label: '回収済',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500/30',
    icon: '✅',
  },
  abandoned: {
    label: '保留・破棄',
    bg: 'bg-muted/10',
    text: 'text-muted-foreground',
    border: 'border-border',
    icon: '🚫',
  },
};

export function ForeshadowingTab({ novel, onRefresh }: ForeshadowingTabProps) {
  const {
    foreshadowings,
    loading,
    createForeshadowing,
    updateForeshadowing,
    deleteForeshadowing,
    creating,
    updating,
    deleting,
  } = useForeshadowings(novel.id);
  const { chapters } = useChapters(novel.id);

  const [filterStatus, setFilterStatus] = useState<ForeshadowingStatus | 'all'>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Foreshadowing | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const toast = useToast();

  // 節IDから名前を取得するマップ
  const sectionMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const ch of chapters) {
      for (const sec of ch.sections) {
        map.set(sec.id, `${ch.title} > ${sec.title || `節 ${sec.order}`}`);
      }
    }
    return map;
  }, [chapters]);

  const filtered = useMemo(() => {
    if (filterStatus === 'all') return foreshadowings;
    return foreshadowings.filter((f) => f.status === filterStatus);
  }, [filterStatus, foreshadowings]);

  const counts = useMemo(() => {
    const map: Record<'all' | ForeshadowingStatus, number> = {
      all: foreshadowings.length,
      unresolved: 0,
      resolved: 0,
      abandoned: 0,
    };
    for (const f of foreshadowings) {
      if (f.status in map) {
        map[f.status]++;
      }
    }
    return map;
  }, [foreshadowings]);

  const handleCreate = async (input: CreateForeshadowingInput) => {
    try {
      await createForeshadowing(input);
      setIsCreateOpen(false);
      toast.success('伏線を作成しました');
      await onRefresh();
    } catch {
      toast.error('伏線の作成に失敗しました');
    }
  };

  const handleUpdate = async (input: CreateForeshadowingInput) => {
    if (!editing) return;
    try {
      await updateForeshadowing(editing.id, input);
      setEditing(null);
      toast.success('伏線を更新しました');
      await onRefresh();
    } catch {
      toast.error('伏線の更新に失敗しました');
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteForeshadowing(deletingId);
      setDeletingId(null);
      toast.success('伏線を削除しました');
      await onRefresh();
    } catch {
      toast.error('伏線の削除に失敗しました');
    }
  };

  const handleToggleStatus = async (item: Foreshadowing) => {
    const nextStatus: ForeshadowingStatus =
      item.status === 'unresolved'
        ? 'resolved'
        : item.status === 'resolved'
          ? 'abandoned'
          : 'unresolved';
    try {
      await updateForeshadowing(item.id, { status: nextStatus });
      toast.success(`ステータスを「${STATUS_CONFIG[nextStatus].label}」に変更しました`);
      await onRefresh();
    } catch {
      toast.error('ステータスの更新に失敗しました');
    }
  };

  return (
    <div className="flex h-full flex-col space-y-4">
      {/* ヘッダー */}
      <div className="flex shrink-0 items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-foreground">伏線・フラグ管理</h2>
          <span className="rounded-full bg-surface-raised px-2.5 py-0.5 text-xs font-semibold text-muted-foreground border border-border">
            未回収 {counts.unresolved} 件 / 全 {counts.all} 件
          </span>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} leftIcon={<PlusIcon />}>
          伏線を追加
        </Button>
      </div>

      {/* ステータスフィルタータブ */}
      <div className="flex gap-2 shrink-0">
        {(['all', 'unresolved', 'resolved', 'abandoned'] as const).map((status) => {
          const isActive = filterStatus === status;
          const label =
            status === 'all'
              ? `すべて (${counts.all})`
              : `${STATUS_CONFIG[status].icon} ${STATUS_CONFIG[status].label} (${counts[status]})`;

          return (
            <button
              key={status}
              type="button"
              onClick={() => setFilterStatus(status)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                isActive
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'bg-surface border border-border text-muted-foreground hover:text-foreground hover:bg-surface-hover'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* メイン一覧 */}
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {loading && <Loading message="伏線データを読み込み中..." />}
        {!loading && filtered.length === 0 && (
          <EmptyState
            title="伏線がありません"
            description="物語に散りばめられた伏線や設定フラグを登録して、回収状況を管理しましょう。"
          />
        )}
        {!loading && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((item) => {
              const cfg = STATUS_CONFIG[item.status];
              const placedName = item.placedSectionId ? sectionMap.get(item.placedSectionId) : null;
              const resolvedName = item.resolvedSectionId
                ? sectionMap.get(item.resolvedSectionId)
                : null;

              return (
                <Card
                  key={item.id}
                  className="flex flex-col justify-between border-border hover:border-border-hover transition"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-bold text-foreground text-sm">{item.title}</h4>
                      <div className="flex items-center gap-1 shrink-0">
                        <IconButton
                          label="編集"
                          onClick={() => setEditing(item)}
                          icon={<PencilIcon />}
                        />
                        <IconButton
                          label="削除"
                          onClick={() => setDeletingId(item.id)}
                          icon={<TrashIcon />}
                        />
                      </div>
                    </div>

                    {item.description && (
                      <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                        {item.description}
                      </p>
                    )}

                    {/* 設置節 / 回収節 */}
                    <div className="space-y-1 pt-1 text-[11px] text-muted-foreground">
                      {placedName && (
                        <div
                          className="flex items-center gap-1 truncate"
                          title={`設置: ${placedName}`}
                        >
                          <span className="font-semibold text-primary shrink-0">📍 設置:</span>
                          <span className="truncate">{placedName}</span>
                        </div>
                      )}
                      {resolvedName && (
                        <div
                          className="flex items-center gap-1 truncate"
                          title={`回収: ${resolvedName}`}
                        >
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                            🎯 回収:
                          </span>
                          <span className="truncate">{resolvedName}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ステータスバッジ（クリックで切り替え） */}
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
                    <button
                      type="button"
                      onClick={() => void handleToggleStatus(item)}
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition cursor-pointer hover:opacity-80 ${cfg.bg} ${cfg.text} ${cfg.border}`}
                      title="クリックしてステータスを変更"
                    >
                      <span>{cfg.icon}</span>
                      <span>{cfg.label}</span>
                    </button>
                    <span className="text-[10px] text-muted-foreground">
                      {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : ''}
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <ForeshadowingFormModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
        isLoading={creating}
        title="伏線・フラグを新規作成"
        chapters={chapters}
      />
      <ForeshadowingFormModal
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        onSubmit={handleUpdate}
        isLoading={updating}
        title="伏線・フラグを編集"
        defaultValues={editing ?? undefined}
        chapters={chapters}
      />
      <ConfirmDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="伏線を削除しますか？"
        message="この操作は元に戻せません。"
        confirmLabel="削除"
        isLoading={deleting}
      />
    </div>
  );
}

function ForeshadowingFormModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  title,
  defaultValues,
  chapters,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: CreateForeshadowingInput) => Promise<void>;
  isLoading: boolean;
  title: string;
  defaultValues?: Foreshadowing;
  chapters: {
    id: string;
    title: string;
    sections: { id: string; title: string | null; order: number }[];
  }[];
}) {
  const [formTitle, setFormTitle] = useState(defaultValues?.title ?? '');
  const [description, setDescription] = useState(defaultValues?.description ?? '');
  const [status, setStatus] = useState<ForeshadowingStatus>(defaultValues?.status ?? 'unresolved');
  const [placedSectionId, setPlacedSectionId] = useState(defaultValues?.placedSectionId ?? '');
  const [resolvedSectionId, setResolvedSectionId] = useState(
    defaultValues?.resolvedSectionId ?? '',
  );
  const [error, setError] = useState<string | null>(null);

  useState(() => {
    if (isOpen) {
      setFormTitle(defaultValues?.title ?? '');
      setDescription(defaultValues?.description ?? '');
      setStatus(defaultValues?.status ?? 'unresolved');
      setPlacedSectionId(defaultValues?.placedSectionId ?? '');
      setResolvedSectionId(defaultValues?.resolvedSectionId ?? '');
      setError(null);
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setError('伏線の名前を入力してください');
      return;
    }
    await onSubmit({
      title: formTitle.trim(),
      description: description.trim(),
      status,
      placedSectionId: placedSectionId || null,
      resolvedSectionId: resolvedSectionId || null,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            キャンセル
          </Button>
          <Button onClick={handleSubmit} isLoading={isLoading}>
            保存
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="伏線・フラグ名"
          value={formTitle}
          onChange={(e) => setFormTitle(e.target.value)}
          placeholder="例: 主人公のペンダントの秘密, 謎の黒ずくめの男"
        />
        <Textarea
          label="詳細メモ"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="伏線の意図や回収のアイデア、関連する人物などを記入"
          rows={3}
        />
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">
            ステータス
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ForeshadowingStatus)}
            className="w-full rounded-lg border border-border bg-surface p-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="unresolved">⏳ 未回収</option>
            <option value="resolved">✅ 回収済</option>
            <option value="abandoned">🚫 保留・破棄</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">
            設置された節 (任意)
          </label>
          <select
            value={placedSectionId}
            onChange={(e) => setPlacedSectionId(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface p-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">未指定</option>
            {chapters.map((ch) => (
              <optgroup key={ch.id} label={ch.title}>
                {ch.sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.title || `節 ${sec.order}`}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">
            回収された節 (任意)
          </label>
          <select
            value={resolvedSectionId}
            onChange={(e) => setResolvedSectionId(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface p-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">未指定</option>
            {chapters.map((ch) => (
              <optgroup key={ch.id} label={ch.title}>
                {ch.sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.title || `節 ${sec.order}`}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-rose-500">{error}</p>}
      </form>
    </Modal>
  );
}
