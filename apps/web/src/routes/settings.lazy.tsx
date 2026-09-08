import { createLazyFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { EmbeddingConfigSection } from "@/components/settings/EmbeddingConfigSection.js";
import { LLMConfigSection } from "@/components/settings/LLMConfigSection.js";
import { McpKeySection } from "@/components/settings/McpKeySection.js";
import { useCustomPrompts } from "@/hooks/useCustomPrompts.js";
import { useEmbeddingConfigs } from "@/hooks/useEmbeddingConfigs.js";
import { useLLMConfigs } from "@/hooks/useLLMConfigs.js";
import { useMcpKeys } from "@/hooks/useMcpKeys.js";
import { useToast } from "@/hooks/useToast.js";
import { toErrorMessage } from "@/lib/errors.js";
import { streamReindex } from "@/lib/services/vector.js";
import type {
  CreateCustomPromptInput,
  CustomPrompt,
  EmbeddingConfig,
  LLMConfig,
  ReindexProgressEvent,
  UpdateCustomPromptInput,
} from "@/lib/types.js";
import { SettingsHeader } from "@/routes/-settingsHeader.js";
import { SettingsModals } from "@/routes/-settingsModals.js";
import { CustomPromptList } from "@/routes/-settingsPromptList.js";
import { type SettingsTab, SettingsTabs } from "@/routes/-settingsTabs.js";

export const Route = createLazyFileRoute("/settings")({
  component: SettingsPage,
});

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("llm");

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

  // カスタムプロンプト フック
  const {
    prompts: customPrompts,
    loading: promptsLoading,
    error: promptsError,
    createPrompt,
    updatePrompt,
    deletePrompt,
    seedPresets,
  } = useCustomPrompts({ autoFetch: true });

  // MCP APIキー（件数はタブ表示用。Section本体は自己完結で同クエリを共有する）
  const { keys: mcpKeys } = useMcpKeys();

  const toast = useToast();

  // モーダル管理
  const [llmModalOpen, setLlmModalOpen] = useState(false);
  const [editingLlmConfig, setEditingLlmConfig] = useState<LLMConfig | null>(
    null
  );

  const [embeddingModalOpen, setEmbeddingModalOpen] = useState(false);
  const [editingEmbeddingConfig, setEditingEmbeddingConfig] =
    useState<EmbeddingConfig | null>(null);

  const [promptModalOpen, setPromptModalOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<CustomPrompt | null>(null);
  const [deleteTargetPrompt, setDeleteTargetPrompt] =
    useState<CustomPrompt | null>(null);
  const [deletingPrompt, setDeletingPrompt] = useState(false);

  // インデックス再構築モーダルステート
  const [reindexModalOpen, setReindexModalOpen] = useState(false);
  const [reindexProgress, setReindexProgress] =
    useState<ReindexProgressEvent | null>(null);
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

  function openCreatePromptModal() {
    setEditingPrompt(null);
    setPromptModalOpen(true);
  }

  function openEditPromptModal(p: CustomPrompt) {
    setEditingPrompt(p);
    setPromptModalOpen(true);
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
      stage: "再構築を開始しています...",
    });

    try {
      await streamReindex({
        embeddingConfigId: defaultEmbeddingConfig?.id,
        onProgress: (p) => setReindexProgress(p),
        onDone: () => {
          setReindexRunning(false);
          setReindexDone(true);
          toast.success("インデックス再構築が完了しました");
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

  async function handlePromptModalSubmit(
    data: CreateCustomPromptInput | UpdateCustomPromptInput
  ) {
    if (editingPrompt) {
      await updatePrompt(editingPrompt.id, data as UpdateCustomPromptInput);
      toast.success("プロンプトを更新しました");
    } else {
      await createPrompt(data as CreateCustomPromptInput);
      toast.success("新しいプロンプトを登録しました");
    }
  }

  async function handleConfirmDeletePrompt(): Promise<void> {
    if (!deleteTargetPrompt) {
      return;
    }
    setDeletingPrompt(true);
    try {
      await deletePrompt(deleteTargetPrompt.id);
      setDeleteTargetPrompt(null);
      toast.success("プロンプトを削除しました");
    } catch {
      toast.error("削除に失敗しました");
    } finally {
      setDeletingPrompt(false);
    }
  }

  function handleCloseDeletePrompt(): void {
    if (!deletingPrompt) {
      setDeleteTargetPrompt(null);
    }
  }

  async function handleSeedPresets() {
    try {
      await seedPresets();
      toast.success("標準プリセットプロンプトを復元しました");
    } catch {
      toast.error("プリセットの復元に失敗しました");
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* ページヘッダー */}
      <SettingsHeader
        activeTab={activeTab}
        onSeedPresets={() => void handleSeedPresets()}
        onCreateLlm={openCreateLlmModal}
        onCreateEmbedding={openCreateEmbeddingModal}
        onCreatePrompt={openCreatePromptModal}
      />

      {/* タブ切り替え */}
      <SettingsTabs
        activeTab={activeTab}
        onChange={setActiveTab}
        llmCount={llmConfigs.length}
        embeddingCount={embeddingConfigs.length}
        promptCount={customPrompts.length}
        mcpKeyCount={mcpKeys.length}
      />

      {/* LLM タブ */}
      {activeTab === "llm" && (
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
      {activeTab === "embedding" && (
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

      {/* カスタムプロンプト タブ */}
      {activeTab === "prompt" && (
        <CustomPromptList
          loading={promptsLoading}
          error={promptsError}
          prompts={customPrompts}
          onCreate={openCreatePromptModal}
          onEdit={openEditPromptModal}
          onDelete={setDeleteTargetPrompt}
        />
      )}

      {/* MCP APIキー タブ */}
      {activeTab === "mcp" && <McpKeySection />}

      {/* モーダル群 */}
      <SettingsModals
        llmModalOpen={llmModalOpen}
        onCloseLlmModal={() => setLlmModalOpen(false)}
        editingLlmConfig={editingLlmConfig}
        llmConfigsCount={llmConfigs.length}
        onCreateLlm={createLLM}
        onUpdateLlm={updateLLM}
        onTestLlm={testLLM}
        llmSubmitting={creatingLLM || updatingLLM}
        embeddingModalOpen={embeddingModalOpen}
        onCloseEmbeddingModal={() => setEmbeddingModalOpen(false)}
        editingEmbeddingConfig={editingEmbeddingConfig}
        embeddingConfigsCount={embeddingConfigs.length}
        onCreateEmbedding={createEmbedding}
        onUpdateEmbedding={updateEmbedding}
        onTestEmbedding={testEmbedding}
        embeddingSubmitting={creatingEmbedding || updatingEmbedding}
        promptModalOpen={promptModalOpen}
        onClosePromptModal={() => setPromptModalOpen(false)}
        onSubmitPrompt={handlePromptModalSubmit}
        editingPrompt={editingPrompt}
        deleteTargetPrompt={deleteTargetPrompt}
        onCloseDeletePrompt={handleCloseDeletePrompt}
        onConfirmDeletePrompt={() => void handleConfirmDeletePrompt()}
        deletingPrompt={deletingPrompt}
        reindexModalOpen={reindexModalOpen}
        onCloseReindexModal={() => setReindexModalOpen(false)}
        reindexProgress={reindexProgress}
        reindexRunning={reindexRunning}
        reindexDone={reindexDone}
        reindexError={reindexError}
        onStartReindex={() => void handleStartReindex()}
        reindexTargetModelName={
          defaultEmbeddingConfig?.name ?? "デフォルト埋め込みモデル"
        }
        reindexDimensions={defaultEmbeddingConfig?.dimensions}
      />
    </div>
  );
}
