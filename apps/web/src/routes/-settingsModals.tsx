import { ConfirmDialog } from "@/components/ConfirmDialog.js";
import { CustomPromptModal } from "@/components/CustomPromptModal.js";
import { ReindexProgressModal } from "@/components/ReindexProgressModal.js";
import { EmbeddingConfigModal } from "@/components/settings/EmbeddingConfigModal.js";
import { LLMConfigModal } from "@/components/settings/LLMConfigModal.js";
import type {
  CreateCustomPromptInput,
  CreateEmbeddingConfigInput,
  CreateLLMConfigInput,
  CustomPrompt,
  EmbeddingConfig,
  LLMConfig,
  ReindexProgressEvent,
  TestConnectionInput,
  TestConnectionResult,
  TestEmbeddingConnectionInput,
  UpdateCustomPromptInput,
  UpdateEmbeddingConfigInput,
  UpdateLLMConfigInput,
} from "@/lib/types.js";

export interface SettingsModalsProps {
  deleteTargetPrompt: CustomPrompt | null;
  deletingPrompt: boolean;
  editingEmbeddingConfig: EmbeddingConfig | null;
  editingLlmConfig: LLMConfig | null;
  editingPrompt: CustomPrompt | null;
  embeddingConfigsCount: number;
  embeddingModalOpen: boolean;
  embeddingSubmitting: boolean;
  llmConfigsCount: number;
  llmModalOpen: boolean;
  llmSubmitting: boolean;
  onCloseDeletePrompt: () => void;
  onCloseEmbeddingModal: () => void;
  onCloseLlmModal: () => void;
  onClosePromptModal: () => void;
  onCloseReindexModal: () => void;
  onConfirmDeletePrompt: () => void;
  onCreateEmbedding: (
    input: CreateEmbeddingConfigInput
  ) => Promise<EmbeddingConfig>;
  onCreateLlm: (input: CreateLLMConfigInput) => Promise<LLMConfig>;
  onStartReindex: () => void;
  onSubmitPrompt: (
    data: CreateCustomPromptInput | UpdateCustomPromptInput
  ) => Promise<void>;
  onTestEmbedding: (
    input: TestEmbeddingConnectionInput
  ) => Promise<TestConnectionResult>;
  onTestLlm: (input: TestConnectionInput) => Promise<TestConnectionResult>;
  onUpdateEmbedding: (
    id: string,
    input: UpdateEmbeddingConfigInput
  ) => Promise<EmbeddingConfig>;
  onUpdateLlm: (id: string, input: UpdateLLMConfigInput) => Promise<LLMConfig>;
  promptModalOpen: boolean;
  reindexDimensions?: number;
  reindexDone: boolean;
  reindexError: string | null;
  reindexModalOpen: boolean;
  reindexProgress: ReindexProgressEvent | null;
  reindexRunning: boolean;
  reindexTargetModelName: string;
}

/**
 * 設定画面のモーダル群（LLM / Embedding / カスタムプロンプト / 削除確認 / 再構築進捗）。
 * 保存・検証挙動は分割前と同一（ハンドラは親から受け取る）。
 */
export function SettingsModals({
  llmModalOpen,
  onCloseLlmModal,
  editingLlmConfig,
  llmConfigsCount,
  onCreateLlm,
  onUpdateLlm,
  onTestLlm,
  llmSubmitting,
  embeddingModalOpen,
  onCloseEmbeddingModal,
  editingEmbeddingConfig,
  embeddingConfigsCount,
  onCreateEmbedding,
  onUpdateEmbedding,
  onTestEmbedding,
  embeddingSubmitting,
  promptModalOpen,
  onClosePromptModal,
  onSubmitPrompt,
  editingPrompt,
  deleteTargetPrompt,
  onCloseDeletePrompt,
  onConfirmDeletePrompt,
  deletingPrompt,
  reindexModalOpen,
  onCloseReindexModal,
  reindexProgress,
  reindexRunning,
  reindexDone,
  reindexError,
  onStartReindex,
  reindexTargetModelName,
  reindexDimensions,
}: SettingsModalsProps): React.JSX.Element {
  return (
    <>
      {/* LLM モーダル */}
      <LLMConfigModal
        isOpen={llmModalOpen}
        onClose={onCloseLlmModal}
        editingConfig={editingLlmConfig}
        configsCount={llmConfigsCount}
        onCreate={onCreateLlm}
        onUpdate={onUpdateLlm}
        onTestConnection={onTestLlm}
        isSubmitting={llmSubmitting}
      />

      {/* Embedding モーダル */}
      <EmbeddingConfigModal
        isOpen={embeddingModalOpen}
        onClose={onCloseEmbeddingModal}
        editingConfig={editingEmbeddingConfig}
        configsCount={embeddingConfigsCount}
        onCreate={onCreateEmbedding}
        onUpdate={onUpdateEmbedding}
        onTestConnection={onTestEmbedding}
        isSubmitting={embeddingSubmitting}
      />

      {/* カスタムプロンプト モーダル */}
      <CustomPromptModal
        open={promptModalOpen}
        onClose={onClosePromptModal}
        onSubmit={onSubmitPrompt}
        editingPrompt={editingPrompt}
      />

      {/* カスタムプロンプト削除確認 */}
      <ConfirmDialog
        isOpen={deleteTargetPrompt !== null}
        onClose={onCloseDeletePrompt}
        onConfirm={onConfirmDeletePrompt}
        title="プロンプトの削除"
        message={`カスタムプロンプト「${deleteTargetPrompt?.name ?? ""}」を削除してもよろしいですか？`}
        confirmLabel="削除"
        cancelLabel="キャンセル"
        isLoading={deletingPrompt}
      />

      {/* インデックス再構築モーダル */}
      <ReindexProgressModal
        isOpen={reindexModalOpen}
        onClose={onCloseReindexModal}
        progress={reindexProgress}
        isRunning={reindexRunning}
        isDone={reindexDone}
        error={reindexError}
        onStart={onStartReindex}
        targetModelName={reindexTargetModelName}
        dimensions={reindexDimensions}
      />
    </>
  );
}
