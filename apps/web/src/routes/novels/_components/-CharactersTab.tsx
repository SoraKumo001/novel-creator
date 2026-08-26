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
import { useCharacters } from '@/hooks/useCharacters.js';
import { useNovel } from '@/hooks/useNovel.js';
import type { Character } from '@/lib/types.js';
import { CharactersMarkdownEditor } from './-CharactersMarkdownEditor.js';
import { IconButton, PencilIcon, PlusIcon, SparklesIcon, TrashIcon } from './-Icons.js';

export function CharactersTab({
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
        <div className="min-h-0 flex-1 overflow-auto space-y-8 pr-1 pb-8">
          {loading && <Loading message="人物を読み込み中..." />}
          {!loading && characters.length === 0 && (
            <EmptyState
              title="人物が登録されていません"
              description="主人公や脇役を登録して、物語を豊かにしましょう。"
            />
          )}
          {!loading &&
            grouped.map(([category, items]) => (
              <section key={category} className="space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2 dark:border-slate-800">
                  <span className="inline-block h-3.5 w-1 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {category}
                  </h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    {items.length}件
                  </span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((character) => (
                    <Card key={character.id} className="flex flex-col justify-between">
                      <div>
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
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                        {character.traits?.map((t) => (
                          <Tag key={t}>{t}</Tag>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
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
