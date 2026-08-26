import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '@/components/Button.js';
import { Card, CardHeader } from '@/components/Card.js';
import { ConfirmDialog } from '@/components/ConfirmDialog.js';
import { Input } from '@/components/Input.js';
import { Modal } from '@/components/Modal.js';
import { Textarea } from '@/components/Textarea.js';
import { useNovel } from '@/hooks/useNovel.js';
import { TrashIcon } from './-Icons.js';

export function OverviewTab({
  novel,
  onRefresh,
}: {
  novel: NonNullable<ReturnType<typeof useNovel>['novel']>;
  onRefresh: () => Promise<void>;
}) {
  const { updateNovel, updating, deleteNovel, deleting } = useNovel(novel.id);
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [title, setTitle] = useState(novel.title);
  const [description, setDescription] = useState(novel.description ?? '');
  const [formError, setFormError] = useState<string | null>(null);

  async function handleDelete() {
    try {
      await deleteNovel(novel.id);
      navigate({ to: '/novels' });
    } catch (e) {
      setFormError(e instanceof Error ? e.message : '削除に失敗しました');
    }
  }

  async function handleSave() {
    setFormError(null);
    if (!title.trim()) {
      setFormError('タイトルを入力してください');
      return;
    }
    try {
      await updateNovel(novel.id, { title: title.trim(), description: description.trim() });
      setIsOpen(false);
      await onRefresh();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : '保存に失敗しました');
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-3">
        <StatCard label="章数" value={novel.chapters.length} />
        <StatCard label="人物" value={novel.characters.length} />
        <StatCard label="設定" value={novel.settings.length} />
      </div>
      <Card>
        <CardHeader
          title="基本情報"
          action={
            <Button variant="secondary" onClick={() => setIsOpen(true)}>
              編集
            </Button>
          }
        />
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-slate-500 dark:text-slate-400">タイトル</dt>
            <dd className="font-medium text-slate-900 dark:text-slate-100">{novel.title}</dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">説明</dt>
            <dd className="text-slate-700 dark:text-slate-300">{novel.description || '未設定'}</dd>
          </div>
        </dl>
      </Card>
      <div className="flex justify-end">
        <Button variant="secondary" onClick={() => setIsDeleteOpen(true)} leftIcon={<TrashIcon />}>
          この小説を削除
        </Button>
      </div>
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="小説情報を編集"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsOpen(false)} disabled={updating}>
              キャンセル
            </Button>
            <Button onClick={handleSave} isLoading={updating}>
              保存
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="タイトル" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea
            label="説明"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
          />
          {formError && <p className="text-sm text-rose-500">{formError}</p>}
        </div>
      </Modal>
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
        title="小説を削除しますか？"
        message="この小説と、紐づく章・節・本文・設定・人物・タイムラインがすべて削除されます。この操作は元に戻せません。"
        confirmLabel="削除"
        isLoading={deleting}
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">{value}</div>
    </Card>
  );
}
