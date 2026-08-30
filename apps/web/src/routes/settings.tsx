import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Button } from '@/components/Button.js';
import { EmbeddingConfigModal } from '@/components/settings/EmbeddingConfigModal.js';
import { EmbeddingConfigSection } from '@/components/settings/EmbeddingConfigSection.js';
import { LLMConfigModal } from '@/components/settings/LLMConfigModal.js';
import { LLMConfigSection } from '@/components/settings/LLMConfigSection.js';
import { ReindexProgressModal } from '@/components/ReindexProgressModal.js';
import { useEmbeddingConfigs } from '@/hooks/useEmbeddingConfigs.js';
import { useLLMConfigs } from '@/hooks/useLLMConfigs.js';
import { useToast } from '@/hooks/useToast.js';
import { toErrorMessage } from '@/lib/errors.js';
import { streamReindex } from '@/lib/services/vector.js';
import type { EmbeddingConfig, LLMConfig, ReindexProgressEvent } from '@/lib/types.js';

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
});

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

  // モーダル管理
  const [llmModalOpen, setLlmModalOpen] = useState(false);
  const [editingLlmConfig, setEditingLlmConfig] = useState<LLMConfig | null>(null);

  const [embeddingModalOpen, setEmbeddingModalOpen] = useState(false);
  const [editingEmbeddingConfig, setEditingEmbeddingConfig] = useState<EmbeddingConfig | null>(
    null,
  );

  // インデックス再構築モーダルステート
  const [reindexModalOpen, setReindexModalOpen] = useState(false);
  const [reindexProgress, setReindexProgress] = useState<ReindexProgressEvent | null>(null);
  const [reindexRunning, setReindexRunning] = useState(false);
  const [reindexDone, setReindexDone] = useState(false);
  const [reindexError, setReindexError] = useState<string | null>(null);

  function openCreateLlmModal() {
    setEditingLlmConfig(null);
    setLlmModalOpen(true);
  }

  function openEditLlmModal(config: LLMConfig) {
    setEditingLlmConfig(config);
    setLlmModalOpen(true);
  }

  function openCreateEmbeddingModal() {
    setEditingEmbeddingConfig(null);
    setEmbeddingModalOpen(true);
  }

  function openEditEmbeddingModal(config: EmbeddingConfig) {
    setEditingEmbeddingConfig(config);
    setEmbeddingModalOpen(true);
  }

  function handleOpenReindexModal() {
    setReindexProgress(null);
    setReindexDone(false);
    setReindexError(null);
    setReindexModalOpen(true);
  }

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
          onClick={() => setActiveTab('llm')}
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

      {/* LLM タブ */}
      {activeTab === 'llm' && (
        <LLMConfigSection
          configs={llmConfigs}
          loading={llmLoading}
          error={llmError}
          onOpenCreateModal={openCreateLlmModal}
          onOpenEditModal={openEditLlmModal}
          onSetDefault={setDefaultLLM}
          onDelete={deleteLLM}
          onTestConnection={testLLM}
          isSettingDefault={settingDefaultLLM}
          isDeleting={deletingLLM}
        />
      )}

      {/* Embedding タブ */}
      {activeTab === 'embedding' && (
        <EmbeddingConfigSection
          configs={embeddingConfigs}
          loading={embeddingLoading}
          error={embeddingError}
          onOpenCreateModal={openCreateEmbeddingModal}
          onOpenEditModal={openEditEmbeddingModal}
          onSetDefault={setDefaultEmbedding}
          onDelete={deleteEmbedding}
          onOpenReindexModal={handleOpenReindexModal}
          onTestConnection={testEmbedding}
          isSettingDefault={settingDefaultEmbedding}
          isDeleting={deletingEmbedding}
        />
      )}

      {/* LLM モーダル */}
      <LLMConfigModal
        isOpen={llmModalOpen}
        onClose={() => setLlmModalOpen(false)}
        editingConfig={editingLlmConfig}
        configsCount={llmConfigs.length}
        onCreate={createLLM}
        onUpdate={updateLLM}
        onTestConnection={testLLM}
        isSubmitting={creatingLLM || updatingLLM}
      />

      {/* Embedding モーダル */}
      <EmbeddingConfigModal
        isOpen={embeddingModalOpen}
        onClose={() => setEmbeddingModalOpen(false)}
        editingConfig={editingEmbeddingConfig}
        configsCount={embeddingConfigs.length}
        onCreate={createEmbedding}
        onUpdate={updateEmbedding}
        onTestConnection={testEmbedding}
        isSubmitting={creatingEmbedding || updatingEmbedding}
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
