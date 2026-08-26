import { useEffect, useState } from 'react';
import { Button } from '@/components/Button.js';
import { ConfirmDialog } from '@/components/ConfirmDialog.js';
import { EmptyState } from '@/components/EmptyState.js';
import { Input } from '@/components/Input.js';
import { Loading } from '@/components/Loading.js';
import { Modal } from '@/components/Modal.js';
import { Textarea } from '@/components/Textarea.js';
import { useChapters } from '@/hooks/useChapters.js';
import { useGenerate } from '@/hooks/useGenerate.js';
import { useNovel } from '@/hooks/useNovel.js';
import type { Chapter, Section } from '@/lib/types.js';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  IconButton,
  PencilIcon,
  PlusIcon,
  SparklesIcon,
  TrashIcon,
} from './-Icons.js';

export function PlotTab({
  novel,
  onRefresh,
}: {
  novel: NonNullable<ReturnType<typeof useNovel>['novel']>;
  onRefresh: () => Promise<void>;
}) {
  const {
    chapters,
    loading,
    refetch: refetchChapters,
    createChapter,
    updateChapter,
    deleteChapter,
    createSection,
    updateSection,
    deleteSection,
    creating,
    updating,
    deleting,
  } = useChapters(novel.id);
  const {
    generatePlot,
    generateChapterSummary,
    generateSectionSummary,
    generatingPlot,
    generatingSummary,
    generatedPlot,
    resetGeneratedPlot,
  } = useGenerate();
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null);
  const [chapterForm, setChapterForm] = useState<Chapter | null>(null);
  const [sectionForm, setSectionForm] = useState<{ chapterId: string; section?: Section } | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'chapter' | 'section';
    id: string;
  } | null>(null);

  const [plotPreview, setPlotPreview] = useState(generatedPlot);

  useEffect(() => {
    if (generatedPlot) setPlotPreview(generatedPlot);
  }, [generatedPlot]);

  async function handleGeneratePlot() {
    resetGeneratedPlot();
    const plot = await generatePlot(novel.id);
    setPlotPreview(plot);
  }

  async function handleApplyPlot() {
    if (!plotPreview) return;
    for (const ch of plotPreview.chapters) {
      await createChapter({ title: ch.title, order: ch.order, summary: ch.summary });
    }
    setPlotPreview(null);
    await refetchChapters();
    await onRefresh();
  }

  async function handleSaveChapter(input: { title: string; order: number; summary: string }) {
    if (chapterForm) {
      await updateChapter(chapterForm.id, input);
    } else {
      await createChapter(input);
    }
    setChapterForm(null);
    await refetchChapters();
  }

  async function handleSaveSection(input: { title: string; order: number; summary: string }) {
    if (!sectionForm) return;
    if (sectionForm.section) {
      await updateSection(sectionForm.section.id, input);
    } else {
      await createSection(sectionForm.chapterId, input);
    }
    setSectionForm(null);
    await refetchChapters();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'chapter') {
      await deleteChapter(deleteTarget.id);
    } else {
      await deleteSection(deleteTarget.id);
    }
    setDeleteTarget(null);
    await refetchChapters();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">章立て</h2>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={handleGeneratePlot}
            isLoading={generatingPlot}
            leftIcon={<SparklesIcon />}
          >
            プロット生成
          </Button>
          <Button
            onClick={() =>
              setChapterForm({
                id: '',
                novelId: novel.id,
                title: '',
                order: chapters.length + 1,
                summary: null,
                createdAt: null,
                updatedAt: null,
              })
            }
            leftIcon={<PlusIcon />}
          >
            章を追加
          </Button>
        </div>
      </div>

      {plotPreview && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5 dark:border-indigo-900/50 dark:bg-indigo-900/20">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-indigo-900 dark:text-indigo-200">
              生成されたプロット
            </h3>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setPlotPreview(null)}>
                閉じる
              </Button>
              <Button size="sm" onClick={handleApplyPlot}>
                反映
              </Button>
            </div>
          </div>
          <p className="mb-2 text-sm font-medium text-indigo-800 dark:text-indigo-300">
            {plotPreview.title}
          </p>
          <p className="mb-4 text-sm text-indigo-700 dark:text-indigo-300">
            {plotPreview.description}
          </p>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300">
            {plotPreview.chapters.map((ch) => (
              <li key={ch.order}>
                <span className="font-medium">{ch.title}</span> — {ch.summary}
              </li>
            ))}
          </ol>
        </div>
      )}

      {loading && <Loading message="章を読み込み中..." />}
      {!loading && chapters.length === 0 && (
        <EmptyState
          title="章がありません"
          description="章を追加するか、プロット生成から始めましょう。"
        />
      )}

      {!loading &&
        chapters.map((chapter) => (
          <ChapterTreeItem
            key={chapter.id}
            chapter={chapter}
            isExpanded={expandedChapterId === chapter.id}
            onToggle={() =>
              setExpandedChapterId(expandedChapterId === chapter.id ? null : chapter.id)
            }
            onEditChapter={() => setChapterForm(chapter)}
            onDeleteChapter={() => setDeleteTarget({ type: 'chapter', id: chapter.id })}
            onGenerateChapterSummary={async () => {
              await generateChapterSummary(chapter.id);
              await refetchChapters();
            }}
            onAddSection={() => setSectionForm({ chapterId: chapter.id })}
            onEditSection={(s) => setSectionForm({ chapterId: chapter.id, section: s })}
            onDeleteSection={(s) => setDeleteTarget({ type: 'section', id: s.id })}
            onGenerateSectionSummary={async (s) => {
              await generateSectionSummary(s.id);
              await refetchChapters();
            }}
            generatingSummary={generatingSummary}
          />
        ))}

      <ChapterFormModal
        isOpen={!!chapterForm}
        onClose={() => setChapterForm(null)}
        onSubmit={handleSaveChapter}
        isLoading={chapterForm ? updating : creating}
        title={chapterForm ? '章を編集' : '章を追加'}
        defaultValues={chapterForm ?? undefined}
      />
      <SectionFormModal
        isOpen={!!sectionForm}
        onClose={() => setSectionForm(null)}
        onSubmit={handleSaveSection}
        isLoading={sectionForm?.section ? updating : creating}
        title={sectionForm?.section ? '節を編集' : '節を追加'}
        defaultValues={sectionForm?.section}
      />
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={deleteTarget?.type === 'chapter' ? '章を削除しますか？' : '節を削除しますか？'}
        message="紐づく本文や時系列も削除されます。"
        confirmLabel="削除"
        isLoading={deleting}
      />
    </div>
  );
}

function ChapterTreeItem({
  chapter,
  isExpanded,
  onToggle,
  onEditChapter,
  onDeleteChapter,
  onGenerateChapterSummary,
  onAddSection,
  onEditSection,
  onDeleteSection,
  onGenerateSectionSummary,
  generatingSummary,
}: {
  chapter: NonNullable<ReturnType<typeof useChapters>['chapters']>[number];
  isExpanded: boolean;
  onToggle: () => void;
  onEditChapter: () => void;
  onDeleteChapter: () => void;
  onGenerateChapterSummary: () => Promise<void>;
  onAddSection: () => void;
  onEditSection: (s: Section) => void;
  onDeleteSection: (s: Section) => void;
  onGenerateSectionSummary: (s: Section) => Promise<void>;
  generatingSummary: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center justify-between px-5 py-4">
        <button onClick={onToggle} className="flex items-center gap-3 text-left">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-slate-100 text-xs font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            {chapter.order}
          </span>
          <div>
            <div className="font-semibold text-slate-900 dark:text-slate-100">{chapter.title}</div>
            {chapter.summary && (
              <div className="text-sm text-slate-500 dark:text-slate-400">{chapter.summary}</div>
            )}
          </div>
        </button>
        <div className="flex items-center gap-1">
          <IconButton
            label="概要生成"
            onClick={onGenerateChapterSummary}
            icon={<SparklesIcon />}
            disabled={generatingSummary}
          />
          <IconButton label="編集" onClick={onEditChapter} icon={<PencilIcon />} />
          <IconButton label="削除" onClick={onDeleteChapter} icon={<TrashIcon />} />
          <IconButton
            label="展開"
            onClick={onToggle}
            icon={isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
          />
        </div>
      </div>
      {isExpanded && (
        <div className="border-t border-slate-100 px-5 pb-4 pt-2 dark:border-slate-700">
          {chapter.sections.length === 0 && (
            <p className="py-3 text-sm text-slate-400 dark:text-slate-500">節がありません。</p>
          )}
          {chapter.sections.map((section) => (
            <div key={section.id} className="flex items-start justify-between py-2">
              <div>
                <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  {section.title || `節 ${section.order}`}
                </div>
                {section.summary && (
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {section.summary}
                  </div>
                )}
              </div>
              <div className="flex gap-1">
                <IconButton
                  label="概要生成"
                  onClick={() => onGenerateSectionSummary(section)}
                  icon={<SparklesIcon />}
                  disabled={generatingSummary}
                />
                <IconButton
                  label="編集"
                  onClick={() => onEditSection(section)}
                  icon={<PencilIcon />}
                />
                <IconButton
                  label="削除"
                  onClick={() => onDeleteSection(section)}
                  icon={<TrashIcon />}
                />
              </div>
            </div>
          ))}
          <Button size="sm" variant="ghost" onClick={onAddSection} leftIcon={<PlusIcon />}>
            節を追加
          </Button>
        </div>
      )}
    </div>
  );
}

function ChapterFormModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  title,
  defaultValues,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: { title: string; order: number; summary: string }) => Promise<void>;
  isLoading: boolean;
  title: string;
  defaultValues?: Chapter;
}) {
  const [formTitle, setFormTitle] = useState(defaultValues?.title ?? '');
  const [order, setOrder] = useState(defaultValues?.order ?? 1);
  const [summary, setSummary] = useState(defaultValues?.summary ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFormTitle(defaultValues?.title ?? '');
      setOrder(defaultValues?.order ?? 1);
      setSummary(defaultValues?.summary ?? '');
      setError(null);
    }
  }, [isOpen, defaultValues]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!formTitle.trim()) {
      setError('タイトルを入力してください');
      return;
    }
    await onSubmit({ title: formTitle.trim(), order, summary: summary.trim() });
  }

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
        <Input label="タイトル" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
        <Input
          label="順序"
          type="number"
          value={order}
          onChange={(e) => setOrder(Number(e.target.value))}
        />
        <Textarea
          label="概要"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={4}
        />
        {error && <p className="text-sm text-rose-500">{error}</p>}
      </form>
    </Modal>
  );
}

function SectionFormModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  title,
  defaultValues,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: { title: string; order: number; summary: string }) => Promise<void>;
  isLoading: boolean;
  title: string;
  defaultValues?: Section;
}) {
  const [formTitle, setFormTitle] = useState(defaultValues?.title ?? '');
  const [order, setOrder] = useState(defaultValues?.order ?? 1);
  const [summary, setSummary] = useState(defaultValues?.summary ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFormTitle(defaultValues?.title ?? '');
      setOrder(defaultValues?.order ?? 1);
      setSummary(defaultValues?.summary ?? '');
      setError(null);
    }
  }, [isOpen, defaultValues]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    await onSubmit({ title: formTitle.trim(), order, summary: summary.trim() });
  }

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
        <Input label="タイトル" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
        <Input
          label="順序"
          type="number"
          value={order}
          onChange={(e) => setOrder(Number(e.target.value))}
        />
        <Textarea
          label="概要"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={4}
        />
        {error && <p className="text-sm text-rose-500">{error}</p>}
      </form>
    </Modal>
  );
}
