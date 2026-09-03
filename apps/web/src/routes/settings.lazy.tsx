import { createLazyFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/Button.js";
import { CustomPromptModal } from "@/components/CustomPromptModal.js";
import { ReindexProgressModal } from "@/components/ReindexProgressModal.js";
import { EmbeddingConfigModal } from "@/components/settings/EmbeddingConfigModal.js";
import { EmbeddingConfigSection } from "@/components/settings/EmbeddingConfigSection.js";
import { LLMConfigModal } from "@/components/settings/LLMConfigModal.js";
import { LLMConfigSection } from "@/components/settings/LLMConfigSection.js";
import { useCustomPrompts } from "@/hooks/useCustomPrompts.js";
import { useEmbeddingConfigs } from "@/hooks/useEmbeddingConfigs.js";
import { useLLMConfigs } from "@/hooks/useLLMConfigs.js";
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

export const Route = createLazyFileRoute("/settings")({
  component: SettingsPage,
});

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"llm" | "embedding" | "prompt">(
    "llm"
  );

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

  async function handleDeletePrompt(id: string, name: string) {
    if (
      !window.confirm(
        `カスタムプロンプト「${name}」を削除してもよろしいですか？`
      )
    ) {
      return;
    }
    try {
      await deletePrompt(id);
      toast.success("プロンプトを削除しました");
    } catch {
      toast.error("削除に失敗しました");
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-bold text-2xl text-foreground tracking-tight">
            ⚙️ 設定
          </h1>
          <p className="mt-1 text-muted-foreground text-xs">
            LLMプロバイダ、埋め込みモデル、およびカスタムプロンプトを管理します。
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "prompt" && (
            <Button size="sm" variant="secondary" onClick={handleSeedPresets}>
              🔄 プリセット復元
            </Button>
          )}
          <Button
            size="sm"
            variant="primary"
            onClick={
              activeTab === "llm"
                ? openCreateLlmModal
                : activeTab === "embedding"
                  ? openCreateEmbeddingModal
                  : openCreatePromptModal
            }
            leftIcon={<span>＋</span>}
          >
            {activeTab === "llm"
              ? "新しいLLMを追加"
              : activeTab === "embedding"
                ? "新しい埋め込みモデルを追加"
                : "新しいプロンプトを追加"}
          </Button>
        </div>
      </div>

      {/* タブ切り替え */}
      <div className="flex gap-2 border-border border-b">
        <button
          type="button"
          onClick={() => setActiveTab("llm")}
          className={`flex cursor-pointer items-center gap-2 border-b-2 px-4 py-2 font-semibold text-xs transition ${
            activeTab === "llm"
              ? "border-primary bg-primary/5 text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>🤖</span>
          <span>テキスト生成 LLM ({llmConfigs.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("embedding")}
          className={`flex cursor-pointer items-center gap-2 border-b-2 px-4 py-2 font-semibold text-xs transition ${
            activeTab === "embedding"
              ? "border-primary bg-primary/5 text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>🧬</span>
          <span>埋め込み (Embedding) モデル ({embeddingConfigs.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("prompt")}
          className={`flex cursor-pointer items-center gap-2 border-b-2 px-4 py-2 font-semibold text-xs transition ${
            activeTab === "prompt"
              ? "border-primary bg-primary/5 text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>🪄</span>
          <span>カスタムプロンプト ({customPrompts.length})</span>
        </button>
      </div>

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
        <div className="space-y-4">
          {promptsLoading ? (
            <div className="py-12 text-center text-muted-foreground text-xs">
              読み込み中...
            </div>
          ) : promptsError ? (
            <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-danger text-xs">
              {promptsError}
            </div>
          ) : customPrompts.length === 0 ? (
            <div className="space-y-3 py-12 text-center">
              <span className="text-3xl">🪄</span>
              <p className="text-muted-foreground text-xs">
                カスタムプロンプトがまだ登録されていません
              </p>
              <Button
                size="sm"
                variant="secondary"
                onClick={openCreatePromptModal}
              >
                プロンプトを登録する
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {customPrompts.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-col justify-between space-y-2.5 rounded-xl border border-border bg-surface p-4 shadow-sm transition hover:border-primary/50"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="shrink-0 text-2xl">
                          {p.icon || "🪄"}
                        </span>
                        <div className="min-w-0">
                          <h3 className="truncate font-bold text-foreground text-xs">
                            {p.name}
                          </h3>
                          <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span className="rounded border border-border/70 bg-muted px-1.5 py-0.2">
                              {p.category === "inline"
                                ? "インライン推敲"
                                : p.category === "generation"
                                  ? "本文・プロット生成"
                                  : p.category === "chat"
                                    ? "創作相談"
                                    : "汎用"}
                            </span>
                            <span>{p.novelId ? "作品専用" : "全作品共通"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditPromptModal(p)}
                          className="cursor-pointer rounded p-1.5 text-muted-foreground text-xs hover:bg-muted hover:text-primary"
                          title="編集"
                        >
                          ✏️ 編集
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePrompt(p.id, p.name)}
                          className="cursor-pointer rounded p-1.5 text-muted-foreground text-xs hover:bg-muted hover:text-danger"
                          title="削除"
                        >
                          🗑️ 削除
                        </button>
                      </div>
                    </div>

                    {p.description && (
                      <p className="text-muted-foreground text-xs leading-relaxed">
                        {p.description}
                      </p>
                    )}

                    <div className="max-h-32 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border/80 bg-surface-raised p-2.5 font-mono text-muted-foreground text-xs leading-relaxed">
                      {p.userPrompt}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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

      {/* カスタムプロンプト モーダル */}
      <CustomPromptModal
        open={promptModalOpen}
        onClose={() => setPromptModalOpen(false)}
        onSubmit={handlePromptModalSubmit}
        editingPrompt={editingPrompt}
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
        targetModelName={
          defaultEmbeddingConfig?.name ?? "デフォルト埋め込みモデル"
        }
        dimensions={defaultEmbeddingConfig?.dimensions}
      />
    </div>
  );
}
