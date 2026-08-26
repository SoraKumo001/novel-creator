import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/Button.js';
import { Card, CardHeader } from '@/components/Card.js';
import { ConfirmDialog } from '@/components/ConfirmDialog.js';
import { EmptyState } from '@/components/EmptyState.js';
import { Input } from '@/components/Input.js';
import { Loading } from '@/components/Loading.js';
import { MarkdownText } from '@/components/MarkdownText.js';
import { Modal } from '@/components/Modal.js';
import { Tag } from '@/components/Tag.js';
import { Textarea } from '@/components/Textarea.js';
import { useChapters } from '@/hooks/useChapters.js';
import { useCharacters } from '@/hooks/useCharacters.js';
import { useContent } from '@/hooks/useContent.js';
import { useGenerate } from '@/hooks/useGenerate.js';
import { useNovel } from '@/hooks/useNovel.js';
import { useSettings } from '@/hooks/useSettings.js';
import { useTimelines } from '@/hooks/useTimelines.js';
import type { Chapter, Character, ExtractResult, Section, Setting, Timeline } from '@/lib/types.js';
import { countWords } from '@/lib/sse.js';
import { MonacoEditor } from '../_components/-MonacoEditor.js';
import { CharactersMarkdownEditor } from '../_components/-CharactersMarkdownEditor.js';
import { SettingsMarkdownEditor } from '../_components/-SettingsMarkdownEditor.js';

export const Route = createFileRoute('/novels/$novelId/')({
  validateSearch: (search: Record<string, unknown>) =>
    ({
      tab: (['overview', 'settings', 'characters', 'plot', 'editor', 'timeline'].includes(
        search.tab as string,
      )
        ? search.tab
        : undefined) as TabId | undefined,
    }) as { tab?: TabId },
  component: NovelDetailPage,
});

type TabId = 'overview' | 'settings' | 'characters' | 'plot' | 'editor' | 'timeline';

function NovelDetailPage() {
  const { novelId } = Route.useParams();
  const { novel, loading, error, refetch } = useNovel(novelId);
  const { tab } = Route.useSearch();
  const activeTab: TabId = tab ?? 'overview';
  const navigate = useNavigate();

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: '概要' },
    { id: 'settings', label: '設定' },
    { id: 'characters', label: '人物' },
    { id: 'plot', label: 'プロット' },
    { id: 'editor', label: '本文' },
    { id: 'timeline', label: 'タイムライン' },
  ];

  return (
    <div className="flex h-full max-w-6xl flex-col">
      {loading && <Loading message="小説を読み込み中..." />}
      {!loading && error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-300">
          {error}
        </div>
      )}
      {novel && (
        <>
          <header className="mb-6 shrink-0">
            <div className="mb-1 text-sm font-medium text-indigo-600 dark:text-indigo-400">
              小説詳細
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {novel.title}
            </h1>
            {novel.description && (
              <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">
                {novel.description}
              </p>
            )}
          </header>
          <nav className="mb-6 shrink-0 border-b border-slate-200 dark:border-slate-700">
            <div className="flex gap-1 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() =>
                    navigate({
                      to: '/novels/$novelId',
                      params: { novelId },
                      search: { tab: tab.id },
                    })
                  }
                  className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                    activeTab === tab.id
                      ? 'border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300'
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </nav>
          <div className="min-h-0 flex-1 overflow-auto">
            {activeTab === 'overview' && <OverviewTab novel={novel} onRefresh={refetch} />}
            {activeTab === 'settings' && <SettingsTab novel={novel} onRefresh={refetch} />}
            {activeTab === 'characters' && <CharactersTab novel={novel} onRefresh={refetch} />}
            {activeTab === 'plot' && <PlotTab novel={novel} onRefresh={refetch} />}
            {activeTab === 'editor' && <EditorTab novel={novel} onRefresh={refetch} />}
            {activeTab === 'timeline' && <TimelineTab novel={novel} onRefresh={refetch} />}
          </div>
        </>
      )}
    </div>
  );
}

// ---------- 概要タブ ----------
function OverviewTab({
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

// ---------- 設定タブ ----------
function SettingsTab({
  novel,
  onRefresh,
}: {
  novel: NonNullable<ReturnType<typeof useNovel>['novel']>;
  onRefresh: () => Promise<void>;
}) {
  const {
    settings,
    loading,
    deleteSetting,
    deleting,
    fetchSettingsMarkdown,
    saveSettingsMarkdown,
    editSettingSection,
    editSettingDocument,
    savingMarkdown,
    editingSection,
    editingDocument,
  } = useSettings(novel.id);
  const navigate = useNavigate();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'markdown'>('cards');

  const grouped = useMemo(() => {
    const map = new Map<string, Setting[]>();
    for (const s of settings) {
      const list = map.get(s.category) ?? [];
      list.push(s);
      map.set(s.category, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [settings]);

  async function handleDelete() {
    if (!deletingId) return;
    await deleteSetting(deletingId);
    setDeletingId(null);
    await onRefresh();
  }

  return (
    <div className="flex h-full flex-col space-y-6">
      <div className="flex shrink-0 items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">設定一覧</h2>
        <div className="flex items-center gap-2">
          {viewMode === 'cards' && (
            <Button
              onClick={() =>
                navigate({ to: '/novels/$novelId/settings/new', params: { novelId: novel.id } })
              }
              leftIcon={<PlusIcon />}
            >
              新規作成
            </Button>
          )}
          <div className="flex rounded-lg border border-slate-300 p-0.5 dark:border-slate-700">
            <button
              onClick={() => setViewMode('cards')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                viewMode === 'cards'
                  ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              カード表示
            </button>
            <button
              onClick={() => setViewMode('markdown')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                viewMode === 'markdown'
                  ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              マークダウン編集
            </button>
          </div>
        </div>
      </div>
      {viewMode === 'markdown' ? (
        <div className="min-h-0 flex-1">
          <SettingsMarkdownEditor
            novelId={novel.id}
            fetchSettingsMarkdown={fetchSettingsMarkdown}
            saveSettingsMarkdown={saveSettingsMarkdown}
            editSettingSection={editSettingSection}
            editSettingDocument={editSettingDocument}
            savingMarkdown={savingMarkdown}
            editingSection={editingSection}
            editingDocument={editingDocument}
          />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          {loading && <Loading message="設定を読み込み中..." />}
          {!loading && settings.length === 0 && (
            <EmptyState
              title="設定がありません"
              description="世界観や魔法体系などを登録しましょう。"
            />
          )}
          {!loading &&
            grouped.map(([category, items]) => (
              <div key={category}>
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {category}
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((setting) => (
                    <Card key={setting.id}>
                      <CardHeader
                        title={setting.name}
                        action={
                          <div className="flex gap-1">
                            <IconButton
                              label="編集"
                              onClick={() =>
                                navigate({
                                  to: '/novels/$novelId/settings/$settingId',
                                  params: { novelId: novel.id, settingId: setting.id },
                                })
                              }
                              icon={<PencilIcon />}
                            />
                            <IconButton
                              label="削除"
                              onClick={() => setDeletingId(setting.id)}
                              icon={<TrashIcon />}
                            />
                          </div>
                        }
                      />
                      <MarkdownText
                        content={setting.description || '説明なし'}
                        className="text-sm text-slate-600 dark:text-slate-300"
                      />
                    </Card>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
      <ConfirmDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="設定を削除しますか？"
        message="この操作は元に戻せません。"
        confirmLabel="削除"
        isLoading={deleting}
      />
    </div>
  );
}

// ---------- 人物タブ ----------
function CharactersTab({
  novel,
  onRefresh,
}: {
  novel: NonNullable<ReturnType<typeof useNovel>['novel']>;
  onRefresh: () => Promise<void>;
}) {
  const {
    characters,
    loading,
    createCharacter,
    updateCharacter,
    deleteCharacter,
    llmEditCharacter,
    fetchCharactersMarkdown,
    saveCharactersMarkdown,
    editCharacterSection,
    editCharacterDocument,
    creating,
    updating,
    deleting,
    llmEditing,
    savingMarkdown,
    editingSection,
    editingDocument,
  } = useCharacters(novel.id);
  const [viewMode, setViewMode] = useState<'cards' | 'markdown'>('cards');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Character | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [llmTarget, setLlmTarget] = useState<Character | null>(null);
  const [llmInstruction, setLlmInstruction] = useState('');

  const grouped = useMemo(() => {
    const map = new Map<string, Character[]>();
    for (const c of characters) {
      const cat = c.category || '未分類';
      const list = map.get(cat) ?? [];
      list.push(c);
      map.set(cat, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [characters]);

  async function handleCreate(input: {
    category: string;
    name: string;
    description: string;
    traits: string[];
  }) {
    await createCharacter(input);
    setIsCreateOpen(false);
    await onRefresh();
  }

  async function handleUpdate(input: {
    category: string;
    name: string;
    description: string;
    traits: string[];
  }) {
    if (!editing) return;
    await updateCharacter(editing.id, input);
    setEditing(null);
    await onRefresh();
  }

  async function handleDelete() {
    if (!deletingId) return;
    await deleteCharacter(deletingId);
    setDeletingId(null);
    await onRefresh();
  }

  async function handleLlmEdit() {
    if (!llmTarget) return;
    await llmEditCharacter(llmTarget.id, llmInstruction);
    setLlmTarget(null);
    setLlmInstruction('');
    await onRefresh();
  }

  return (
    <div className="flex h-full flex-col space-y-6">
      <div className="flex shrink-0 items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">人物一覧</h2>
        <div className="flex items-center gap-2">
          {viewMode === 'cards' && (
            <Button onClick={() => setIsCreateOpen(true)} leftIcon={<PlusIcon />}>
              新規作成
            </Button>
          )}
          <div className="flex rounded-lg border border-slate-300 p-0.5 dark:border-slate-700">
            <button
              onClick={() => setViewMode('cards')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                viewMode === 'cards'
                  ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              カード表示
            </button>
            <button
              onClick={() => setViewMode('markdown')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                viewMode === 'markdown'
                  ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              マークダウン編集
            </button>
          </div>
        </div>
      </div>
      {viewMode === 'markdown' ? (
        <div className="min-h-0 flex-1">
          <CharactersMarkdownEditor
            novelId={novel.id}
            fetchCharactersMarkdown={fetchCharactersMarkdown}
            saveCharactersMarkdown={saveCharactersMarkdown}
            editCharacterSection={editCharacterSection}
            editCharacterDocument={editCharacterDocument}
            savingMarkdown={savingMarkdown}
            editingSection={editingSection}
            editingDocument={editingDocument}
          />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          {loading && <Loading message="人物を読み込み中..." />}
          {!loading && characters.length === 0 && (
            <EmptyState
              title="人物が登録されていません"
              description="主人公や脇役を登録して、物語を豊かにしましょう。"
            />
          )}
          {!loading &&
            grouped.map(([category, items]) => (
              <div key={category}>
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {category}
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((character) => (
                    <Card key={character.id}>
                      <CardHeader
                        title={character.name}
                        action={
                          <div className="flex gap-1">
                            <IconButton
                              label="編集"
                              onClick={() => setEditing(character)}
                              icon={<PencilIcon />}
                            />
                            <IconButton
                              label="LLMで編集"
                              onClick={() => setLlmTarget(character)}
                              icon={<SparklesIcon />}
                            />
                            <IconButton
                              label="削除"
                              onClick={() => setDeletingId(character.id)}
                              icon={<TrashIcon />}
                            />
                          </div>
                        }
                      />
                      <MarkdownText
                        content={character.description || '説明なし'}
                        className="mb-3 text-sm text-slate-600 dark:text-slate-300"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {character.traits?.map((t) => (
                          <Tag key={t}>{t}</Tag>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
      <CharacterFormModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
        isLoading={creating}
        title="人物を新規作成"
      />
      <CharacterFormModal
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        onSubmit={handleUpdate}
        isLoading={updating}
        title="人物を編集"
        defaultValues={editing ?? undefined}
      />
      <Modal
        isOpen={!!llmTarget}
        onClose={() => setLlmTarget(null)}
        title={`${llmTarget?.name ?? ''} をLLMで編集`}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setLlmTarget(null)} disabled={llmEditing}>
              キャンセル
            </Button>
            <Button onClick={handleLlmEdit} isLoading={llmEditing}>
              適用
            </Button>
          </>
        }
      >
        <Textarea
          label="指示"
          value={llmInstruction}
          onChange={(e) => setLlmInstruction(e.target.value)}
          placeholder="例: もっと大胆な性格にして"
          rows={4}
        />
      </Modal>
      <ConfirmDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="人物を削除しますか？"
        message="この操作は元に戻せません。"
        confirmLabel="削除"
        isLoading={deleting}
      />
    </div>
  );
}

function CharacterFormModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  title,
  defaultValues,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: {
    category: string;
    name: string;
    description: string;
    traits: string[];
  }) => Promise<void>;
  isLoading: boolean;
  title: string;
  defaultValues?: Character;
}) {
  const [category, setCategory] = useState(defaultValues?.category ?? '');
  const [name, setName] = useState(defaultValues?.name ?? '');
  const [description, setDescription] = useState(defaultValues?.description ?? '');
  const [traitsText, setTraitsText] = useState(defaultValues?.traits?.join(', ') ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCategory(defaultValues?.category ?? '');
      setName(defaultValues?.name ?? '');
      setDescription(defaultValues?.description ?? '');
      setTraitsText(defaultValues?.traits?.join(', ') ?? '');
      setError(null);
    }
  }, [isOpen, defaultValues]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('名前を入力してください');
      return;
    }
    const traits = traitsText
      .split(/[,、，]/)
      .map((t) => t.trim())
      .filter(Boolean);
    await onSubmit({
      category: category.trim() || '未分類',
      name: name.trim(),
      description: description.trim(),
      traits,
    });
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
        <Input
          label="カテゴリー"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="主人公, 脇役, 敵役..."
        />
        <Input label="名前" value={name} onChange={(e) => setName(e.target.value)} />
        <Textarea
          label="説明"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
        />
        <Input
          label="特徴（カンマ区切り）"
          value={traitsText}
          onChange={(e) => setTraitsText(e.target.value)}
          placeholder="勇敢, 好奇心旺盛, 一匹狼"
        />
        {error && <p className="text-sm text-rose-500">{error}</p>}
      </form>
    </Modal>
  );
}

// ---------- プロットタブ ----------
function PlotTab({
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

// ---------- 本文タブ ----------
function EditorTab({
  novel,
  onRefresh,
}: {
  novel: NonNullable<ReturnType<typeof useNovel>['novel']>;
  onRefresh: () => Promise<void>;
}) {
  const { chapters } = useChapters(novel.id);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [editorKey, setEditorKey] = useState(0);

  const selectedChapter = chapters.find((c) => c.id === selectedChapterId);
  const selectedSection = selectedChapter?.sections.find((s) => s.id === selectedSectionId);

  useEffect(() => {
    if (chapters.length > 0 && !selectedChapterId) {
      setSelectedChapterId(chapters[0].id);
      setSelectedSectionId(chapters[0].sections[0]?.id ?? null);
    }
  }, [chapters, selectedChapterId]);

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-4">
      <div className="w-64 shrink-0 overflow-auto rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
        <h3 className="mb-3 px-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          章 / 節
        </h3>
        {chapters.length === 0 && (
          <p className="px-2 text-sm text-slate-400 dark:text-slate-500">章がありません。</p>
        )}
        {chapters.map((chapter) => (
          <div key={chapter.id} className="mb-2">
            <div className="px-2 py-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
              {chapter.title}
            </div>
            {chapter.sections.map((section) => (
              <button
                key={section.id}
                onClick={() => {
                  setSelectedChapterId(chapter.id);
                  setSelectedSectionId(section.id);
                  setEditorKey((k) => k + 1);
                }}
                className={`block w-full rounded px-2 py-1 text-left text-sm transition ${
                  selectedSectionId === section.id
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                    : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-700'
                }`}
              >
                {section.title || `節 ${section.order}`}
              </button>
            ))}
          </div>
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        {selectedSection ? (
          <SectionEditor key={editorKey} section={selectedSection} onRefresh={onRefresh} />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400 dark:text-slate-500">
            節を選択してください
          </div>
        )}
      </div>
    </div>
  );
}

function SectionEditor({
  section,
  onRefresh,
}: {
  section: Section;
  onRefresh: () => Promise<void>;
}) {
  const { content, loading, saving, updateContent } = useContent(section.id);
  const { generateContent, generatingContent, extract, extracting, streamError, resetStreamError } =
    useGenerate();
  const [localBody, setLocalBody] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [extractResultOpen, setExtractResultOpen] = useState(false);
  const [extracted, setExtracted] = useState<ExtractResult | null>(null);

  useEffect(() => {
    if (content) {
      setLocalBody(content.body);
      setWordCount(content.wordCount ?? countWords(content.body));
    }
  }, [content]);

  useEffect(() => {
    setWordCount(countWords(localBody));
  }, [localBody]);

  async function handleSave() {
    await updateContent(localBody);
    await onRefresh();
  }

  async function handleGenerate() {
    resetStreamError();
    let accumulated = localBody;
    await generateContent(section.id, (chunk) => {
      accumulated += chunk;
      setLocalBody(accumulated);
    });
    await updateContent(accumulated);
  }

  async function handleExtract() {
    if (!localBody.trim()) return;
    const result = await extract(section.id);
    setExtracted(result);
    setExtractResultOpen(true);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-700">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">
            {section.title || `節 ${section.order}`}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            文字数: {wordCount.toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleExtract}
            isLoading={extracting}
            disabled={!localBody.trim()}
          >
            整合性更新
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleGenerate}
            isLoading={generatingContent}
            leftIcon={<SparklesIcon />}
          >
            本文生成
          </Button>
          <Button size="sm" onClick={handleSave} isLoading={saving}>
            保存
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <Loading message="本文を読み込み中..." />
        ) : (
          <MonacoEditor value={localBody} onChange={setLocalBody} />
        )}
      </div>
      {generatingContent && (
        <div className="flex items-center gap-2 border-t border-slate-100 px-5 py-2 text-xs text-indigo-600 dark:border-slate-700 dark:text-indigo-300">
          <span className="h-3 w-3 animate-pulse rounded-full bg-indigo-500" />
          本文を生成中…
        </div>
      )}
      {streamError && (
        <div className="border-t border-rose-100 bg-rose-50 px-5 py-2 text-xs text-rose-600 dark:border-rose-900/30 dark:bg-rose-900/20">
          {streamError}
        </div>
      )}
      <ExtractResultModal
        isOpen={extractResultOpen}
        onClose={() => setExtractResultOpen(false)}
        result={extracted}
      />
    </div>
  );
}

function ExtractResultModal({
  isOpen,
  onClose,
  result,
}: {
  isOpen: boolean;
  onClose: () => void;
  result: ExtractResult | null;
}) {
  if (!result) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="整合性更新結果"
      size="lg"
      footer={
        <Button variant="secondary" onClick={onClose}>
          閉じる
        </Button>
      }
    >
      <div className="space-y-5">
        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            抽出された時系列
          </h4>
          {result.timelines.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">ありません</p>
          ) : (
            <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
              {result.timelines.map((timeline: Timeline) => (
                <li
                  key={timeline.id}
                  className="rounded bg-slate-50 px-3 py-2 dark:bg-slate-700/50"
                >
                  {timeline.timestamp && (
                    <span className="mr-2 text-xs text-slate-500 dark:text-slate-400">
                      {timeline.timestamp}
                    </span>
                  )}
                  {timeline.event}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            抽出された設定
          </h4>
          {result.settings.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">ありません</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {result.settings.map((setting: Setting) => (
                <li key={setting.id} className="rounded bg-slate-50 px-3 py-2 dark:bg-slate-700/50">
                  <span className="text-xs font-bold uppercase text-indigo-600 dark:text-indigo-400">
                    {setting.category}
                  </span>
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    {setting.name}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-300">
                    {setting.description}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ---------- タイムラインタブ ----------
function TimelineTab({
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

// ---------- 共通アイコン・補助 ----------
function IconButton({
  label,
  onClick,
  icon,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className="rounded p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200"
    >
      {icon}
    </button>
  );
}

function PlusIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className="h-4 w-4"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="h-4 w-4"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.76a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.862 4.487zM19.5 7.125V18a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 18V8.25A2.25 2.25 0 016.75 6h9.375"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="h-4 w-4"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
      />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="h-4 w-4"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="h-4 w-4"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="h-4 w-4"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
    </svg>
  );
}
