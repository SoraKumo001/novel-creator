import type {
  CreateEmbeddingConfigInput,
  EmbeddingConfig,
  TestConnectionResult,
  TestEmbeddingConnectionInput,
  UpdateEmbeddingConfigInput,
} from "@/lib/types.js";
import { ConfigFormModal } from "./ConfigFormModal.js";

interface EmbeddingConfigModalProps {
  configsCount: number;
  editingConfig: EmbeddingConfig | null;
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onCreate: (input: CreateEmbeddingConfigInput) => Promise<EmbeddingConfig>;
  onTestConnection: (
    input: TestEmbeddingConnectionInput
  ) => Promise<TestConnectionResult>;
  onUpdate: (
    id: string,
    input: UpdateEmbeddingConfigInput
  ) => Promise<EmbeddingConfig>;
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
  return (
    <ConfigFormModal
      kind="embedding"
      isOpen={isOpen}
      onClose={onClose}
      editingConfig={editingConfig}
      configsCount={configsCount}
      onCreate={onCreate}
      onUpdate={onUpdate}
      onTestConnection={onTestConnection}
      isSubmitting={isSubmitting}
    />
  );
}
