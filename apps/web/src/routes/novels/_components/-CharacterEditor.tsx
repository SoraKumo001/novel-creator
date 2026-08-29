import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Input } from '@/components/Input.js';
import { useCharacters } from '@/hooks/useCharacters.js';
import { useLlmInstructions } from '@/hooks/useLlmInstructions.js';
import { useToast } from '@/hooks/useToast.js';
import { MonacoEditor } from './-MonacoEditor.js';
import { EntityEditorShell } from './-EntityEditorShell.js';

interface CharacterEditorProps {
  novelId: string;
  characterId?: string;
}

export function CharacterEditor({ novelId, characterId }: CharacterEditorProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const {
    characters,
    loading: charactersLoading,
    error: queryError,
    createCharacter,
    updateCharacter,
    llmEditCharacter,
    editCharacterSection,
    creating,
    updating,
    llmEditing,
  } = useCharacters(novelId);
  const {
    instructions,
    saveInstruction,
    deleteInstruction,
    deleting: deletingInstruction,
  } = useLlmInstructions(novelId, 'character');

  const [category, setCategory] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [traitsText, setTraitsText] = useState('');
  const [instruction, setInstruction] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteInstructionId, setDeleteInstructionId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const isEdit = !!characterId;
  const loading = isEdit ? charactersLoading : false;

  const targetCharacter = useMemo(
    () => characters?.find((c) => c.id === characterId),
    [characters, characterId],
  );

  // 編集対象の人物情報をフォームに反映
  // 同一IDの再取得（refetch）で編集中のフォームを再初期化しないよう、反映済みIDでガードする
  const populatedCharacterIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!targetCharacter) return;
    if (populatedCharacterIdRef.current === targetCharacter.id) return;
    populatedCharacterIdRef.current = targetCharacter.id;
    setCategory(targetCharacter.category ?? '');
    setName(targetCharacter.name);
    setDescription(targetCharacter.description ?? '');
    setTraitsText(targetCharacter.traits?.join(', ') ?? '');
  }, [targetCharacter]);

  // クエリのエラーを表示用の error に反映（編集時のみ）
  useEffect(() => {
    if (isEdit) setError(queryError);
  }, [isEdit, queryError]);

  async function handleGenerate() {
    if (!instruction.trim()) return;
    setError(null);
    setGenerating(true);
    try {
      if (isEdit && characterId) {
        const result = await llmEditCharacter(characterId, instruction.trim());
        setCategory(result.category ?? '');
        setName(result.name);
        setDescription(result.description ?? '');
        setTraitsText(result.traits?.join(', ') ?? '');
      } else {
        const traits = traitsText
          .split(/[,、，]/)
          .map((t) => t.trim())
          .filter(Boolean);
        const resultMarkdown = await editCharacterSection({
          category: category.trim() || '主要人物',
          name: name.trim() || '未定の人物',
          description: description.trim(),
          traits,
          relationships: '',
          instruction: instruction.trim(),
        });
        setDescription(resultMarkdown);
      }
      // 履歴に保存
      await saveInstruction({ entityType: 'character', instruction: instruction.trim() });
      toast.success('AI編集が完了しました');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'AI生成に失敗しました');
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    setError(null);
    if (!name.trim()) {
      toast.error('名前は必須です');
      return;
    }
    const traits = traitsText
      .split(/[,、，]/)
      .map((t) => t.trim())
      .filter(Boolean);
    try {
      const input = {
        category: category.trim() || '未分類',
        name: name.trim(),
        description: description.trim(),
        traits,
      };
      if (isEdit && characterId) {
        await updateCharacter(characterId, input);
      } else {
        await createCharacter(input);
      }
      toast.success(isEdit ? '人物情報を更新しました' : '人物を作成しました');
      navigate({ to: '/novels/$novelId', params: { novelId }, search: { tab: 'characters' } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '保存に失敗しました');
    }
  }

  // Ctrl+S / Cmd+S ショートカットで保存
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (name.trim() && !creating && !updating) {
          void handleSave();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [category, characterId, creating, description, isEdit, name, novelId, traitsText, updating]);

  async function handleDeleteInstruction() {
    if (!deleteInstructionId) return;
    await deleteInstruction(deleteInstructionId);
    setDeleteInstructionId(null);
  }

  function applyHistory(text: string) {
    setInstruction(text);
  }

  const isBusy = creating || updating || llmEditing || generating;

  return (
    <EntityEditorShell
      novelId={novelId}
      backLabel="人物一覧に戻る"
      backTab="characters"
      title={isEdit ? '人物を編集' : '新規人物の作成'}
      isEdit={isEdit}
      entityId={characterId}
      onSave={handleSave}
      saveLoading={creating || updating}
      saveDisabled={!name.trim() || isBusy}
      error={error}
      loading={loading}
      loadingMessage="人物情報を読み込み中..."
      instruction={instruction}
      onInstructionChange={setInstruction}
      instructionPlaceholder="例: もっと大胆な性格にして。過去のトラウマに関する設定を追加して。外見や決め台詞を具体化して。"
      onGenerate={handleGenerate}
      generateLoading={isBusy}
      generateDisabled={!instruction.trim() || isBusy}
      generateLabel={isEdit ? 'AIで人物を更新' : 'AIでドラフト生成'}
      instructions={instructions}
      onApplyHistory={applyHistory}
      onRequestDeleteInstruction={setDeleteInstructionId}
      deleteInstructionId={deleteInstructionId}
      onCloseDeleteInstruction={() => setDeleteInstructionId(null)}
      onConfirmDeleteInstruction={handleDeleteInstruction}
      deletingInstruction={deletingInstruction}
      historyOpen={historyOpen}
      onOpenHistory={() => setHistoryOpen(true)}
      onCloseHistory={() => setHistoryOpen(false)}
      entityType="character"
      currentContent={description}
      historyTitle={`人物: ${name || '（名称未設定）'}`}
      onRestoreSuccess={setDescription}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="カテゴリー"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="例: 主要人物, サブキャラクター, 敵役, 協力者..."
        />
        <Input
          label="名前"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例: 大正一, ヒロイン..."
        />
      </div>

      <Input
        label="特徴・性格（カンマ区切り）"
        value={traitsText}
        onChange={(e) => setTraitsText(e.target.value)}
        placeholder="例: 勇敢, 剣術が得意, 一匹狼, 心優しい..."
      />

      {/* 説明 MonacoEditor */}
      <div className="flex min-h-0 flex-1 flex-col space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-foreground">
            説明・背景（Markdown 対応）
          </label>
          <span className="text-[11px] text-muted-foreground">
            {description.length.toLocaleString()} 文字
          </span>
        </div>
        <div className="min-h-[260px] flex-1 rounded-xl border border-border bg-surface overflow-hidden shadow-inner">
          <MonacoEditor value={description} onChange={setDescription} />
        </div>
      </div>
    </EntityEditorShell>
  );
}
