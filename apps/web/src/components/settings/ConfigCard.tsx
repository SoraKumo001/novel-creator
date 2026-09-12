import type { ReactNode } from "react";
import { Card, interactiveCardHover } from "@/components/Card.js";
import { Tag } from "@/components/Tag.js";
import { ProviderBadge } from "./ProviderBadge.js";

interface ConfigCardProps {
  actions: ReactNode;
  apiKeyDisplay: string;
  baseUrl?: string | null;
  description?: string | null;
  /** 埋め込み設定のみ。指定時は「○○ 次元」バッジを表示する */
  dimensionsLabel?: string | null;
  isDefault: boolean;
  modelId: string;
  name: string;
  provider: string;
  scopeBadge?: ReactNode;
}

/**
 * LLM/埋め込み設定一覧のカード行。
 * 両セクションで重複していた表示レイアウトを共通化したもの。
 */
export function ConfigCard({
  actions,
  apiKeyDisplay,
  baseUrl,
  description,
  dimensionsLabel,
  isDefault,
  modelId,
  name,
  provider,
  scopeBadge,
}: ConfigCardProps) {
  return (
    <Card className={interactiveCardHover}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-semibold text-foreground text-lg">
              {name}
            </span>
            <ProviderBadge provider={provider} />
            {scopeBadge}
            {dimensionsLabel && (
              <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 font-semibold text-primary text-xs">
                {dimensionsLabel}
              </span>
            )}
            {isDefault && <Tag>★ デフォルト</Tag>}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-foreground-secondary text-xs">
            <div>
              <span className="text-muted">Model ID:</span>{" "}
              <code className="rounded bg-surface-raised px-1.5 py-0.5 font-mono text-foreground">
                {modelId}
              </code>
            </div>
            {baseUrl && (
              <div>
                <span className="text-muted">Base URL:</span>{" "}
                <span className="max-w-xs truncate font-mono">{baseUrl}</span>
              </div>
            )}
            <div>
              <span className="text-muted">API Key:</span>{" "}
              <span>{apiKeyDisplay}</span>
            </div>
          </div>

          {description && (
            <p className="mt-1 text-muted text-xs">{description}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      </div>
    </Card>
  );
}
