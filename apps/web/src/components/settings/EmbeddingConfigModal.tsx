import { useEffect, useState } from 'react';
import { Button } from '@/components/Button.js';
import { Input } from '@/components/Input.js';
import { Modal } from '@/components/Modal.js';
import { Textarea } from '@/components/Textarea.js';
import { useToast } from '@/hooks/useToast.js';
import { toErrorMessage } from '@/lib/errors.js';
import type {
  CreateEmbeddingConfigInput,
  EmbeddingConfig,
  TestEmbeddingConnectionInput,
  TestConnectionResult,
  UpdateEmbeddingConfigInput,
} from '@/lib/types.js';
import { EMBEDDING_PRESETS, type EmbeddingPreset } from './presets.js';

interface EmbeddingConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingConfig: EmbeddingConfig | null;
  configsCount: number;
  onCreate: (input: CreateEmbeddingConfigInput) => Promise<EmbeddingConfig>;
  onUpdate: (id: string, input: UpdateEmbeddingConfigInput) => Promise<EmbeddingConfig>;
  onTestConnection: (input: TestEmbeddingConnectionInput) => Promise<TestConnectionResult>;
  isSubmitting: boolean;
}

export function EmbeddingConfigModal({
  isOpen,
  onClose,
  editingConfig,
  configsCount,
  onCreate,
  onUpdate,
  onTestConnection,
  isSubmitting,
}: EmbeddingConfigModalProps) {
  const toast = useToast();

  const [name, setName] = useState('');
  const [provider, setProvider] = useState<
    'openai' | 'anthropic' | 'google' | 'ollama' | 'custom_openai'
  >('openai');
  const [modelId, setModelId] = useState('text-embedding-3-small');
  const [dimensions, setDimensions] = useState(1536);
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [description, setDescription] = useState('');

  const [testingInline, setTestingInline] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (editingConfig) {
      setName(editingConfig.name);
      setProvider(editingConfig.provider);
      setModelId(editingConfig.modelId);
      setDimensions(editingConfig.dimensions);
      setBaseUrl(editingConfig.baseUrl ?? '');
      setApiKey('');
      setIsDefault(editingConfig.isDefault);
      setDescription(editingConfig.description ?? '');
    } else {
      setName('');
      setProvider('openai');
      setModelId('text-embedding-3-small');
      setDimensions(1536);
      setBaseUrl('');
      setApiKey('');
      setIsDefault(configsCount === 0);
      setDescription('');
    }
    setTestResult(null);
  }, [isOpen, editingConfig, configsCount]);

  function applyPreset(p: EmbeddingPreset) {
    setName(p.name);
    setProvider(p.provider);
    setModelId(p.modelId);
    setDimensions(p.dimensions);
    setBaseUrl(p.baseUrl ?? '');
  }

  async function handleTest() {
    if (!modelId.trim()) {
      toast.error('モデルIDを入力してください');
      return;
    }
    setTestingInline(true);
    setTestResult(null);
    try {
      const res = await onTestConnection({
        provider,
        modelId: modelId.trim(),
        dimensions,
        baseUrl: baseUrl.trim() || undefined,
        apiKey: apiKey.trim() || undefined,
      });
      setTestResult(res);
      if (res.success) {
        toast.success(`接続成功 (${res.latencyMs}ms)`);
      } else {
        toast.error(`接続失敗: ${res.error ?? '応答なし'}`);
      }
    } catch (e) {
      toast.error(toErrorMessage(e));
    } finally {
      setTestingInline(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error('表示名を入力してください');
    if (!modelId.trim()) return toast.error('モデルIDを入力してください');

    try {
      if (editingConfig) {
        const input: UpdateEmbeddingConfigInput = {
          name: name.trim(),
          provider,
          modelId: modelId.trim(),
          dimensions,
          baseUrl: baseUrl.trim() || null,
          isDefault,
          description: description.trim() || null,
        };
        if (apiKey.trim()) input.apiKey = apiKey.trim();
        await onUpdate(editingConfig.id, input);
        toast.success('埋め込み設定を更新しました');
      } else {
        const input: CreateEmbeddingConfigInput = {
          name: name.trim(),
          provider,
          modelId: modelId.trim(),
          dimensions,
          baseUrl: baseUrl.trim() || null,
          apiKey: apiKey.trim() || null,
          isDefault,
          description: description.trim() || null,
        };
        await onCreate(input);
        toast.success('新しい埋め込みモデルを追加しました');
      }
      onClose();
    } catch (err) {
      toast.error(toErrorMessage(err));
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingConfig ? '埋め込み設定の編集' : '新しい埋め込みモデルを追加'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {!editingConfig && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground-secondary">
              プリセットから素早く入力
            </label>
            <div className="flex flex-wrap gap-1.5">
              {EMBEDDING_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="rounded-md border border-border bg-surface-raised px-2 py-1 text-xs text-foreground transition hover:border-primary hover:text-primary"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <Input
          label="表示名"
          placeholder="例: OpenAI text-embedding-3-small (1536d)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground-secondary">
            プロバイダ種別
          </label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as CreateEmbeddingConfigInput['provider'])}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary"
          >
            <option value="openai">OpenAI (text-embedding-3-small/large)</option>
            <option value="google">Google (gemini-embedding-001)</option>
            <option value="ollama">Ollama (nomic-embed-text, bge-m3等)</option>
            <option value="custom_openai">OpenAI互換 エンドポイント</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="モデル識別子 (Model ID)"
            placeholder="例: text-embedding-3-small"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            required
          />
          <Input
            label="ベクトル次元数"
            type="number"
            value={dimensions}
            onChange={(e) => setDimensions(parseInt(e.target.value, 10) || 1536)}
            required
          />
        </div>

        <Input
          label="Base URL (任意)"
          placeholder="例: http://localhost:11434/v1 (Ollama)"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
        />

        <Input
          label="API キー (任意)"
          type="password"
          placeholder={
            editingConfig
              ? editingConfig.hasApiKey
                ? '登録済みキーを維持'
                : '未設定 (環境変数を使用)'
              : '未入力の場合はサーバー環境変数を使用'
          }
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />

        <div className="flex items-center gap-2 pt-1">
          <input
            id="isEmbeddingDefaultCheck"
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
          />
          <label htmlFor="isEmbeddingDefaultCheck" className="text-sm text-foreground select-none">
            デフォルト埋め込みモデルに設定する
          </label>
        </div>

        <Textarea
          label="備考・説明 (任意)"
          placeholder="このモデルの用途や次元数などのメモ"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />

        {testResult && (
          <div
            className={`rounded-lg border p-3 text-xs ${
              testResult.success
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'
            }`}
          >
            <div className="font-semibold">
              {testResult.success ? '✓ 接続成功' : '✗ 接続失敗'} ({testResult.latencyMs}ms)
            </div>
            <div className="mt-1 break-all">{testResult.message}</div>
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-border">
          <Button type="button" variant="secondary" onClick={handleTest} isLoading={testingInline}>
            接続テスト
          </Button>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              キャンセル
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {editingConfig ? '保存する' : '追加する'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
