import { useState } from "react";
import { Button } from "@/components/Button.js";
import { Card } from "@/components/Card.js";
import { ConfirmDialog } from "@/components/ConfirmDialog.js";
import { getProviderBadge } from "@/components/LLMModelSelector.js";
import { Loading } from "@/components/Loading.js";
import { Tag } from "@/components/Tag.js";
import { useToast } from "@/hooks/useToast.js";
import { toErrorMessage } from "@/lib/errors.js";
import type {
  EmbeddingConfig,
  TestConnectionResult,
  TestEmbeddingConnectionInput,
} from "@/lib/types.js";

interface EmbeddingConfigSectionProps {
  configs: EmbeddingConfig[];
  error: string | null;
  isDeleting: boolean;
  isSettingDefault: boolean;
  loading: boolean;
  onDelete: (id: string) => Promise<void>;
  onOpenCreateModal: () => void;
  onOpenEditModal: (config: EmbeddingConfig) => void;
  onOpenReindexModal: () => void;
  onSetDefault: (id: string) => Promise<EmbeddingConfig>;
  onTestConnection: (
    input: TestEmbeddingConnectionInput
  ) => Promise<TestConnectionResult>;
}

export function EmbeddingConfigSection({
  configs,
  loading,
  error,
  onOpenCreateModal,
  onOpenEditModal,
  onSetDefault,
  onDelete,
  onOpenReindexModal,
  onTestConnection,
  isSettingDefault,
  isDeleting,
}: EmbeddingConfigSectionProps) {
  const toast = useToast();
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (loading) {
    return <Loading message="埋め込み設定を読み込み中..." />;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-danger-border bg-danger-subtle p-4 text-danger-subtle-fg text-sm">
        {error}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-raised p-4 text-muted-foreground text-xs sm:flex-row sm:items-center sm:justify-between">
          <div>
            <strong className="font-semibold text-foreground">
              🧬 埋め込みモデル（Embedding）とベクトルインデックス
            </strong>
            <p className="mt-0.5">
              小説の登場人物や設定、本文をベクトル化してセマンティック検索（RAG）を行います。モデルを変更した場合は「インデックス全再構築」を行ってください。
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={onOpenReindexModal}>
            ⚡ インデックス全再構築
          </Button>
        </div>

        {configs.length === 0 ? (
          <Card>
            <div className="py-12 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-subtle text-2xl">
                🧬
              </div>
              <h3 className="font-medium text-foreground text-lg">
                登録済み埋め込みモデルがありません
              </h3>
              <p className="mt-1 text-muted text-sm">
                現在はサーバー環境変数（.env）に設定された埋め込みモデルが使用されています。
                <br />
                OpenAI、Google Gemini、Ollama などを登録して切り替えられます。
              </p>
              <div className="mt-6">
                <Button onClick={onOpenCreateModal} leftIcon={<span>＋</span>}>
                  最初の埋め込みモデルを追加する
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <div className="grid gap-4">
            {configs.map((cfg) => {
              const badge = getProviderBadge(cfg.provider);
              const isRowTesting = testingId === cfg.id;

              return (
                <Card
                  key={cfg.id}
                  className="transition hover:border-border-hover"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-semibold text-foreground text-lg">
                          {cfg.name}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-medium text-xs ${badge.bg}`}
                        >
                          {badge.icon} {badge.label}
                        </span>
                        <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 font-semibold text-primary text-xs">
                          {cfg.dimensions} 次元
                        </span>
                        {cfg.isDefault && <Tag>★ デフォルト</Tag>}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-foreground-secondary text-xs">
                        <div>
                          <span className="text-muted">Model ID:</span>{" "}
                          <code className="rounded bg-surface-raised px-1.5 py-0.5 font-mono text-foreground">
                            {cfg.modelId}
                          </code>
                        </div>
                        {cfg.baseUrl && (
                          <div>
                            <span className="text-muted">Base URL:</span>{" "}
                            <span className="max-w-xs truncate font-mono">
                              {cfg.baseUrl}
                            </span>
                          </div>
                        )}
                        <div>
                          <span className="text-muted">API Key:</span>{" "}
                          <span>
                            {cfg.hasApiKey
                              ? (cfg.apiKeyMasked ?? "登録済み")
                              : "環境変数をフォールバック利用"}
                          </span>
                        </div>
                      </div>

                      {cfg.description && (
                        <p className="mt-1 text-muted text-xs">
                          {cfg.description}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={async () => {
                          setTestingId(cfg.id);
                          try {
                            const res = await onTestConnection({
                              provider: cfg.provider,
                              modelId: cfg.modelId,
                              dimensions: cfg.dimensions,
                              baseUrl: cfg.baseUrl ?? undefined,
                            });
                            if (res.success) {
                              toast.success(`接続成功 (${res.latencyMs}ms)`);
                            } else {
                              toast.error(
                                `接続失敗: ${res.error ?? "応答なし"}`
                              );
                            }
                          } finally {
                            setTestingId(null);
                          }
                        }}
                        isLoading={isRowTesting}
                      >
                        接続テスト
                      </Button>

                      {!cfg.isDefault && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={async () => {
                            await onSetDefault(cfg.id);
                            toast.success(
                              "デフォルト埋め込みモデルを変更しました"
                            );
                            onOpenReindexModal();
                          }}
                          isLoading={isSettingDefault}
                        >
                          デフォルトに設定
                        </Button>
                      )}

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onOpenEditModal(cfg)}
                      >
                        編集
                      </Button>

                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setDeletingId(cfg.id)}
                        disabled={isDeleting}
                      >
                        削除
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
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
            toast.success("埋め込み設定を削除しました");
            setDeletingId(null);
          } catch (err) {
            toast.error(toErrorMessage(err));
          }
        }}
        title="埋め込み設定の削除"
        message="この埋め込みモデル設定を削除しますか？削除された設定は元に戻せません。"
        confirmLabel="削除する"
        isLoading={isDeleting}
      />
    </>
  );
}
