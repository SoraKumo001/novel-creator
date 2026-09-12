import { useState } from "react";
import { Button } from "@/components/Button.js";
import { Card } from "@/components/Card.js";
import { ConfirmDialog } from "@/components/ConfirmDialog.js";
import { Loading } from "@/components/Loading.js";
import { useToast } from "@/hooks/useToast.js";
import { toErrorMessage } from "@/lib/errors.js";
import { getVectorIndexStatus } from "@/lib/services/vector.js";
import type {
  EmbeddingConfig,
  TestConnectionResult,
  TestEmbeddingConnectionInput,
  VectorIndexStatus,
} from "@/lib/types.js";
import { ConfigCard } from "./ConfigCard.js";

interface EmbeddingConfigSectionProps {
  configs: EmbeddingConfig[];
  error: string | null;
  isAdmin?: boolean;
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
  isAdmin = false,
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
  const [statusChecking, setStatusChecking] = useState(false);
  const [dimensionMismatch, setDimensionMismatch] =
    useState<VectorIndexStatus | null>(null);

  /**
   * 再構築モーダルを開く前にインデックス次元を照合する。
   * 不一致時はバナーを表示してブロックし、作り直し後に再実行させる。
   * 状態取得自体に失敗した場合は従来どおりモーダルを開く（SSE 側で検出する）。
   */
  async function handleOpenReindex(): Promise<void> {
    setStatusChecking(true);
    try {
      const status = await getVectorIndexStatus();
      if (!status.match) {
        setDimensionMismatch(status);
        return;
      }
      setDimensionMismatch(null);
      onOpenReindexModal();
    } catch (e) {
      toast.error(toErrorMessage(e));
      onOpenReindexModal();
    } finally {
      setStatusChecking(false);
    }
  }

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
              小説の登場人物や設定、本文をベクトル化してセマンティック検索（RAG）を行います。
              {!isAdmin && (
                <span className="ml-1 text-primary">
                  ※
                  埋め込みモデルの変更・インデックス再構築は管理者権限が必要です。
                </span>
              )}
            </p>
          </div>
          {isAdmin && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void handleOpenReindex()}
              isLoading={statusChecking}
            >
              ⚡ インデックス全再構築
            </Button>
          )}
        </div>

        {dimensionMismatch && !dimensionMismatch.match && (
          <div className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-danger text-xs">
            <div className="font-bold">
              ⚠ ベクトルインデックスの次元が一致しません（必要次元{" "}
              {dimensionMismatch.requiredDimensions} / 現行{" "}
              {dimensionMismatch.indexDimensions}）
            </div>
            <p className="mt-1 leading-relaxed">
              Vectorize
              インデックスの作り直しが必要です。以下のコマンドで作り直した後に「インデックス全再構築」を再実行してください。
            </p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-surface-raised p-2 font-mono text-[11px] text-foreground">
              {`npx wrangler vectorize delete <index>\nnpx wrangler vectorize create <index> --dimensions ${dimensionMismatch.requiredDimensions} --metric cosine`}
            </pre>
            <div className="mt-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void handleOpenReindex()}
                isLoading={statusChecking}
              >
                再確認する
              </Button>
            </div>
          </div>
        )}

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
              {isAdmin && (
                <div className="mt-6">
                  <Button
                    onClick={onOpenCreateModal}
                    leftIcon={<span>＋</span>}
                  >
                    最初の埋め込みモデルを追加する
                  </Button>
                </div>
              )}
            </div>
          </Card>
        ) : (
          <div className="grid gap-4">
            {configs.map((cfg) => {
              const isRowTesting = testingId === cfg.id;

              return (
                <ConfigCard
                  key={cfg.id}
                  name={cfg.name}
                  provider={cfg.provider}
                  isDefault={cfg.isDefault}
                  modelId={cfg.modelId}
                  baseUrl={cfg.baseUrl}
                  apiKeyDisplay={
                    cfg.hasApiKey
                      ? (cfg.apiKeyMasked ?? "登録済み")
                      : "環境変数をフォールバック利用"
                  }
                  description={cfg.description}
                  dimensionsLabel={`${cfg.dimensions} 次元`}
                  actions={
                    isAdmin ? (
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
                      </>
                    ) : undefined
                  }
                />
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
