import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Input } from '@/components/Input.js';
import { useCharacters } from '@/hooks/useCharacters.js';
import { useChatUI } from '@/context/ChatContext.js';
import { useLlmInstructions } from '@/hooks/useLlmInstructions.js';
import { useModalState } from '@/hooks/useModalResultState.js';
import { useToast } from '@/hooks/useToast.js';
import { toErrorMessage } from '@/lib/errors.js';
import { MonacoEditor } from './-MonacoEditor.js';
import { EntityEditorShell } from './-EntityEditorShell.js';

interface CharacterEditorProps {
  novelId: string;
  characterId?: string;
}

export function CharacterEditor({ novelId, characterId }: CharacterEditorProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const { openChat } = useChatUI();
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
  // 履歴削除確認ダイアログ（payload = 削除対象の指示ID）と履歴差分モーダル
  const deleteConfirm = useModalState<string>();
  const historyModal = useModalState();

  const isEdit = !!characterId;
  const loading = isEdit ? charactersLoading : false;

  const targetCharacter = useMemo(
    () => characters?.find((c) => c.id === characterId),
    [characters, characterId],
  );

  // 既存のカテゴリ一覧（サジェスト用）
  const existingCategories = useMemo(() => {
    const set = new Set<string>();
    for (const c of characters ?? []) {
      if (c.category?.trim()) {
        set.add(c.category.trim());
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ja'));
  }, [characters]);

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
      toast.error(toErrorMessage(e));
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
        const created = await createCharacter(input);
        // 新規作成後に重複保存が起きないよう編集ページへ置換遷移する（一覧には遷移しない）
        navigate({
          to: '/novels/$novelId/characters/$characterId',
          params: { novelId, characterId: created.id },
          replace: true,
        });
      }
      toast.success(isEdit ? '人物情報を更新しました' : '人物を作成しました');
    } catch (e) {
      toast.error(toErrorMessage(e));
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
    const targetId = deleteConfirm.payload;
    if (!targetId) return;
    await deleteInstruction(targetId);
    deleteConfirm.close();
  }

  function applyHistory(text: string) {
    setInstruction(text);
  }

  // 編集中フォームの現在値からチャット相談フォーカスを構築してドロワーを開く。
  // 未保存の編集内容が対象になる点が価値なので summary に「未保存」旨を添える。
  function handleChatConsult() {
    const summaryParts = [
      category.trim() && `カテゴリー: ${category.trim()}`,
      description.trim() &&
        `説明: ${description.trim().slice(0, 500)}${description.trim().length > 500 ? '…' : ''}`,
      isEdit && '※エディタ上の未保存の内容を含みます',
    ].filter(Boolean);
    openChat(novelId, {
      entityType: 'character',
      title: `人物「${name.trim() || '（名称未設定）'}」`,
      summary: summaryParts.length > 0 ? summaryParts.join('\n') : undefined,
    });
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
      onChatConsult={handleChatConsult}
      instructions={instructions}
      onApplyHistory={applyHistory}
      onRequestDeleteInstruction={deleteConfirm.open}
      deleteInstructionId={deleteConfirm.payload}
      onCloseDeleteInstruction={deleteConfirm.close}
      onConfirmDeleteInstruction={handleDeleteInstruction}
      deletingInstruction={deletingInstruction}
      historyOpen={historyModal.isOpen}
      onOpenHistory={historyModal.open}
      onCloseHistory={historyModal.close}
      entityType="character"
      currentContent={description}
      historyTitle={`人物: ${name || '（名称未設定）'}`}
      onRestoreSuccess={setDescription}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Input
            label="カテゴリー（スラッシュ区切りで階層化可能）"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="例: 採取ギルド / 採取メンバー, 騎士団 / 団長, 主人公..."
            list="character-categories-list"
          />
          <datalist id="character-categories-list">
            {existingCategories.map((cat) => (
              <option key={cat} value={cat} />
            ))}
          </datalist>
        </div>
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
