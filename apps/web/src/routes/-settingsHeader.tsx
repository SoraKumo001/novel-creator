import { Button } from "@/components/Button.js";
import type { SettingsTab } from "@/routes/-settingsTabs.js";

export interface SettingsHeaderProps {
  activeTab: SettingsTab;
  isAdmin?: boolean;
  onCreateEmbedding: () => void;
  onCreateLlm: () => void;
  onCreatePrompt: () => void;
  onSeedPresets: () => void;
}

/**
 * 設定画面のページヘッダー（タイトル / プリセット復元 / 新規追加ボタン）。
 * 表示・文言は分割前と同一。
 */
export function SettingsHeader({
  activeTab,
  isAdmin = false,
  onSeedPresets,
  onCreateLlm,
  onCreateEmbedding,
  onCreatePrompt,
}: SettingsHeaderProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="font-bold text-2xl text-foreground tracking-tight">
            <span aria-hidden="true">⚙️</span> 設定
          </h1>
          <span
            className={`inline-flex items-center rounded border px-2 py-0.5 font-semibold text-xs ${
              isAdmin
                ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "border-border bg-surface-hover text-muted-foreground"
            }`}
          >
            {isAdmin ? "👑 管理者" : "👤 一般"}
          </span>
        </div>
        <p className="mt-1 text-muted-foreground text-xs">
          LLMプロバイダ、埋め込みモデル、およびカスタムプロンプトを管理します。
        </p>
      </div>
      <div className="flex items-center gap-2">
        {activeTab === "prompt" && (
          <Button size="sm" variant="secondary" onClick={onSeedPresets}>
            🔄 プリセット復元
          </Button>
        )}
        {(activeTab === "llm" ||
          (activeTab === "embedding" && isAdmin) ||
          activeTab === "prompt") && (
          <Button
            size="sm"
            variant="primary"
            onClick={
              activeTab === "llm"
                ? onCreateLlm
                : activeTab === "embedding"
                  ? onCreateEmbedding
                  : onCreatePrompt
            }
            leftIcon={<span>＋</span>}
          >
            {activeTab === "llm"
              ? "新しいLLMを追加"
              : activeTab === "embedding"
                ? "新しい埋め込みモデルを追加"
                : "新しいプロンプトを追加"}
          </Button>
        )}
      </div>
    </div>
  );
}
