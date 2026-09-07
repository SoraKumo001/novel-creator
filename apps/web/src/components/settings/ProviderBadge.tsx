export interface ProviderBadgeInfo {
  bg: string;
  icon: string;
  label: string;
}

export function getProviderBadge(provider: string): ProviderBadgeInfo {
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

interface ProviderBadgeProps {
  className?: string;
  provider: string;
}

/**
 * プロバイダ種別の丸バッジ表示。
 * LLM/埋め込み設定カードと見た目は同一。
 */
export function ProviderBadge({
  className = "",
  provider,
}: ProviderBadgeProps) {
  const badge = getProviderBadge(provider);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-medium text-xs ${badge.bg} ${className}`}
    >
      {badge.icon} {badge.label}
    </span>
  );
}
