import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Button } from '@/components/Button.js';
import { Card } from '@/components/Card.js';
import { ConfirmDialog } from '@/components/ConfirmDialog.js';

import { Input } from '@/components/Input.js';
import { Loading } from '@/components/Loading.js';
import { Modal } from '@/components/Modal.js';
import { Tag } from '@/components/Tag.js';
import { Textarea } from '@/components/Textarea.js';
import { getProviderBadge } from '@/components/LLMModelSelector.js';
import { useLLMConfigs } from '@/hooks/useLLMConfigs.js';
import { useToast } from '@/hooks/useToast.js';
import { toErrorMessage } from '@/lib/errors.js';
import type {
  CreateLLMConfigInput,
  LLMConfig,
  TestConnectionResult,
  UpdateLLMConfigInput,
} from '@/lib/types.js';

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
});

interface Preset {
  label: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'google' | 'ollama' | 'custom_openai';
  modelId: string;
  baseUrl?: string;
}

const PRESETS: Preset[] = [
  { label: 'GPT-4o', name: 'OpenAI GPT-4o', provider: 'openai', modelId: 'gpt-4o' },
  { label: 'GPT-4o-mini', name: 'OpenAI GPT-4o-mini', provider: 'openai', modelId: 'gpt-4o-mini' },
  {
    label: 'Claude 3.7 Sonnet',
    name: 'Claude 3.7 Sonnet',
    provider: 'anthropic',
    modelId: 'claude-3-7-sonnet-20250219',
  },
  {
    label: 'Claude 3.5 Haiku',
    name: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    modelId: 'claude-3-5-haiku-20241022',
  },
  {
    label: 'Gemini 2.5 Pro',
    name: 'Gemini 2.5 Pro',
    provider: 'google',
    modelId: 'gemini-2.5-pro',
  },
  {
    label: 'Gemini 2.5 Flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    modelId: 'gemini-2.5-flash',
  },
  {
    label: 'Ollama (ローカル)',
    name: 'Ollama ローカル',
    provider: 'ollama',
    modelId: 'llama3.2',
    baseUrl: 'http://localhost:11434/v1',
  },
  {
    label: 'OpenRouter (カスタム)',
    name: 'OpenRouter',
    provider: 'custom_openai',
    modelId: 'deepseek/deepseek-r1',
    baseUrl: 'https://openrouter.ai/api/v1',
  },
];

export function SettingsPage() {
  const {
    configs,
    loading,
    error,
    createConfig,
    updateConfig,
    deleteConfig,
    setDefaultConfig,
    testConnection,
    creating,
    updating,
    deleting,
    settingDefault,
  } = useLLMConfigs();

  const toast = useToast();

  // モーダル管理
  const [modalOpen, setModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<LLMConfig | null>(null);

  // フォームステート
  const [name, setName] = useState('');
  const [provider, setProvider] = useState<
    'openai' | 'anthropic' | 'google' | 'ollama' | 'custom_openai'
  >('openai');
  const [modelId, setModelId] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [description, setDescription] = useState('');

  // 接続テストステート
  const [testingInline, setTestingInline] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  // 削除確認
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function openCreateModal() {
    setEditingConfig(null);
    setName('');
    setProvider('openai');
    setModelId('');
    setBaseUrl('');
    setApiKey('');
    setIsDefault(configs.length === 0);
    setDescription('');
    setTestResult(null);
    setModalOpen(true);
  }

  function openEditModal(config: LLMConfig) {
    setEditingConfig(config);
    setName(config.name);
    setProvider(config.provider);
    setModelId(config.modelId);
    setBaseUrl(config.baseUrl ?? '');
    setApiKey(''); // セキュリティのため既存キーは空で表示
    setIsDefault(config.isDefault);
    setDescription(config.description ?? '');
    setTestResult(null);
    setModalOpen(true);
  }

  function applyPreset(p: Preset) {
    setName(p.name);
    setProvider(p.provider);
    setModelId(p.modelId);
    if (p.baseUrl) setBaseUrl(p.baseUrl);
    else setBaseUrl('');
  }

  async function handleTestInModal() {
    if (!modelId.trim()) {
      toast.error('モデルIDを入力してください');
      return;
    }
    setTestingInline(true);
    setTestResult(null);
    try {
      const res = await testConnection({
        provider,
        modelId: modelId.trim(),
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

  async function handleCardTest(config: LLMConfig) {
    setTestingId(config.id);
    try {
      const res = await testConnection({
        provider: config.provider,
        modelId: config.modelId,
        baseUrl: config.baseUrl,
      });
      if (res.success) {
        toast.success(`「${config.name}」接続成功 (${res.latencyMs}ms)`);
      } else {
        toast.error(`「${config.name}」接続失敗: ${res.error ?? '応答なし'}`);
      }
    } catch (e) {
      toast.error(toErrorMessage(e));
    } finally {
      setTestingId(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('表示名を入力してください');
      return;
    }
    if (!modelId.trim()) {
      toast.error('モデルIDを入力してください');
      return;
    }

    try {
      if (editingConfig) {
        const input: UpdateLLMConfigInput = {
          name: name.trim(),
          provider,
          modelId: modelId.trim(),
          baseUrl: baseUrl.trim() || null,
          isDefault,
          description: description.trim() || null,
        };
        if (apiKey.trim()) {
          input.apiKey = apiKey.trim();
        }
        await updateConfig(editingConfig.id, input);
        toast.success('LLM設定を更新しました');
      } else {
        const input: CreateLLMConfigInput = {
          name: name.trim(),
          provider,
          modelId: modelId.trim(),
          baseUrl: baseUrl.trim() || null,
          apiKey: apiKey.trim() || null,
          isDefault,
          description: description.trim() || null,
        };
        await createConfig(input);
        toast.success('新しいLLMを追加しました');
      }
      setModalOpen(false);
    } catch (err) {
      toast.error(toErrorMessage(err));
    }
  }

  async function handleSetDefault(id: string) {
    try {
      await setDefaultConfig(id);
      toast.success('デフォルトモデルを変更しました');
    } catch (err) {
      toast.error(toErrorMessage(err));
    }
  }

  async function handleDelete() {
    if (!deletingId) return;
    try {
      await deleteConfig(deletingId);
      toast.success('LLM設定を削除しました');
      setDeletingId(null);
    } catch (err) {
      toast.error(toErrorMessage(err));
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">LLM・モデル設定</h1>
          <p className="mt-1 text-sm text-foreground-secondary">
            執筆、チャット、校正等で使用するLLMモデルの追加・切り替えを管理します。
          </p>
        </div>
        <Button onClick={openCreateModal} leftIcon={<span>＋</span>}>
          新しいLLMを追加
        </Button>
      </div>

      {loading && <Loading message="設定を読み込み中..." />}

      {error && (
        <div className="rounded-lg border border-danger-border bg-danger-subtle p-4 text-sm text-danger-subtle-fg">
          {error}
        </div>
      )}

      {!loading && !error && configs.length === 0 && (
        <Card>
          <div className="py-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-subtle text-2xl">
              🤖
            </div>
            <h3 className="text-lg font-medium text-foreground">登録済みモデルがありません</h3>
            <p className="mt-1 text-sm text-muted">
              現在はサーバーの環境変数（.env）に設定されたモデルが使用されています。
              <br />
              画面上からClaudeやOpenAI、Gemini、Ollamaなどを追加して切り替えられます。
            </p>
            <div className="mt-6">
              <Button onClick={openCreateModal} leftIcon={<span>＋</span>}>
                最初のモデルを追加する
              </Button>
            </div>
          </div>
        </Card>
      )}

      {!loading && !error && configs.length > 0 && (
        <div className="grid gap-4">
          {configs.map((cfg) => {
            const badge = getProviderBadge(cfg.provider);
            const isRowTesting = testingId === cfg.id;

            return (
              <Card key={cfg.id} className="transition hover:border-border-hover">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-semibold text-foreground truncate">
                        {cfg.name}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.bg}`}
                      >
                        {badge.icon} {badge.label}
                      </span>
                      {cfg.isDefault && <Tag>★ デフォルト</Tag>}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground-secondary">
                      <div>
                        <span className="text-muted">Model ID:</span>{' '}
                        <code className="rounded bg-surface-raised px-1.5 py-0.5 font-mono text-foreground">
                          {cfg.modelId}
                        </code>
                      </div>
                      {cfg.baseUrl && (
                        <div>
                          <span className="text-muted">Base URL:</span>{' '}
                          <span className="truncate max-w-xs font-mono">{cfg.baseUrl}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-muted">API Key:</span>{' '}
                        <span>
                          {cfg.hasApiKey
                            ? (cfg.apiKeyMasked ?? '登録済み')
                            : '環境変数をフォールバック利用'}
                        </span>
                      </div>
                    </div>

                    {cfg.description && (
                      <p className="text-xs text-muted mt-1">{cfg.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleCardTest(cfg)}
                      isLoading={isRowTesting}
                    >
                      接続テスト
                    </Button>

                    {!cfg.isDefault && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleSetDefault(cfg.id)}
                        isLoading={settingDefault}
                      >
                        デフォルトに設定
                      </Button>
                    )}

                    <Button variant="secondary" size="sm" onClick={() => openEditModal(cfg)}>
                      編集
                    </Button>

                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setDeletingId(cfg.id)}
                      disabled={deleting}
                    >
                      削除
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* 追加・編集モーダル */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingConfig ? 'LLM設定の編集' : '新しいLLMを追加'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {!editingConfig && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground-secondary">
                プリセットから素早く入力
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
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
            placeholder="例: Claude 3.7 Sonnet (執筆用)"
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
              onChange={(e) => setProvider(e.target.value as CreateLLMConfigInput['provider'])}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary"
            >
              <option value="openai">OpenAI (GPT-4o, o3-miniなど)</option>
              <option value="anthropic">Anthropic (Claude 3.7 Sonnet, Claude 3.5 Haikuなど)</option>
              <option value="google">Google (Gemini 2.5 Pro, Flashなど)</option>
              <option value="ollama">Ollama (ローカル/Cloud LLM)</option>
              <option value="custom_openai">
                OpenAI互換 (OpenRouter, Groq, LM Studio, vLLM等)
              </option>
            </select>
          </div>

          <Input
            label="モデル識別子 (Model ID)"
            placeholder="例: claude-3-7-sonnet-20250219, gpt-4o, gemini-2.5-flash"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            required
          />

          <div>
            <Input
              label="Base URL (任意)"
              placeholder="例: http://localhost:11434/v1 (Ollama) または https://openrouter.ai/api/v1"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              OllamaやローカルLLM、OpenRouterを利用する場合にエンドポイントURLを指定します。
            </p>
          </div>

          <div>
            <Input
              label="API キー (任意)"
              type="password"
              placeholder={
                editingConfig
                  ? editingConfig.hasApiKey
                    ? '登録済みキーを維持 (変更する場合のみ入力)'
                    : '未設定 (環境変数を使用)'
                  : '未入力の場合はサーバー環境変数を使用'
              }
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              空欄のままにすると、サーバー側の環境変数（.env）に設定されたAPIキーが使用されます。
            </p>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              id="isDefaultCheck"
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <label htmlFor="isDefaultCheck" className="text-sm text-foreground select-none">
              デフォルトモデルに設定する
            </label>
          </div>

          <Textarea
            label="備考・説明 (任意)"
            placeholder="このモデルの用途や特徴をメモできます"
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
            <Button
              type="button"
              variant="secondary"
              onClick={handleTestInModal}
              isLoading={testingInline}
            >
              接続テスト
            </Button>

            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
                キャンセル
              </Button>
              <Button type="submit" isLoading={creating || updating}>
                {editingConfig ? '保存する' : '追加する'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* 削除確認ダイアログ */}
      <ConfirmDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="LLM設定の削除"
        message="このLLM設定を削除しますか？削除された設定は元に戻せません。"
        confirmLabel="削除する"
        cancelLabel="キャンセル"
        isLoading={deleting}
      />
    </div>
  );
}
