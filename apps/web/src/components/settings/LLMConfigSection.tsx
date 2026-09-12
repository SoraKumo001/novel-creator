import { useState } from "react";
import { Button } from "@/components/Button.js";
import { Card } from "@/components/Card.js";
import { ConfirmDialog } from "@/components/ConfirmDialog.js";
import { Loading } from "@/components/Loading.js";
import { useToast } from "@/hooks/useToast.js";
import { toErrorMessage } from "@/lib/errors.js";
import type {
  LLMConfig,
  TestConnectionInput,
  TestConnectionResult,
} from "@/lib/types.js";
import { ConfigCard } from "./ConfigCard.js";

interface LLMConfigSectionProps {
  configs: LLMConfig[];
  error: string | null;
  isAdmin?: boolean;
  isDeleting: boolean;
  isSettingDefault: boolean;
  loading: boolean;
  onDelete: (id: string) => Promise<void>;
  onOpenCreateModal: () => void;
  onOpenEditModal: (config: LLMConfig) => void;
  onSetDefault: (id: string) => Promise<LLMConfig>;
  onTestConnection: (
    input: TestConnectionInput
  ) => Promise<TestConnectionResult>;
}

export function LLMConfigSection({
  configs,
  loading,
  error,
  isAdmin = false,
  onOpenCreateModal,
  onOpenEditModal,
  onSetDefault,
  onDelete,
  onTestConnection,
  isSettingDefault,
  isDeleting,
}: LLMConfigSectionProps) {
  const toast = useToast();
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (loading) {
    return <Loading message="LLM設定を読み込み中..." />;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-danger-border bg-danger-subtle p-4 text-danger-subtle-fg text-sm">
        {error}
      </div>
    );
  }

  if (configs.length === 0) {
    return (
      <Card>
        <div className="py-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-subtle text-2xl">
            🤖
          </div>
          <h3 className="font-medium text-foreground text-lg">
            登録済みモデルがありません
          </h3>
          <p className="mt-1 text-muted text-sm">
            現在はサーバーの環境変数（.env）に設定されたモデルが使用されています。
            <br />
            ClaudeやOpenAI、Gemini、Ollamaなどを追加して切り替えられます。
          </p>
          <div className="mt-6">
            <Button onClick={onOpenCreateModal} leftIcon={<span>＋</span>}>
              最初のLLMを追加する
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-4">
        {configs.map((cfg) => {
          const isRowTesting = testingId === cfg.id;
          const isSystem =
            cfg.isSystem ?? (cfg.userId === null || cfg.userId === undefined);
          const canManage = isAdmin || !isSystem;

          return (
            <ConfigCard
              key={cfg.id}
              name={cfg.name}
              provider={cfg.provider}
              isDefault={cfg.isDefault}
              modelId={cfg.modelId}
              baseUrl={cfg.baseUrl}
              scopeBadge={
                isSystem ? (
                  <span className="inline-flex items-center rounded-full border border-border bg-surface-raised px-2.5 py-0.5 font-medium text-foreground-secondary text-xs">
                    🌐 システム共通
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 font-medium text-primary text-xs">
                    👤 ユーザー設定
                  </span>
                )
              }
              apiKeyDisplay={
                cfg.hasApiKey
                  ? (cfg.apiKeyMasked ?? "登録済み")
                  : "環境変数をフォールバック利用"
              }
              description={cfg.description}
              actions={
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={async () => {
                      setTestingId(cfg.id);
                      try {
                        const res = await onTestConnection({
                          provider: cfg.provider,
                          modelId: cfg.modelId,
                          baseUrl: cfg.baseUrl ?? undefined,
                        });
                        if (res.success) {
                          toast.success(`接続成功 (${res.latencyMs}ms)`);
                        } else {
                          toast.error(`接続失敗: ${res.error ?? "応答なし"}`);
                        }
                      } finally {
                        setTestingId(null);
                      }
                    }}
                    isLoading={isRowTesting}
                  >
                    接続テスト
                  </Button>

                  {canManage && !cfg.isDefault && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onSetDefault(cfg.id)}
                      isLoading={isSettingDefault}
                    >
                      デフォルトに設定
                    </Button>
                  )}

                  {canManage && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onOpenEditModal(cfg)}
                    >
                      編集
                    </Button>
                  )}

                  {canManage && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setDeletingId(cfg.id)}
                      disabled={isDeleting}
                    >
                      削除
                    </Button>
                  )}
                </>
              }
            />
          );
        })}
      </div>

      <ConfirmDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={async () => {
          if (!deletingId) {
            return;
          }
          try {
            await onDelete(deletingId);
            toast.success("LLM設定を削除しました");
            setDeletingId(null);
          } catch (err) {
            toast.error(toErrorMessage(err));
          }
        }}
        title="LLM設定の削除"
        message="このLLM設定を削除しますか？削除された設定は元に戻せません。"
        confirmLabel="削除する"
        isLoading={isDeleting}
      />
    </>
  );
}
