import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/Button.js';
import { Card, CardHeader } from '@/components/Card.js';
import { ConfirmDialog } from '@/components/ConfirmDialog.js';
import { HistoryDiffModal } from '@/components/HistoryDiffModal.js';
import { Input } from '@/components/Input.js';
import { Loading } from '@/components/Loading.js';
import { Textarea } from '@/components/Textarea.js';
import { useCharacters } from '@/hooks/useCharacters.js';
import { useLlmInstructions } from '@/hooks/useLlmInstructions.js';
import { useToast } from '@/hooks/useToast.js';
import { fetchCharacters } from '@/lib/services/index.js';
import { MonacoEditor } from './-MonacoEditor.js';

interface CharacterEditorProps {
  novelId: string;
  characterId?: string;
}

export function CharacterEditor({ novelId, characterId }: CharacterEditorProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const {
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
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteInstructionId, setDeleteInstructionId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const isEdit = !!characterId;

  useEffect(() => {
    if (!characterId) return;
    let active = true;
    setLoading(true);
    fetchCharacters(novelId)
      .then((characters) => {
        if (!active) return;
        const target = characters.find((c) => c.id === characterId);
        if (target) {
          setCategory(target.category ?? '');
          setName(target.name);
          setDescription(target.description ?? '');
          setTraitsText(target.traits?.join(', ') ?? '');
        }
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : '人物情報の取得に失敗しました');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [novelId, characterId]);

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

  if (loading) return <Loading message="人物情報を読み込み中..." />;

  const isBusy = creating || updating || llmEditing || generating;

  return (
    <div className="flex h-full w-full flex-col space-y-4">
      {/* ナビゲーション & ヘッダー */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              navigate({
                to: '/novels/$novelId',
                params: { novelId },
                search: { tab: 'characters' },
              })
            }
            leftIcon={
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="h-4 w-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
                />
              </svg>
            }
          >
            人物一覧に戻る
          </Button>
          <div className="h-4 w-px bg-border" />
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {isEdit ? '人物を編集' : '新規人物の作成'}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {isEdit && characterId && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setHistoryOpen(true)}
              title="編集履歴と差分を確認・復元"
            >
              🕒 履歴
            </Button>
          )}
          <Button
            variant="primary"
            onClick={handleSave}
            isLoading={creating || updating}
            disabled={!name.trim() || isBusy}
            title="保存 (Ctrl+S)"
          >
            保存する
          </Button>
        </div>
      </div>

      {error && (
        <div className="shrink-0 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* 2カラム 画面領域フル活用レイアウト */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-12 overflow-hidden pb-4">
        {/* 左カラム: 基本情報 + Monaco エディタ (7/12) */}
        <div className="flex min-h-0 flex-col space-y-4 lg:col-span-7 xl:col-span-8">
          <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <CardHeader title="基本情報" />
            <div className="flex min-h-0 flex-1 flex-col space-y-4 p-1">
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
            </div>
          </Card>
        </div>

        {/* 右カラム: LLMで作成・編集 & 履歴 (5/12) */}
        <div className="flex flex-col space-y-4 lg:col-span-5 xl:col-span-4 overflow-y-auto pr-1">
          <Card>
            <CardHeader title="AIで作成・編集" />
            <div className="space-y-4">
              <Textarea
                label="AIへの指示"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="例: もっと大胆な性格にして。過去のトラウマに関する設定を追加して。外見や決め台詞を具体化して。"
                rows={4}
              />
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  onClick={handleGenerate}
                  isLoading={isBusy}
                  disabled={!instruction.trim() || isBusy}
                  leftIcon={<SparklesIcon />}
                  className="w-full"
                >
                  {isEdit ? 'AIで人物を更新' : 'AIでドラフト生成'}
                </Button>
              </div>

              {instructions.length > 0 && (
                <div className="pt-2 border-t border-border">
                  <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    過去のプロンプト履歴
                  </h4>
                  <ul className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {instructions.map((item) => (
                      <li
                        key={item.id}
                        className="group flex items-start justify-between gap-2 rounded-lg border border-border bg-surface-raised/50 p-2.5 transition hover:border-primary/50 hover:bg-surface-raised"
                      >
                        <button
                          type="button"
                          onClick={() => applyHistory(item.instruction)}
                          className="flex-1 text-left text-xs text-foreground transition group-hover:text-primary leading-relaxed"
                          title="この指示を入力欄に適用"
                        >
                          {item.instruction}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteInstructionId(item.id)}
                          title="履歴から削除"
                          className="rounded p-1 text-muted-foreground opacity-60 hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition shrink-0"
                        >
                          <TrashIcon />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!deleteInstructionId}
        onClose={() => setDeleteInstructionId(null)}
        onConfirm={handleDeleteInstruction}
        title="履歴を削除しますか？"
        message="この操作は元に戻せません。"
        confirmLabel="削除"
        isLoading={deletingInstruction}
      />

      {isEdit && characterId && (
        <HistoryDiffModal
          isOpen={historyOpen}
          onClose={() => setHistoryOpen(false)}
          novelId={novelId}
          entityType="character"
          entityId={characterId}
          currentContent={description}
          title={`人物: ${name || '（名称未設定）'}`}
          onRestoreSuccess={(restored) => {
            setDescription(restored);
          }}
        />
      )}
    </div>
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
