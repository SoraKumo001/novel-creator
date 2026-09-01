import { useLLMConfigs } from "@/hooks/useLLMConfigs.js";

interface LLMModelSelectorProps {
  allowDefault?: boolean;
  className?: string;
  label?: string;
  onChange: (id: string | null) => void;
  size?: "sm" | "md";
  value?: string | null;
}

export function getProviderBadge(provider: string) {
  switch (provider) {
    case "openai":
      return {
        icon: "🟢",
        label: "OpenAI",
        bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      };
    case "anthropic":
      return {
        icon: "🟠",
        label: "Anthropic",
        bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      };
    case "google":
      return {
        icon: "🔵",
        label: "Google",
        bg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      };
    case "ollama":
      return {
        icon: "🦙",
        label: "Ollama",
        bg: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
      };
    default:
      return {
        icon: "⚙️",
        label: "Custom",
        bg: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
      };
  }
}

export function LLMModelSelector({
  value,
  onChange,
  size = "md",
  className = "",
  allowDefault = true,
  label,
}: LLMModelSelectorProps) {
  const { configs, defaultConfig, loading } = useLLMConfigs();

  const isSmall = size === "sm";

  if (loading) {
    return (
      <div
        className={`flex items-center gap-1.5 text-muted-foreground text-xs ${className}`}
      >
        <span className="animate-pulse">モデル読込中...</span>
      </div>
    );
  }

  // 登録モデルが0件の場合は環境変数デフォルト表示のみ
  if (configs.length === 0) {
    return (
      <div
        className={`flex items-center gap-1 text-muted-foreground text-xs ${className}`}
      >
        <span>🤖 デフォルトLLM (環境変数)</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {label && (
        <label className="font-medium text-foreground-secondary text-xs">
          {label}
        </label>
      )}
      <select
        value={value ?? ""}
        onChange={(e) => {
          const val = e.target.value;
          onChange(val ? val : null);
        }}
        className={`rounded-md border border-border bg-surface font-medium text-foreground transition focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary ${
          isSmall ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"
        }`}
      >
        {allowDefault && (
          <option value="">
            {defaultConfig
              ? `⚙️ デフォルト (${defaultConfig.name})`
              : "⚙️ デフォルトモデル"}
          </option>
        )}
        {configs.map((cfg) => {
          const badge = getProviderBadge(cfg.provider);
          return (
            <option key={cfg.id} value={cfg.id}>
              {badge.icon} {cfg.name} ({cfg.modelId}){" "}
              {cfg.isDefault ? "★デフォルト" : ""}
            </option>
          );
        })}
      </select>
    </div>
  );
}
