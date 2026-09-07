import { useLLMConfigs } from "@/hooks/useLLMConfigs.js";
import { getProviderBadge } from "./settings/ProviderBadge.js";

export { getProviderBadge };

interface LLMModelSelectorProps {
  allowDefault?: boolean;
  className?: string;
  label?: string;
  onChange: (id: string | null) => void;
  size?: "sm" | "md";
  value?: string | null;
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
        className={`flex shrink-0 items-center gap-1 whitespace-nowrap text-muted-foreground text-xs ${className}`}
      >
        <span>🤖 デフォルトLLM (環境変数)</span>
      </div>
    );
  }

  return (
    <div className={`flex shrink-0 items-center gap-2 ${className}`}>
      {label && (
        <label className="shrink-0 font-medium text-foreground-secondary text-xs">
          {label}
        </label>
      )}
      <select
        value={value ?? ""}
        onChange={(e) => {
          const val = e.target.value;
          onChange(val ? val : null);
        }}
        className={`max-w-xs truncate rounded-md border border-border bg-surface font-medium text-foreground transition focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary ${
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
