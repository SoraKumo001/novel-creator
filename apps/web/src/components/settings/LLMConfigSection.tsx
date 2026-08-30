import { useState } from 'react';
import { Button } from '@/components/Button.js';
import { Card } from '@/components/Card.js';
import { ConfirmDialog } from '@/components/ConfirmDialog.js';
import { Loading } from '@/components/Loading.js';
import { Tag } from '@/components/Tag.js';
import { getProviderBadge } from '@/components/LLMModelSelector.js';
import { useToast } from '@/hooks/useToast.js';
import { toErrorMessage } from '@/lib/errors.js';
import type { LLMConfig, TestConnectionInput, TestConnectionResult } from '@/lib/types.js';

interface LLMConfigSectionProps {
  configs: LLMConfig[];
  loading: boolean;
  error: string | null;
  onOpenCreateModal: () => void;
  onOpenEditModal: (config: LLMConfig) => void;
  onSetDefault: (id: string) => Promise<LLMConfig>;
  onDelete: (id: string) => Promise<void>;
  onTestConnection: (input: TestConnectionInput) => Promise<TestConnectionResult>;
  isSettingDefault: boolean;
  isDeleting: boolean;
}

export function LLMConfigSection({
  configs,
  loading,
  error,
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
      <div className="rounded-lg border border-danger-border bg-danger-subtle p-4 text-sm text-danger-subtle-fg">
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
          <h3 className="text-lg font-medium text-foreground">登録済みモデルがありません</h3>
          <p className="mt-1 text-sm text-muted">
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
          const badge = getProviderBadge(cfg.provider);
          const isRowTesting = testingId === cfg.id;

          return (
            <Card key={cfg.id} className="transition hover:border-border-hover">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-semibold text-foreground truncate">
                      {cfg.name}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.bg}`}
                    >
                      {badge.icon} {badge.label}
                    </span>
                    {cfg.isDefault && <Tag>★ デフォルト</Tag>}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground-secondary">
                    <div>
                      <span className="text-muted">Model ID:</span>{' '}
                      <code className="rounded bg-surface-raised px-1.5 py-0.5 font-mono text-foreground">
                        {cfg.modelId}
                      </code>
                    </div>
                    {cfg.baseUrl && (
                      <div>
                        <span className="text-muted">Base URL:</span>{' '}
                        <span className="truncate max-w-xs font-mono">{cfg.baseUrl}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-muted">API Key:</span>{' '}
                      <span>
                        {cfg.hasApiKey
                          ? (cfg.apiKeyMasked ?? '登録済み')
                          : '環境変数をフォールバック利用'}
                      </span>
                    </div>
                  </div>

                  {cfg.description && <p className="text-xs text-muted mt-1">{cfg.description}</p>}
                </div>

                <div className="flex items-center gap-2 shrink-0">
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
                        if (res.success) toast.success(`接続成功 (${res.latencyMs}ms)`);
                        else toast.error(`接続失敗: ${res.error ?? '応答なし'}`);
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
                      onClick={() => onSetDefault(cfg.id)}
                      isLoading={isSettingDefault}
                    >
                      デフォルトに設定
                    </Button>
                  )}

                  <Button variant="secondary" size="sm" onClick={() => onOpenEditModal(cfg)}>
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

      <ConfirmDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={async () => {
          if (!deletingId) return;
          try {
            await onDelete(deletingId);
            toast.success('LLM設定を削除しました');
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
