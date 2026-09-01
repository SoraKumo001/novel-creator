import { useEffect, useState } from "react";
import { Button } from "@/components/Button.js";
import { Input } from "@/components/Input.js";
import { Modal } from "@/components/Modal.js";
import { Select } from "@/components/Select.js";
import { Textarea } from "@/components/Textarea.js";
import { useToast } from "@/hooks/useToast.js";
import { toErrorMessage } from "@/lib/errors.js";
import type {
  CreateLLMConfigInput,
  LLMConfig,
  TestConnectionInput,
  TestConnectionResult,
  UpdateLLMConfigInput,
} from "@/lib/types.js";
import { LLM_PRESETS, type LLMPreset } from "./presets.js";

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
  const toast = useToast();

  const [name, setName] = useState("");
  const [provider, setProvider] = useState<
    "openai" | "anthropic" | "google" | "ollama" | "custom_openai"
  >("openai");
  const [modelId, setModelId] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [description, setDescription] = useState("");

  const [testingInline, setTestingInline] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(
    null
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (editingConfig) {
      setName(editingConfig.name);
      setProvider(editingConfig.provider);
      setModelId(editingConfig.modelId);
      setBaseUrl(editingConfig.baseUrl ?? "");
      setApiKey("");
      setIsDefault(editingConfig.isDefault);
      setDescription(editingConfig.description ?? "");
    } else {
      setName("");
      setProvider("openai");
      setModelId("");
      setBaseUrl("");
      setApiKey("");
      setIsDefault(configsCount === 0);
      setDescription("");
    }
    setTestResult(null);
  }, [isOpen, editingConfig, configsCount]);

  function applyPreset(p: LLMPreset) {
    setName(p.name);
    setProvider(p.provider);
    setModelId(p.modelId);
    setBaseUrl(p.baseUrl ?? "");
  }

  async function handleTest() {
    if (!modelId.trim()) {
      toast.error("モデルIDを入力してください");
      return;
    }
    setTestingInline(true);
    setTestResult(null);
    try {
      const res = await onTestConnection({
        provider,
        modelId: modelId.trim(),
        baseUrl: baseUrl.trim() || undefined,
        apiKey: apiKey.trim() || undefined,
      });
      setTestResult(res);
      if (res.success) {
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      return toast.error("表示名を入力してください");
    }
    if (!modelId.trim()) {
      return toast.error("モデルIDを入力してください");
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
        await onUpdate(editingConfig.id, input);
        toast.success("LLM設定を更新しました");
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
        await onCreate(input);
        toast.success("新しいLLMを追加しました");
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
      title={editingConfig ? "LLM設定の編集" : "新しいLLMを追加"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {!editingConfig && (
          <div>
            <label className="mb-1.5 block font-medium text-foreground-secondary text-xs">
              プリセットから素早く入力
            </label>
            <div className="flex flex-wrap gap-1.5">
              {LLM_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="rounded-md border border-border bg-surface-raised px-2 py-1 text-foreground text-xs transition hover:border-primary hover:text-primary"
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
          <label className="mb-1.5 block font-medium text-foreground-secondary text-sm">
            プロバイダ種別
          </label>
          <Select
            value={provider}
            onChange={(e) =>
              setProvider(e.target.value as CreateLLMConfigInput["provider"])
            }
            className="w-full px-3 py-2 text-sm focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary"
          >
            <option value="openai">OpenAI (GPT-4o, o3-miniなど)</option>
            <option value="anthropic">
              Anthropic (Claude 3.7 Sonnet, Claude 3.5 Haikuなど)
            </option>
            <option value="google">Google (Gemini 2.5 Pro, Flashなど)</option>
            <option value="ollama">Ollama (ローカル/Cloud LLM)</option>
            <option value="custom_openai">
              OpenAI互換 (OpenRouter, Groq, vLLM等)
            </option>
          </Select>
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
            editingConfig
              ? editingConfig.hasApiKey
                ? "登録済みキーを維持"
                : "未設定 (環境変数を使用)"
              : "未入力の場合はサーバー環境変数を使用"
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
          <label
            htmlFor="isDefaultCheck"
            className="select-none text-foreground text-sm"
          >
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
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400"
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
