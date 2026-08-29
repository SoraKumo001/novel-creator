import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Button } from '@/components/Button.js';
import { Card } from '@/components/Card.js';
import { ConfirmDialog } from '@/components/ConfirmDialog.js';
import { Input } from '@/components/Input.js';
import { Loading } from '@/components/Loading.js';
import { Modal } from '@/components/Modal.js';
import { ReindexProgressModal } from '@/components/ReindexProgressModal.js';
import { Tag } from '@/components/Tag.js';
import { Textarea } from '@/components/Textarea.js';
import { getProviderBadge } from '@/components/LLMModelSelector.js';
import { useEmbeddingConfigs } from '@/hooks/useEmbeddingConfigs.js';
import { useLLMConfigs } from '@/hooks/useLLMConfigs.js';
import { useToast } from '@/hooks/useToast.js';
import { toErrorMessage } from '@/lib/errors.js';
import { streamReindex } from '@/lib/services/vector.js';
import type {
  CreateEmbeddingConfigInput,
  CreateLLMConfigInput,
  EmbeddingConfig,
  LLMConfig,
  ReindexProgressEvent,
  TestConnectionResult,
  UpdateEmbeddingConfigInput,
  UpdateLLMConfigInput,
} from '@/lib/types.js';

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
});

interface LLMPreset {
  label: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'google' | 'ollama' | 'custom_openai';
  modelId: string;
  baseUrl?: string;
}

const LLM_PRESETS: LLMPreset[] = [
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

interface EmbeddingPreset {
  label: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'google' | 'ollama' | 'custom_openai';
  modelId: string;
  dimensions: number;
  baseUrl?: string;
}

const EMBEDDING_PRESETS: EmbeddingPreset[] = [
  {
    label: 'OpenAI 3-Small (1536次元)',
    name: 'OpenAI text-embedding-3-small',
    provider: 'openai',
    modelId: 'text-embedding-3-small',
    dimensions: 1536,
  },
  {
    label: 'OpenAI 3-Large (3072次元)',
    name: 'OpenAI text-embedding-3-large',
    provider: 'openai',
    modelId: 'text-embedding-3-large',
    dimensions: 3072,
  },
  {
    label: 'Google Gemini (768次元)',
    name: 'Google gemini-embedding-001 (768d)',
    provider: 'google',
    modelId: 'gemini-embedding-001',
    dimensions: 768,
  },
  {
    label: 'Google Gemini (1536次元)',
    name: 'Google gemini-embedding-001 (1536d)',
    provider: 'google',
    modelId: 'gemini-embedding-001',
    dimensions: 1536,
  },
  {
    label: 'Ollama nomic-embed-text (768次元)',
    name: 'Ollama nomic-embed-text',
    provider: 'ollama',
    modelId: 'nomic-embed-text',
    dimensions: 768,
    baseUrl: 'http://localhost:11434/v1',
  },
  {
    label: 'Ollama bge-m3 (1024次元)',
    name: 'Ollama bge-m3',
    provider: 'ollama',
    modelId: 'bge-m3',
    dimensions: 1024,
    baseUrl: 'http://localhost:11434/v1',
  },
];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'llm' | 'embedding'>('llm');

  // LLM Configs フック
  const {
    configs: llmConfigs,
    loading: llmLoading,
    error: llmError,
    createConfig: createLLM,
    updateConfig: updateLLM,
    deleteConfig: deleteLLM,
    setDefaultConfig: setDefaultLLM,
    testConnection: testLLM,
    creating: creatingLLM,
    updating: updatingLLM,
    deleting: deletingLLM,
    settingDefault: settingDefaultLLM,
  } = useLLMConfigs();

  // Embedding Configs フック
  const {
    configs: embeddingConfigs,
    defaultConfig: defaultEmbeddingConfig,
    loading: embeddingLoading,
    error: embeddingError,
    createConfig: createEmbedding,
    updateConfig: updateEmbedding,
    deleteConfig: deleteEmbedding,
    setDefaultConfig: setDefaultEmbedding,
    testConnection: testEmbedding,
    creating: creatingEmbedding,
    updating: updatingEmbedding,
    deleting: deletingEmbedding,
    settingDefault: settingDefaultEmbedding,
  } = useEmbeddingConfigs();

  const toast = useToast();

  // LLM モーダル管理
  const [llmModalOpen, setLlmModalOpen] = useState(false);
  const [editingLlmConfig, setEditingLlmConfig] = useState<LLMConfig | null>(null);

  // Embedding モーダル管理
  const [embeddingModalOpen, setEmbeddingModalOpen] = useState(false);
  const [editingEmbeddingConfig, setEditingEmbeddingConfig] = useState<EmbeddingConfig | null>(
    null,
  );

  // 共通/個別フォームステート
  const [name, setName] = useState('');
  const [provider, setProvider] = useState<
    'openai' | 'anthropic' | 'google' | 'ollama' | 'custom_openai'
  >('openai');
  const [modelId, setModelId] = useState('');
  const [dimensions, setDimensions] = useState(1536);
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [description, setDescription] = useState('');

  // 接続テストステート
  const [testingInline, setTestingInline] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  // 削除確認
  const [deletingLlmId, setDeletingLlmId] = useState<string | null>(null);
  const [deletingEmbeddingId, setDeletingEmbeddingId] = useState<string | null>(null);

  // インデックス再構築モーダルステート
  const [reindexModalOpen, setReindexModalOpen] = useState(false);
  const [reindexProgress, setReindexProgress] = useState<ReindexProgressEvent | null>(null);
  const [reindexRunning, setReindexRunning] = useState(false);
  const [reindexDone, setReindexDone] = useState(false);
  const [reindexError, setReindexError] = useState<string | null>(null);

  // LLM モーダル開閉
  function openCreateLlmModal() {
    setEditingLlmConfig(null);
    setName('');
    setProvider('openai');
    setModelId('');
    setBaseUrl('');
    setApiKey('');
    setIsDefault(llmConfigs.length === 0);
    setDescription('');
    setTestResult(null);
    setLlmModalOpen(true);
  }

  function openEditLlmModal(config: LLMConfig) {
    setEditingLlmConfig(config);
    setName(config.name);
    setProvider(config.provider);
    setModelId(config.modelId);
    setBaseUrl(config.baseUrl ?? '');
    setApiKey('');
    setIsDefault(config.isDefault);
    setDescription(config.description ?? '');
    setTestResult(null);
    setLlmModalOpen(true);
  }

  // Embedding モーダル開閉
  function openCreateEmbeddingModal() {
    setEditingEmbeddingConfig(null);
    setName('');
    setProvider('openai');
    setModelId('text-embedding-3-small');
    setDimensions(1536);
    setBaseUrl('');
    setApiKey('');
    setIsDefault(embeddingConfigs.length === 0);
    setDescription('');
    setTestResult(null);
    setEmbeddingModalOpen(true);
  }

  function openEditEmbeddingModal(config: EmbeddingConfig) {
    setEditingEmbeddingConfig(config);
    setName(config.name);
    setProvider(config.provider);
    setModelId(config.modelId);
    setDimensions(config.dimensions);
    setBaseUrl(config.baseUrl ?? '');
    setApiKey('');
    setIsDefault(config.isDefault);
    setDescription(config.description ?? '');
    setTestResult(null);
    setEmbeddingModalOpen(true);
  }

  function applyLlmPreset(p: LLMPreset) {
    setName(p.name);
    setProvider(p.provider);
    setModelId(p.modelId);
    setBaseUrl(p.baseUrl ?? '');
  }

  function applyEmbeddingPreset(p: EmbeddingPreset) {
    setName(p.name);
    setProvider(p.provider);
    setModelId(p.modelId);
    setDimensions(p.dimensions);
    setBaseUrl(p.baseUrl ?? '');
  }

  // LLM 接続テスト
  async function handleTestLlmInModal() {
    if (!modelId.trim()) {
      toast.error('モデルIDを入力してください');
      return;
    }
    setTestingInline(true);
    setTestResult(null);
    try {
      const res = await testLLM({
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

  // Embedding 接続テスト
  async function handleTestEmbeddingInModal() {
    if (!modelId.trim()) {
      toast.error('モデルIDを入力してください');
      return;
    }
    setTestingInline(true);
    setTestResult(null);
    try {
      const res = await testEmbedding({
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

  // LLM 保存
  async function handleLlmSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error('表示名を入力してください');
    if (!modelId.trim()) return toast.error('モデルIDを入力してください');

    try {
      if (editingLlmConfig) {
        const input: UpdateLLMConfigInput = {
          name: name.trim(),
          provider,
          modelId: modelId.trim(),
          baseUrl: baseUrl.trim() || null,
          isDefault,
          description: description.trim() || null,
        };
        if (apiKey.trim()) input.apiKey = apiKey.trim();
        await updateLLM(editingLlmConfig.id, input);
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
        await createLLM(input);
        toast.success('新しいLLMを追加しました');
      }
      setLlmModalOpen(false);
    } catch (err) {
      toast.error(toErrorMessage(err));
    }
  }

  // Embedding 保存
  async function handleEmbeddingSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error('表示名を入力してください');
    if (!modelId.trim()) return toast.error('モデルIDを入力してください');

    try {
      if (editingEmbeddingConfig) {
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
        await updateEmbedding(editingEmbeddingConfig.id, input);
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
        await createEmbedding(input);
        toast.success('新しい埋め込みモデルを追加しました');
      }
      setEmbeddingModalOpen(false);
    } catch (err) {
      toast.error(toErrorMessage(err));
    }
  }

  // インデックス再構築の実行
  async function handleStartReindex() {
    setReindexRunning(true);
    setReindexDone(false);
    setReindexError(null);
    setReindexProgress({
      current: 0,
      total: 0,
      percent: 0,
      stage: '再構築を開始しています...',
    });

    try {
      await streamReindex({
        embeddingConfigId: defaultEmbeddingConfig?.id,
        onProgress: (p) => setReindexProgress(p),
        onDone: () => {
          setReindexRunning(false);
          setReindexDone(true);
          toast.success('インデックス再構築が完了しました');
        },
        onError: (err) => {
          setReindexRunning(false);
          setReindexError(err);
          toast.error(`再構築エラー: ${err}`);
        },
      });
    } catch (e) {
      setReindexRunning(false);
      setReindexError(toErrorMessage(e));
      toast.error(toErrorMessage(e));
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">AI・モデル設定</h1>
          <p className="mt-1 text-sm text-foreground-secondary">
            執筆やチャットで使う生成LLMと、RAG検索で使う埋め込み（Embedding）モデルを管理します。
          </p>
        </div>
        <div>
          <Button
            onClick={activeTab === 'llm' ? openCreateLlmModal : openCreateEmbeddingModal}
            leftIcon={<span>＋</span>}
          >
            {activeTab === 'llm' ? '新しいLLMを追加' : '新しい埋め込みモデルを追加'}
          </Button>
        </div>
      </div>

      {/* タブ切り替え */}
      <div className="border-b border-border flex gap-2">
        <button
          type="button"
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition cursor-pointer ${
            activeTab === 'llm'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <span>🤖</span>
          <span>テキスト生成 LLM ({llmConfigs.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('embedding')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition cursor-pointer ${
            activeTab === 'embedding'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <span>🧬</span>
          <span>埋め込み (Embedding) モデル ({embeddingConfigs.length})</span>
        </button>
      </div>

      {/* ===== LLM タブ ===== */}
      {activeTab === 'llm' && (
        <div className="space-y-4">
          {llmLoading && <Loading message="LLM設定を読み込み中..." />}
          {!llmLoading && llmError && (
            <div className="rounded-lg border border-danger-border bg-danger-subtle p-4 text-sm text-danger-subtle-fg">
              {llmError}
            </div>
          )}

          {!llmLoading && !llmError && llmConfigs.length === 0 && (
            <Card>
              <div className="py-12 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-subtle text-2xl">
                  🤖
                </div>
                <h3 className="text-lg font-medium text-foreground">登録済みモデルがありません</h3>
                <p className="mt-1 text-sm text-muted">
                  現在はサーバーの環境変数（.env）に設定されたモデルが使用されています。
                  <br />
                  ClaudeやOpenAI、Gemini、Ollamaなどを追加して切り替えられます。
                </p>
                <div className="mt-6">
                  <Button onClick={openCreateLlmModal} leftIcon={<span>＋</span>}>
                    最初のLLMを追加する
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {!llmLoading && !llmError && llmConfigs.length > 0 && (
            <div className="grid gap-4">
              {llmConfigs.map((cfg) => {
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
                          onClick={async () => {
                            setTestingId(cfg.id);
                            try {
                              const res = await testLLM({
                                provider: cfg.provider,
                                modelId: cfg.modelId,
                                baseUrl: cfg.baseUrl,
                              });
                              if (res.success) toast.success(`接続成功 (${res.latencyMs}ms)`);
                              else toast.error(`接続失敗: ${res.error ?? '応答なし'}`);
                            } finally {
                              setTestingId(null);
                            }
                          }}
                          isLoading={isRowTesting}
                        >
                          接続テスト
                        </Button>

                        {!cfg.isDefault && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setDefaultLLM(cfg.id)}
                            isLoading={settingDefaultLLM}
                          >
                            デフォルトに設定
                          </Button>
                        )}

                        <Button variant="secondary" size="sm" onClick={() => openEditLlmModal(cfg)}>
                          編集
                        </Button>

                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setDeletingLlmId(cfg.id)}
                          disabled={deletingLLM}
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
        </div>
      )}

      {/* ===== Embedding タブ ===== */}
      {activeTab === 'embedding' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface-raised p-4 text-xs text-muted-foreground flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <strong className="text-foreground font-semibold">
                🧬 埋め込みモデル（Embedding）とベクトルインデックス
              </strong>
              <p className="mt-0.5">
                小説の登場人物や設定、本文をベクトル化してセマンティック検索（RAG）を行います。モデルを変更した場合は「インデックス全再構築」を行ってください。
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setReindexProgress(null);
                setReindexDone(false);
                setReindexError(null);
                setReindexModalOpen(true);
              }}
            >
              ⚡ インデックス全再構築
            </Button>
          </div>

          {embeddingLoading && <Loading message="埋め込み設定を読み込み中..." />}
          {!embeddingLoading && embeddingError && (
            <div className="rounded-lg border border-danger-border bg-danger-subtle p-4 text-sm text-danger-subtle-fg">
              {embeddingError}
            </div>
          )}

          {!embeddingLoading && !embeddingError && embeddingConfigs.length === 0 && (
            <Card>
              <div className="py-12 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-subtle text-2xl">
                  🧬
                </div>
                <h3 className="text-lg font-medium text-foreground">
                  登録済み埋め込みモデルがありません
                </h3>
                <p className="mt-1 text-sm text-muted">
                  現在はサーバー環境変数（.env）に設定された埋め込みモデルが使用されています。
                  <br />
                  OpenAI、Google Gemini、Ollama などを登録して切り替えられます。
                </p>
                <div className="mt-6">
                  <Button onClick={openCreateEmbeddingModal} leftIcon={<span>＋</span>}>
                    最初の埋め込みモデルを追加する
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {!embeddingLoading && !embeddingError && embeddingConfigs.length > 0 && (
            <div className="grid gap-4">
              {embeddingConfigs.map((cfg) => {
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
                          <span className="rounded-full bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 text-xs font-semibold">
                            {cfg.dimensions} 次元
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
                          onClick={async () => {
                            setTestingId(cfg.id);
                            try {
                              const res = await testEmbedding({
                                provider: cfg.provider,
                                modelId: cfg.modelId,
                                dimensions: cfg.dimensions,
                                baseUrl: cfg.baseUrl,
                              });
                              if (res.success) toast.success(`接続成功 (${res.latencyMs}ms)`);
                              else toast.error(`接続失敗: ${res.error ?? '応答なし'}`);
                            } finally {
                              setTestingId(null);
                            }
                          }}
                          isLoading={isRowTesting}
                        >
                          接続テスト
                        </Button>

                        {!cfg.isDefault && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={async () => {
                              await setDefaultEmbedding(cfg.id);
                              toast.success('デフォルト埋め込みモデルを変更しました');
                              // 再構築を促すモーダルを開く
                              setReindexProgress(null);
                              setReindexDone(false);
                              setReindexError(null);
                              setReindexModalOpen(true);
                            }}
                            isLoading={settingDefaultEmbedding}
                          >
                            デフォルトに設定
                          </Button>
                        )}

                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openEditEmbeddingModal(cfg)}
                        >
                          編集
                        </Button>

                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setDeletingEmbeddingId(cfg.id)}
                          disabled={deletingEmbedding}
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
        </div>
      )}

      {/* LLM 追加・編集モーダル */}
      <Modal
        isOpen={llmModalOpen}
        onClose={() => setLlmModalOpen(false)}
        title={editingLlmConfig ? 'LLM設定の編集' : '新しいLLMを追加'}
      >
        <form onSubmit={handleLlmSubmit} className="space-y-4">
          {!editingLlmConfig && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground-secondary">
                プリセットから素早く入力
              </label>
              <div className="flex flex-wrap gap-1.5">
                {LLM_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => applyLlmPreset(p)}
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
              <option value="custom_openai">OpenAI互換 (OpenRouter, Groq, vLLM等)</option>
            </select>
          </div>

          <Input
            label="モデル識別子 (Model ID)"
            placeholder="例: claude-3-7-sonnet-20250219, gpt-4o, gemini-2.5-flash"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            required
          />

          <Input
            label="Base URL (任意)"
            placeholder="例: http://localhost:11434/v1 (Ollama) または https://openrouter.ai/api/v1"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
          />

          <Input
            label="API キー (任意)"
            type="password"
            placeholder={
              editingLlmConfig
                ? editingLlmConfig.hasApiKey
                  ? '登録済みキーを維持'
                  : '未設定 (環境変数を使用)'
                : '未入力の場合はサーバー環境変数を使用'
            }
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />

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
              onClick={handleTestLlmInModal}
              isLoading={testingInline}
            >
              接続テスト
            </Button>
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" onClick={() => setLlmModalOpen(false)}>
                キャンセル
              </Button>
              <Button type="submit" isLoading={creatingLLM || updatingLLM}>
                {editingLlmConfig ? '保存する' : '追加する'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Embedding 追加・編集モーダル */}
      <Modal
        isOpen={embeddingModalOpen}
        onClose={() => setEmbeddingModalOpen(false)}
        title={editingEmbeddingConfig ? '埋め込み設定の編集' : '新しい埋め込みモデルを追加'}
      >
        <form onSubmit={handleEmbeddingSubmit} className="space-y-4">
          {!editingEmbeddingConfig && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground-secondary">
                プリセットから素早く入力
              </label>
              <div className="flex flex-wrap gap-1.5">
                {EMBEDDING_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => applyEmbeddingPreset(p)}
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
              onChange={(e) =>
                setProvider(e.target.value as CreateEmbeddingConfigInput['provider'])
              }
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
              editingEmbeddingConfig
                ? editingEmbeddingConfig.hasApiKey
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
            <label
              htmlFor="isEmbeddingDefaultCheck"
              className="text-sm text-foreground select-none"
            >
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
            <Button
              type="button"
              variant="secondary"
              onClick={handleTestEmbeddingInModal}
              isLoading={testingInline}
            >
              接続テスト
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEmbeddingModalOpen(false)}
              >
                キャンセル
              </Button>
              <Button type="submit" isLoading={creatingEmbedding || updatingEmbedding}>
                {editingEmbeddingConfig ? '保存する' : '追加する'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* 削除確認ダイアログ */}
      <ConfirmDialog
        isOpen={!!deletingLlmId}
        onClose={() => setDeletingLlmId(null)}
        onConfirm={async () => {
          if (!deletingLlmId) return;
          try {
            await deleteLLM(deletingLlmId);
            toast.success('LLM設定を削除しました');
            setDeletingLlmId(null);
          } catch (err) {
            toast.error(toErrorMessage(err));
          }
        }}
        title="LLM設定の削除"
        message="このLLM設定を削除しますか？削除された設定は元に戻せません。"
        confirmLabel="削除する"
        isLoading={deletingLLM}
      />

      <ConfirmDialog
        isOpen={!!deletingEmbeddingId}
        onClose={() => setDeletingEmbeddingId(null)}
        onConfirm={async () => {
          if (!deletingEmbeddingId) return;
          try {
            await deleteEmbedding(deletingEmbeddingId);
            toast.success('埋め込み設定を削除しました');
            setDeletingEmbeddingId(null);
          } catch (err) {
            toast.error(toErrorMessage(err));
          }
        }}
        title="埋め込み設定の削除"
        message="この埋め込みモデル設定を削除しますか？削除された設定は元に戻せません。"
        confirmLabel="削除する"
        isLoading={deletingEmbedding}
      />

      {/* インデックス再構築モーダル */}
      <ReindexProgressModal
        isOpen={reindexModalOpen}
        onClose={() => setReindexModalOpen(false)}
        progress={reindexProgress}
        isRunning={reindexRunning}
        isDone={reindexDone}
        error={reindexError}
        onStart={handleStartReindex}
        targetModelName={defaultEmbeddingConfig?.name ?? 'デフォルト埋め込みモデル'}
        dimensions={defaultEmbeddingConfig?.dimensions}
      />
    </div>
  );
}
