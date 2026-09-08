import { useState } from "react";
import { Button } from "@/components/Button.js";
import { Card } from "@/components/Card.js";
import { ConfirmDialog } from "@/components/ConfirmDialog.js";
import { Loading } from "@/components/Loading.js";
import { Modal } from "@/components/Modal.js";
import { Tag } from "@/components/Tag.js";
import { useMcpKeys } from "@/hooks/useMcpKeys.js";
import { useToast } from "@/hooks/useToast.js";
import { toErrorMessage } from "@/lib/errors.js";
import type { CreateMcpKeyResult, McpKey } from "@/lib/services/mcpKey.js";

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return value;
  }
  return d.toLocaleString("ja-JP");
}

export function McpKeySection() {
  const toast = useToast();
  const { keys, loading, error, createKey, revokeKey, creating, revoking } =
    useMcpKeys();

  const [issueOpen, setIssueOpen] = useState(false);
  const [name, setName] = useState("");
  const [novelId, setNovelId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [issued, setIssued] = useState<CreateMcpKeyResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  if (loading) {
    return <Loading message="MCP APIキーを読み込み中..." />;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-danger-border bg-danger-subtle p-4 text-danger-subtle-fg text-sm">
        {error}
      </div>
    );
  }

  async function handleIssue(): Promise<void> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("キー名を入力してください");
      return;
    }
    try {
      const result = await createKey({
        name: trimmedName,
        novelId: novelId.trim() ? novelId.trim() : null,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      });
      setIssued(result);
      setCopied(false);
      setIssueOpen(false);
      setName("");
      setNovelId("");
      setExpiresAt("");
      toast.success("MCP APIキーを発行しました");
    } catch (err) {
      toast.error(toErrorMessage(err));
    }
  }

  async function handleCopyPlainKey(): Promise<void> {
    if (!issued) {
      return;
    }
    try {
      await navigator.clipboard.writeText(issued.plainKey);
      setCopied(true);
      toast.success("平文キーをコピーしました");
    } catch {
      toast.error("コピーに失敗しました。手動で選択してコピーしてください");
    }
  }

  const revokingTarget: McpKey | undefined = keys.find(
    (k) => k.id === revokingId
  );

  if (keys.length === 0 && !issued) {
    return (
      <>
        <Card>
          <div className="py-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-subtle text-2xl">
              🔑
            </div>
            <h3 className="font-medium text-foreground text-lg">
              発行済みキーがありません
            </h3>
            <p className="mt-1 text-muted text-sm">
              MCPサーバーから利用するためのAPIキーを発行できます。
              <br />
              平文キーは発行直後にのみ表示されます。
            </p>
            <div className="mt-6">
              <Button
                onClick={() => setIssueOpen(true)}
                leftIcon={<span>＋</span>}
              >
                最初のキーを発行する
              </Button>
            </div>
          </div>
        </Card>
        <IssueModal
          isOpen={issueOpen}
          name={name}
          novelId={novelId}
          expiresAt={expiresAt}
          creating={creating}
          onChangeName={setName}
          onChangeNovelId={setNovelId}
          onChangeExpiresAt={setExpiresAt}
          onClose={() => setIssueOpen(false)}
          onSubmit={() => void handleIssue()}
        />
        <IssuedModal
          issued={issued}
          copied={copied}
          onCopy={() => void handleCopyPlainKey()}
          onClose={() => setIssued(null)}
        />
      </>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-muted text-sm">
          平文キーは発行直後にのみ表示されます。一覧ではマスク表示のみです。
        </p>
        <Button
          onClick={() => setIssueOpen(true)}
          leftIcon={<span>＋</span>}
          size="sm"
        >
          新しいキーを発行
        </Button>
      </div>

      <div className="grid gap-4">
        {keys.map((key) => {
          const revoked = Boolean(key.revokedAt);
          return (
            <Card key={key.id}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-semibold text-foreground text-lg">
                      {key.name}
                    </span>
                    {revoked ? <Tag>失効済み</Tag> : <Tag>有効</Tag>}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-foreground-secondary text-xs">
                    <div>
                      <span className="text-muted">Prefix:</span>{" "}
                      <code className="rounded bg-surface-raised px-1.5 py-0.5 font-mono text-foreground">
                        {key.prefix}
                      </code>
                    </div>
                    <div>
                      <span className="text-muted">Masked:</span>{" "}
                      <code className="rounded bg-surface-raised px-1.5 py-0.5 font-mono text-foreground">
                        {key.masked}
                      </code>
                    </div>
                    {key.novelId && (
                      <div>
                        <span className="text-muted">Novel ID:</span>{" "}
                        <code className="rounded bg-surface-raised px-1.5 py-0.5 font-mono text-foreground">
                          {key.novelId}
                        </code>
                      </div>
                    )}
                    <div>
                      <span className="text-muted">有効期限:</span>{" "}
                      {formatDateTime(key.expiresAt)}
                    </div>
                    <div>
                      <span className="text-muted">作成:</span>{" "}
                      {formatDateTime(key.createdAt)}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {!revoked && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setRevokingId(key.id)}
                      disabled={revoking}
                    >
                      失効
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <IssueModal
        isOpen={issueOpen}
        name={name}
        novelId={novelId}
        expiresAt={expiresAt}
        creating={creating}
        onChangeName={setName}
        onChangeNovelId={setNovelId}
        onChangeExpiresAt={setExpiresAt}
        onClose={() => setIssueOpen(false)}
        onSubmit={() => void handleIssue()}
      />
      <IssuedModal
        issued={issued}
        copied={copied}
        onCopy={() => void handleCopyPlainKey()}
        onClose={() => setIssued(null)}
      />
      <ConfirmDialog
        isOpen={!!revokingId}
        onClose={() => setRevokingId(null)}
        onConfirm={async () => {
          if (!revokingId) {
            return;
          }
          try {
            await revokeKey(revokingId);
            toast.success("MCP APIキーを失効しました");
            setRevokingId(null);
          } catch (err) {
            toast.error(toErrorMessage(err));
          }
        }}
        title="MCP APIキーの失効"
        message={`「${revokingTarget?.name ?? ""}」を失効しますか？失効したキーは元に戻せません。`}
        confirmLabel="失効する"
        isLoading={revoking}
      />
    </>
  );
}

interface IssueModalProps {
  creating: boolean;
  expiresAt: string;
  isOpen: boolean;
  name: string;
  novelId: string;
  onChangeExpiresAt: (v: string) => void;
  onChangeName: (v: string) => void;
  onChangeNovelId: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

function IssueModal({
  isOpen,
  name,
  novelId,
  expiresAt,
  creating,
  onChangeName,
  onChangeNovelId,
  onChangeExpiresAt,
  onClose,
  onSubmit,
}: IssueModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="MCP APIキーの発行"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={creating}>
            キャンセル
          </Button>
          <Button onClick={onSubmit} isLoading={creating}>
            発行する
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-foreground">キー名（必須）</span>
          <input
            type="text"
            value={name}
            onChange={(e) => onChangeName(e.target.value)}
            placeholder="例: claude-code-local"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-foreground"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-foreground">
            小説ID（任意・未指定で全体）
          </span>
          <input
            type="text"
            value={novelId}
            onChange={(e) => onChangeNovelId(e.target.value)}
            placeholder="未指定可"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-foreground"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-foreground">有効期限（任意）</span>
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => onChangeExpiresAt(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-foreground"
          />
        </label>
      </div>
    </Modal>
  );
}

interface IssuedModalProps {
  copied: boolean;
  issued: CreateMcpKeyResult | null;
  onClose: () => void;
  onCopy: () => void;
}

function IssuedModal({ issued, copied, onCopy, onClose }: IssuedModalProps) {
  return (
    <Modal
      isOpen={!!issued}
      onClose={onClose}
      title="発行完了 — 平文キーは今だけ表示"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCopy}>
            {copied ? "コピー済み" : "コピー"}
          </Button>
          <Button onClick={onClose}>閉じる</Button>
        </>
      }
    >
      {issued && (
        <div className="space-y-3 text-sm">
          <p className="rounded-lg border border-danger-border bg-danger-subtle p-3 text-danger-subtle-fg">
            この平文キーは二度と表示できません。必ず今コピーして安全に保管してください。
          </p>
          <code className="block break-all rounded-lg bg-surface-raised p-3 font-mono text-foreground">
            {issued.plainKey}
          </code>
          <p className="text-muted text-xs">
            ID: {issued.id} / Prefix: {issued.prefix} / Masked: {issued.masked}
          </p>
        </div>
      )}
    </Modal>
  );
}
