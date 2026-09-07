import type { LLMProviderType } from "@novel-creator/shared";
import type { FormEvent } from "react";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/Button.js";
import { Combobox } from "@/components/Combobox.js";
import { Input } from "@/components/Input.js";
import { Modal } from "@/components/Modal.js";
import { Select } from "@/components/Select.js";
import { Textarea } from "@/components/Textarea.js";
import { useToast } from "@/hooks/useToast.js";
import { toErrorMessage } from "@/lib/errors.js";
import { listEmbeddingModels } from "@/lib/services/embeddingConfig.js";
import { listLLMModels } from "@/lib/services/llmConfig.js";
import type {
  CreateEmbeddingConfigInput,
  CreateLLMConfigInput,
  EmbeddingConfig,
  LLMConfig,
  TestConnectionInput,
  TestConnectionResult,
  TestEmbeddingConnectionInput,
  UpdateEmbeddingConfigInput,
  UpdateLLMConfigInput,
} from "@/lib/types.js";
import {
  EMBEDDING_PRESETS,
  type EmbeddingPreset,
  LLM_PRESETS,
  type LLMPreset,
} from "./presets.js";

export type ConfigKind = "embedding" | "llm";

interface KindDescriptor {
  baseUrlPlaceholderCustom: string;
  baseUrlPlaceholderDefault: string;
  defaultCheckboxId: string;
  defaultCheckboxLabel: string;
  defaultModelId: string;
  descriptionPlaceholder: string;
  displayNamePlaceholder: string;
  modelPlaceholder: string;
  providerOptions: { label: string; value: LLMProviderType }[];
  titleCreate: string;
  titleEdit: string;
  toastCreated: string;
  toastUpdated: string;
}

const KIND_CONFIG: Record<ConfigKind, KindDescriptor> = {
  llm: {
    baseUrlPlaceholderCustom:
      "例: http://localhost:1234/v1 (LM Studio) / http://localhost:8000/v1 (vLLM)",
    baseUrlPlaceholderDefault:
      "例: http://localhost:11434/v1 (Ollama) または https://openrouter.ai/api/v1",
    defaultCheckboxId: "isDefaultCheck",
    defaultCheckboxLabel: "デフォルトモデルに設定する",
    defaultModelId: "",
    descriptionPlaceholder: "このモデルの用途や特徴をメモできます",
    displayNamePlaceholder: "例: Claude 3.7 Sonnet (執筆用)",
    modelPlaceholder:
      "例: claude-3-7-sonnet-20250219, gpt-4o, gemini-2.5-flash",
    providerOptions: [
      { value: "openai", label: "OpenAI (GPT-4o, o3-miniなど)" },
      {
        value: "anthropic",
        label: "Anthropic (Claude 3.7 Sonnet, Claude 3.5 Haikuなど)",
      },
      { value: "google", label: "Google (Gemini 2.5 Pro, Flashなど)" },
      { value: "ollama", label: "Ollama (ローカル/Cloud LLM)" },
      {
        value: "custom_openai",
        label: "OpenAI互換 (OpenRouter, Groq, vLLM等)",
      },
    ],
    titleCreate: "新しいLLMを追加",
    titleEdit: "LLM設定の編集",
    toastCreated: "新しいLLMを追加しました",
    toastUpdated: "LLM設定を更新しました",
  },
  embedding: {
    baseUrlPlaceholderCustom:
      "例: http://localhost:1234/v1 (LM Studio) / http://localhost:8000/v1 (vLLM)",
    baseUrlPlaceholderDefault: "例: http://localhost:11434/v1 (Ollama)",
    defaultCheckboxId: "isEmbeddingDefaultCheck",
    defaultCheckboxLabel: "デフォルト埋め込みモデルに設定する",
    defaultModelId: "text-embedding-3-small",
    descriptionPlaceholder: "このモデルの用途や次元数などのメモ",
    displayNamePlaceholder: "例: OpenAI text-embedding-3-small (1536d)",
    modelPlaceholder: "例: text-embedding-3-small",
    providerOptions: [
      { value: "openai", label: "OpenAI (text-embedding-3-small/large)" },
      { value: "google", label: "Google (gemini-embedding-001)" },
      { value: "ollama", label: "Ollama (nomic-embed-text, bge-m3等)" },
      { value: "custom_openai", label: "OpenAI互換 エンドポイント" },
    ],
    titleCreate: "新しい埋め込みモデルを追加",
    titleEdit: "埋め込み設定の編集",
    toastCreated: "新しい埋め込みモデルを追加しました",
    toastUpdated: "埋め込み設定を更新しました",
  },
};

interface ConfigFormModalBase {
  configsCount: number;
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
}

export interface EmbeddingFormModalProps extends ConfigFormModalBase {
  editingConfig: EmbeddingConfig | null;
  kind: "embedding";
  onCreate: (input: CreateEmbeddingConfigInput) => Promise<EmbeddingConfig>;
  onTestConnection: (
    input: TestEmbeddingConnectionInput
  ) => Promise<TestConnectionResult>;
  onUpdate: (
    id: string,
    input: UpdateEmbeddingConfigInput
  ) => Promise<EmbeddingConfig>;
}

export interface LLMFormModalProps extends ConfigFormModalBase {
  editingConfig: LLMConfig | null;
  kind: "llm";
  onCreate: (input: CreateLLMConfigInput) => Promise<LLMConfig>;
  onTestConnection: (
    input: TestConnectionInput
  ) => Promise<TestConnectionResult>;
  onUpdate: (id: string, input: UpdateLLMConfigInput) => Promise<LLMConfig>;
}

export type ConfigFormModalProps = EmbeddingFormModalProps | LLMFormModalProps;

export function ConfigFormModal(props: ConfigFormModalProps) {
  const toast = useToast();
  const { kind, configsCount, isOpen, isSubmitting, onClose } = props;
  const config = KIND_CONFIG[kind];

  const [name, setName] = useState("");
  const [provider, setProvider] = useState<LLMProviderType>("openai");
  const [modelId, setModelId] = useState(config.defaultModelId);
  const [dimensions, setDimensions] = useState(1536);
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [description, setDescription] = useState("");

  const [testingInline, setTestingInline] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(
    null
  );
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [listingModels, setListingModels] = useState(false);
  const modelInputId = useId();

  const editingConfig = props.editingConfig;

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    if (editingConfig) {
      setName(editingConfig.name);
      setProvider(editingConfig.provider);
      setModelId(editingConfig.modelId);
      if (kind === "embedding" && "dimensions" in editingConfig) {
        setDimensions(editingConfig.dimensions);
      }
      setBaseUrl(editingConfig.baseUrl ?? "");
      setApiKey("");
      setIsDefault(editingConfig.isDefault);
      setDescription(editingConfig.description ?? "");
    } else {
      setName("");
      setProvider("openai");
      setModelId(config.defaultModelId);
      setDimensions(1536);
      setBaseUrl("");
      setApiKey("");
      setIsDefault(configsCount === 0);
      setDescription("");
    }
    setTestResult(null);
    setModelOptions([]);
  }, [isOpen, editingConfig, configsCount, kind, config]);

  function applyPreset(preset: EmbeddingPreset | LLMPreset): void {
    setName(preset.name);
    setProvider(preset.provider);
    setModelId(preset.modelId);
    setBaseUrl(preset.baseUrl ?? "");
    if ("dimensions" in preset) {
      setDimensions(preset.dimensions);
    }
    setModelOptions([]);
  }

  const presets = kind === "llm" ? LLM_PRESETS : EMBEDDING_PRESETS;
  const isCustomOpenAI = provider === "custom_openai";
  const canListModels =
    provider === "openai" ||
    provider === "ollama" ||
    provider === "custom_openai";

  async function handleListModels(): Promise<void> {
    if (!baseUrl.trim()) {
      toast.error("Base URLを入力してください");
      return;
    }
    setListingModels(true);
    try {
      const listModels = kind === "llm" ? listLLMModels : listEmbeddingModels;
      const res = await listModels({
        baseUrl: baseUrl.trim(),
        apiKey: apiKey.trim() || undefined,
      });
      setModelOptions(res.models);
      if (res.models.length === 0) {
        toast.error("モデルが見つかりませんでした");
      } else {
        toast.success(`モデル一覧を取得しました (${res.models.length}件)`);
      }
    } catch (e) {
      toast.error(toErrorMessage(e));
    } finally {
      setListingModels(false);
    }
  }

  async function handleTest(): Promise<void> {
    if (!modelId.trim()) {
      toast.error("モデルIDを入力してください");
      return;
    }
    setTestingInline(true);
    setTestResult(null);
    try {
      const baseInput = {
        provider,
        modelId: modelId.trim(),
        baseUrl: baseUrl.trim() || undefined,
        apiKey: apiKey.trim() || undefined,
      };
      const res =
        props.kind === "llm"
          ? await props.onTestConnection(baseInput)
          : await props.onTestConnection({ ...baseInput, dimensions });
      setTestResult(res);
      if (
        props.kind === "embedding" &&
        res.success &&
        typeof res.detectedDimensions === "number"
      ) {
        setDimensions(res.detectedDimensions);
        toast.success(`接続成功 (次元数: ${res.detectedDimensions}を自動設定)`);
      } else if (res.success) {
        toast.success(`接続成功 (${res.latencyMs}ms)`);
      } else {
        toast.error(`接続失敗: ${res.error ?? "応答なし"}`);
      }
    } catch (e) {
      toast.error(toErrorMessage(e));
    } finally {
      setTestingInline(false);
    }
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("表示名を入力してください");
      return;
    }
    if (!modelId.trim()) {
      toast.error("モデルIDを入力してください");
      return;
    }
    if (isCustomOpenAI && !baseUrl.trim()) {
      toast.error("OpenAI互換ではBase URLが必須です");
      return;
    }

    try {
      const baseInput = {
        name: name.trim(),
        provider,
        modelId: modelId.trim(),
        baseUrl: baseUrl.trim() || null,
        isDefault,
        description: description.trim() || null,
      };
      const trimmedApiKey = apiKey.trim();
      if (props.kind === "llm") {
        if (props.editingConfig) {
          const input: UpdateLLMConfigInput = { ...baseInput };
          if (trimmedApiKey) {
            input.apiKey = trimmedApiKey;
          }
          await props.onUpdate(props.editingConfig.id, input);
          toast.success(config.toastUpdated);
        } else {
          const input: CreateLLMConfigInput = {
            ...baseInput,
            apiKey: trimmedApiKey || null,
          };
          await props.onCreate(input);
          toast.success(config.toastCreated);
        }
      } else if (props.editingConfig) {
        const input: UpdateEmbeddingConfigInput = {
          ...baseInput,
          dimensions,
        };
        if (trimmedApiKey) {
          input.apiKey = trimmedApiKey;
        }
        await props.onUpdate(props.editingConfig.id, input);
        toast.success(config.toastUpdated);
      } else {
        const input: CreateEmbeddingConfigInput = {
          ...baseInput,
          dimensions,
          apiKey: trimmedApiKey || null,
        };
        await props.onCreate(input);
        toast.success(config.toastCreated);
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
      title={editingConfig ? config.titleEdit : config.titleCreate}
    >
      <form onSubmit={handleSubmit} autoComplete="off" className="space-y-3">
        {!editingConfig && (
          <details className="rounded-lg border border-border bg-surface-raised/40 px-3 py-2">
            <summary className="cursor-pointer select-none font-medium text-foreground-secondary text-xs marker:text-muted hover:text-foreground">
              プリセットから素早く入力
            </summary>
            <div className="flex flex-wrap gap-1.5 pt-2">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="rounded-md border border-border bg-surface-raised px-2 py-1 text-foreground text-xs transition hover:border-primary hover:text-primary"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </details>
        )}

        <Input
          label="表示名"
          placeholder={config.displayNamePlaceholder}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          name="nc-config-display-name"
          autoComplete="off"
        />

        <div>
          <label className="mb-1.5 block font-medium text-foreground-secondary text-sm">
            プロバイダ種別
          </label>
          <Select
            value={provider}
            onChange={(e) => setProvider(e.target.value as LLMProviderType)}
            className="w-full px-3 py-2 text-sm focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary"
          >
            {config.providerOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-3 rounded-lg border border-border-subtle bg-surface-raised/30 p-3">
          <div>
            <label
              htmlFor={modelInputId}
              className="mb-1.5 block font-medium text-foreground-secondary text-sm"
            >
              モデル識別子 (Model ID)
            </label>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <Combobox
                  id={modelInputId}
                  placeholder={config.modelPlaceholder}
                  value={modelId}
                  onChange={setModelId}
                  options={modelOptions}
                  required
                  name="nc-config-model-ref"
                  hint="一覧から選択または直接入力できます"
                />
              </div>
              {canListModels && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleListModels()}
                  isLoading={listingModels}
                  className="h-9 shrink-0 whitespace-nowrap"
                >
                  一覧取得
                </Button>
              )}
            </div>
          </div>

          {kind === "embedding" && (
            <>
              <div className="max-w-60">
                <Input
                  label="ベクトル次元数"
                  type="number"
                  value={dimensions}
                  onChange={(e) =>
                    setDimensions(Number.parseInt(e.target.value, 10) || 1536)
                  }
                  required
                  name="nc-config-dimensions"
                  autoComplete="off"
                />
              </div>
              <p className="-mt-1 text-muted text-xs">
                次元数はモデル側と一致必須。変更後はベクトル再構築が必要
              </p>
              {canListModels && modelOptions.length > 0 && (
                <p className="text-muted text-xs">
                  選択後は接続テストで次元数の自動設定をお試しください
                </p>
              )}
            </>
          )}

          <Input
            label={isCustomOpenAI ? "Base URL (必須)" : "Base URL (任意)"}
            placeholder={
              isCustomOpenAI
                ? config.baseUrlPlaceholderCustom
                : config.baseUrlPlaceholderDefault
            }
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            required={isCustomOpenAI}
            name="nc-config-endpoint"
            autoComplete="off"
          />

          <Input
            label="API キー (任意)"
            type="password"
            placeholder={
              editingConfig
                ? editingConfig.hasApiKey
                  ? "登録済みキーを維持"
                  : "未設定 (環境変数を使用)"
                : "未入力の場合はサーバー環境変数を使用"
            }
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            name="nc-config-secret"
            autoComplete="new-password"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            id={config.defaultCheckboxId}
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
          />
          <label
            htmlFor={config.defaultCheckboxId}
            className="select-none text-foreground text-sm"
          >
            {config.defaultCheckboxLabel}
          </label>
        </div>

        <Textarea
          label="備考・説明 (任意)"
          placeholder={config.descriptionPlaceholder}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />

        {testResult && (
          <div
            className={`rounded-lg border p-3 text-xs ${
              testResult.success
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-danger/30 bg-danger/10 text-danger"
            }`}
          >
            <div className="font-semibold">
              {testResult.success ? "✓ 接続成功" : "✗ 接続失敗"} (
              {testResult.latencyMs}ms)
            </div>
            <div className="mt-1 break-all">{testResult.message}</div>
          </div>
        )}

        <div className="flex items-center justify-between border-border border-t pt-3">
          <Button
            type="button"
            variant="secondary"
            onClick={handleTest}
            isLoading={testingInline}
          >
            接続テスト
          </Button>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              キャンセル
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {editingConfig ? "保存する" : "追加する"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
