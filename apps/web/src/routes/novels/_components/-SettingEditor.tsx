import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/Button.js';
import { Card, CardHeader } from '@/components/Card.js';
import { ConfirmDialog } from '@/components/ConfirmDialog.js';
import { Input } from '@/components/Input.js';
import { Loading } from '@/components/Loading.js';
import { Textarea } from '@/components/Textarea.js';
import { useLlmInstructions } from '@/hooks/useLlmInstructions.js';
import { useSettings } from '@/hooks/useSettings.js';
import { fetchSettings } from '@/lib/services/index.js';

interface SettingEditorProps {
  novelId: string;
  settingId?: string;
}

export function SettingEditor({ novelId, settingId }: SettingEditorProps) {
  const navigate = useNavigate();
  const { createSetting, updateSetting, generateDraft, creating, updating, generatingDraft } =
    useSettings(novelId);
  const {
    instructions,
    saveInstruction,
    deleteInstruction,
    deleting: deletingInstruction,
  } = useLlmInstructions(novelId, 'setting');

  const [category, setCategory] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteInstructionId, setDeleteInstructionId] = useState<string | null>(null);

  const isEdit = !!settingId;

  useEffect(() => {
    if (!settingId) return;
    let active = true;
    setLoading(true);
    fetchSettings(novelId)
      .then((settings) => {
        if (!active) return;
        const found = settings.find((s) => s.id === settingId);
        if (found) {
          setCategory(found.category);
          setName(found.name);
          setDescription(found.description ?? '');
        } else {
          setError('設定が見つかりませんでした');
        }
      })
      .catch((e) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : '読み込みに失敗しました');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [novelId, settingId]);

  async function handleGenerate() {
    setError(null);
    if (!instruction.trim()) {
      setError('指示を入力してください');
      return;
    }
    try {
      const currentDraft = isEdit
        ? { category, name, description }
        : category || name || description
          ? { category, name, description }
          : undefined;
      const result = await generateDraft(instruction.trim(), currentDraft);
      setCategory(result.category);
      setName(result.name);
      setDescription(result.description);
      // 履歴に保存（重複時は既存を返す）
      await saveInstruction({ entityType: 'setting', instruction: instruction.trim() });
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成に失敗しました');
    }
  }

  async function handleSave() {
    setError(null);
    if (!category.trim() || !name.trim()) {
      setError('カテゴリーと名前は必須です');
      return;
    }
    try {
      const input = {
        category: category.trim(),
        name: name.trim(),
        description: description.trim(),
      };
      if (isEdit && settingId) {
        await updateSetting(settingId, input);
      } else {
        await createSetting(input);
      }
      navigate({ to: '/novels/$novelId', params: { novelId }, search: { tab: 'settings' } });
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました');
    }
  }

  async function handleDeleteInstruction() {
    if (!deleteInstructionId) return;
    await deleteInstruction(deleteInstructionId);
    setDeleteInstructionId(null);
  }

  function applyHistory(text: string) {
    setInstruction(text);
  }

  if (loading) return <Loading message="設定を読み込み中..." />;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() =>
              navigate({ to: '/novels/$novelId', params: { novelId }, search: { tab: 'settings' } })
            }
            className="mb-2 text-sm text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            ← 設定一覧に戻る
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {isEdit ? '設定を編集' : '新規設定'}
          </h1>
        </div>
        <Button onClick={handleSave} isLoading={creating || updating}>
          保存
        </Button>
      </div>

      <Card>
        <CardHeader title="基本情報" />
        <div className="space-y-4">
          <Input
            label="カテゴリー"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="world, magic, geography, culture..."
          />
          <Input label="名前" value={name} onChange={(e) => setName(e.target.value)} />
          <Textarea
            label="説明"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="LLMで作成・編集" />
        <div className="space-y-4">
          <Textarea
            label="指示"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="例: 魔法体系を考えて。代償と制限がある硬い世界観で。"
            rows={3}
          />
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={handleGenerate}
              isLoading={generatingDraft}
              disabled={!instruction.trim()}
              leftIcon={<SparklesIcon />}
            >
              {isEdit || category || name || description ? '微修正' : 'ドラフト生成'}
            </Button>
          </div>

          {instructions.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                履歴から選択
              </h4>
              <ul className="space-y-1.5">
                {instructions.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50"
                  >
                    <button
                      onClick={() => applyHistory(item.instruction)}
                      className="flex-1 text-left text-sm text-slate-700 transition hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-300"
                    >
                      {item.instruction}
                    </button>
                    <button
                      onClick={() => setDeleteInstructionId(item.id)}
                      title="削除"
                      className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200"
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

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-300">
          {error}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteInstructionId}
        onClose={() => setDeleteInstructionId(null)}
        onConfirm={handleDeleteInstruction}
        title="履歴を削除しますか？"
        message="この操作は元に戻せません。"
        confirmLabel="削除"
        isLoading={deletingInstruction}
      />
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
