import type {
  CreateLLMConfigInput,
  LLMConfig,
  TestConnectionInput,
  TestConnectionResult,
  UpdateLLMConfigInput,
} from "@/lib/types.js";
import { ConfigFormModal } from "./ConfigFormModal.js";

interface LLMConfigModalProps {
  configsCount: number;
  editingConfig: LLMConfig | null;
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onCreate: (input: CreateLLMConfigInput) => Promise<LLMConfig>;
  onTestConnection: (
    input: TestConnectionInput
  ) => Promise<TestConnectionResult>;
  onUpdate: (id: string, input: UpdateLLMConfigInput) => Promise<LLMConfig>;
}

export function LLMConfigModal({
  isOpen,
  onClose,
  editingConfig,
  configsCount,
  onCreate,
  onUpdate,
  onTestConnection,
  isSubmitting,
}: LLMConfigModalProps) {
  return (
    <ConfigFormModal
      kind="llm"
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
