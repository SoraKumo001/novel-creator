import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/Button.js';
import { ConfirmDialog } from '@/components/ConfirmDialog.js';
import { EmptyState } from '@/components/EmptyState.js';
import { Input } from '@/components/Input.js';
import { Loading } from '@/components/Loading.js';
import { Modal } from '@/components/Modal.js';
import { Textarea } from '@/components/Textarea.js';
import { useNovel } from '@/hooks/useNovel.js';
import { useTimelines } from '@/hooks/useTimelines.js';
import type { Chapter, Section } from '@/lib/types.js';
import { IconButton, PlusIcon, TrashIcon } from './-Icons.js';

export function TimelineTab({
  novel,
  onRefresh,
}: {
  novel: NonNullable<ReturnType<typeof useNovel>['novel']>;
  onRefresh: () => Promise<void>;
}) {
  const { timelines, loading, createTimeline, deleteTimeline, creating, deleting } = useTimelines(
    novel.id,
  );
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleCreate(input: {
    event: string;
    order: number;
    timestamp: string;
    sectionId?: string;
  }) {
    await createTimeline(input);
    setIsCreateOpen(false);
    await onRefresh();
  }

  async function handleDelete() {
    if (!deletingId) return;
    await deleteTimeline(deletingId);
    setDeletingId(null);
    await onRefresh();
  }

  const allSections = useMemo(
    () =>
      (novel.chapters as Array<Chapter & { sections?: Section[] }>).flatMap(
        (c) => c.sections ?? [],
      ),
    [novel],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">タイムライン</h2>
        <Button onClick={() => setIsCreateOpen(true)} leftIcon={<PlusIcon />}>
          イベント追加
        </Button>
      </div>
      {loading && <Loading message="タイムラインを読み込み中..." />}
      {!loading && timelines.length === 0 && (
        <EmptyState
          title="イベントがありません"
          description="物語の流れを時系列で整理しましょう。"
        />
      )}
      {!loading && timelines.length > 0 && (
        <div className="relative space-y-0 pl-4">
          <div className="absolute bottom-0 left-7 top-0 w-px bg-slate-200 dark:bg-slate-700" />
          {timelines.map((timeline) => (
            <div key={timeline.id} className="relative flex items-start gap-4 py-3">
              <div className="z-10 mt-1.5 h-2.5 w-2.5 rounded-full bg-indigo-500 ring-4 ring-white dark:ring-slate-800" />
              <div className="flex-1 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {timeline.timestamp ?? `順序 ${timeline.order}`}
                    </div>
                    <div className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">
                      {timeline.event}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {timeline.sectionId && (
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        節ID: {timeline.sectionId}
                      </span>
                    )}
                    <IconButton
                      label="削除"
                      onClick={() => setDeletingId(timeline.id)}
                      icon={<TrashIcon />}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <TimelineFormModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
        isLoading={creating}
        novelSections={allSections}
      />
      <ConfirmDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="イベントを削除しますか？"
        message="この操作は元に戻せません。"
        confirmLabel="削除"
        isLoading={deleting}
      />
    </div>
  );
}

function TimelineFormModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  novelSections,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: {
    event: string;
    order: number;
    timestamp: string;
    sectionId?: string;
  }) => Promise<void>;
  isLoading: boolean;
  novelSections: Section[];
}) {
  const [event, setEvent] = useState('');
  const [order, setOrder] = useState(1);
  const [timestamp, setTimestamp] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setEvent('');
      setOrder(1);
      setTimestamp('');
      setSectionId('');
      setError(null);
    }
  }, [isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!event.trim()) {
      setError('イベント内容を入力してください');
      return;
    }
    await onSubmit({
      event: event.trim(),
      order,
      timestamp: timestamp.trim(),
      sectionId: sectionId || undefined,
    });
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="イベントを追加"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            キャンセル
          </Button>
          <Button onClick={handleSubmit} isLoading={isLoading}>
            追加
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Textarea
          label="イベント内容"
          value={event}
          onChange={(e) => setEvent(e.target.value)}
          rows={3}
        />
        <Input
          label="順序"
          type="number"
          value={order}
          onChange={(e) => setOrder(Number(e.target.value))}
        />
        <Input
          label="タイムスタンプ"
          value={timestamp}
          onChange={(e) => setTimestamp(e.target.value)}
          placeholder="例: 第一章冒頭"
        />
        {novelSections.length > 0 && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              紐づける節
            </label>
            <select
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">なし</option>
              {novelSections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title || `節 ${s.order}`}
                </option>
              ))}
            </select>
          </div>
        )}
        {error && <p className="text-sm text-rose-500">{error}</p>}
      </form>
    </Modal>
  );
}
