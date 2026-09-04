export type SettingsTab = "llm" | "embedding" | "prompt";

export interface SettingsTabsProps {
  activeTab: SettingsTab;
  embeddingCount: number;
  llmCount: number;
  onChange: (tab: SettingsTab) => void;
  promptCount: number;
}

/**
 * 設定画面のタブ切り替え。表示・文言は分割前と同一。
 */
export function SettingsTabs({
  activeTab,
  onChange,
  llmCount,
  embeddingCount,
  promptCount,
}: SettingsTabsProps): React.JSX.Element {
  return (
    <nav className="border-border border-b">
      <div className="flex gap-2 overflow-x-auto scroll-smooth pb-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => onChange("llm")}
          className={`group flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 font-medium text-sm transition ${
            activeTab === "llm"
              ? "border-primary bg-primary/5 font-semibold text-primary"
              : "border-transparent text-muted-foreground hover:border-border hover:bg-surface-hover hover:text-foreground"
          }`}
        >
          <span aria-hidden="true">🤖</span>
          <span>テキスト生成 LLM ({llmCount})</span>
        </button>
        <button
          type="button"
          onClick={() => onChange("embedding")}
          className={`group flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 font-medium text-sm transition ${
            activeTab === "embedding"
              ? "border-primary bg-primary/5 font-semibold text-primary"
              : "border-transparent text-muted-foreground hover:border-border hover:bg-surface-hover hover:text-foreground"
          }`}
        >
          <span aria-hidden="true">🧬</span>
          <span>埋め込み (Embedding) モデル ({embeddingCount})</span>
        </button>
        <button
          type="button"
          onClick={() => onChange("prompt")}
          className={`group flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 font-medium text-sm transition ${
            activeTab === "prompt"
              ? "border-primary bg-primary/5 font-semibold text-primary"
              : "border-transparent text-muted-foreground hover:border-border hover:bg-surface-hover hover:text-foreground"
          }`}
        >
          <span aria-hidden="true">🪄</span>
          <span>カスタムプロンプト ({promptCount})</span>
        </button>
      </div>
    </nav>
  );
}
