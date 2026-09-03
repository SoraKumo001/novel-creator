import { createLazyFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Button } from "@/components/Button.js";
import { Card, CardHeader } from "@/components/Card.js";
import { ConfirmDialog } from "@/components/ConfirmDialog.js";
import { Loading } from "@/components/Loading.js";
import { ReindexProgressModal } from "@/components/ReindexProgressModal.js";
import { Select } from "@/components/Select.js";
import { useExportNovel } from "@/hooks/useBackup.js";
import { useEmbeddingConfigs } from "@/hooks/useEmbeddingConfigs.js";
import { useNovels } from "@/hooks/useNovels.js";
import { useRestoreNovel } from "@/hooks/useRestore.js";
import { useToast } from "@/hooks/useToast.js";
import { toErrorMessage } from "@/lib/errors.js";
import type { BackupData } from "@/lib/types.js";
import {
  buildCounts,
  DownloadIcon,
  downloadBackupFile,
  formatBackupDate,
  PreviewRow,
  parseBackupFile,
  RestoreIcon,
  UploadIcon,
  useReindexFlow,
  WarningIcon,
} from "./-backupParts.js";

export const Route = createLazyFileRoute("/backup")({
  component: BackupPage,
});

export function BackupPage() {
  const { novels, loading: loadingNovels, error: novelsError } = useNovels();
  const { exportNovel, exporting } = useExportNovel();
  const { restoreNovel, restoring } = useRestoreNovel();
  const { defaultConfig: defaultEmbeddingConfig } = useEmbeddingConfigs();
  const toast = useToast();

  const [selectedNovelId, setSelectedNovelId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<BackupData | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const reindex = useReindexFlow(defaultEmbeddingConfig?.id);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    if (!selectedNovelId) {
      return;
    }
    try {
      const res = await exportNovel(selectedNovelId);
      const data = (await res.json()) as BackupData;
      downloadBackupFile(data, selectedNovelId);
      toast.success("バックアップを作成しました");
    } catch (e) {
      toast.error(toErrorMessage(e));
    }
  }

  function resetFile() {
    setFile(null);
    setParsed(null);
    setParseError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setParsed(null);
    setParseError(null);
    if (!f) {
      return;
    }
    try {
      setParsed(await parseBackupFile(f));
    } catch (e) {
      setParseError(toErrorMessage(e));
    }
  }

  async function handleRestore() {
    if (!parsed) {
      return;
    }
    setConfirmOpen(false);
    try {
      await restoreNovel(parsed);
      toast.success(
        "リストアが完了しました。ベクトルデータの再生成をお忘れなく"
      );
      resetFile();
    } catch (e) {
      toast.error(toErrorMessage(e));
    }
  }

  const counts = parsed ? buildCounts(parsed) : null;
  const restoreTitle = parsed?.meta?.novelTitle ?? "選択中の小説";

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <h1 className="font-bold text-3xl text-foreground tracking-tight">
          バックアップ・リストア
        </h1>
        <p className="mt-1 text-muted">
          小説単位でデータをJSONファイルに保存・復元します。
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader
            title="バックアップ（エクスポート）"
            subtitle="小説単位でデータをJSONファイルに保存します"
          />
          {loadingNovels && <Loading message="読み込み中..." />}
          {!loadingNovels && novelsError && (
            <div className="rounded-lg border border-danger-border bg-danger-subtle p-4 text-danger-subtle-fg text-sm">
              {novelsError}
            </div>
          )}
          {!loadingNovels && !novelsError && novels.length === 0 && (
            <div className="rounded-lg border border-border bg-surface-muted p-4 text-foreground-secondary text-sm">
              小説がまだありません。新規作成してからバックアップしてください。
            </div>
          )}
          {!loadingNovels && !novelsError && novels.length > 0 && (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="novel-select"
                  className="mb-1.5 block font-medium text-foreground-secondary text-sm"
                >
                  小説を選択
                </label>
                <Select
                  id="novel-select"
                  value={selectedNovelId}
                  onChange={(e) => setSelectedNovelId(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">選択してください</option>
                  {novels.map((novel) => (
                    <option key={novel.id} value={novel.id}>
                      {novel.title}
                    </option>
                  ))}
                </Select>
              </div>
              <Button
                onClick={handleExport}
                isLoading={exporting}
                disabled={!selectedNovelId}
                leftIcon={<DownloadIcon />}
              >
                エクスポート
              </Button>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title="リストア（インポート）"
            subtitle="バックアップファイルからデータを復元します"
          />
          <div className="mb-5 rounded-lg border border-warning-border bg-warning-subtle p-4 text-sm text-warning-subtle-fg">
            <div className="flex items-start gap-2.5">
              <WarningIcon className="mt-0.5 h-5 w-5 shrink-0" />
              <p>
                リストア後はベクトルデータの再生成（整合性更新）を手動で実行してください。バックアップにはベクトルデータは含まれません。
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <Button
                onClick={reindex.openModal}
                disabled={reindex.running}
                isLoading={reindex.running}
                leftIcon={<span>⚡</span>}
              >
                ベクトルデータを再生成する
              </Button>
            </div>
            <div>
              <label
                htmlFor="backup-file"
                className="mb-1.5 block font-medium text-foreground-secondary text-sm"
              >
                バックアップファイル
              </label>
              <input
                id="backup-file"
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="sr-only"
              />
              <label
                htmlFor="backup-file"
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-foreground text-sm transition hover:border-primary hover:bg-primary-subtle"
              >
                <UploadIcon className="h-5 w-5 text-muted" />
                <span className="flex-1 truncate">
                  {file ? file.name : "JSONファイルを選択"}
                </span>
                {file && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      resetFile();
                    }}
                    className="rounded p-1 text-muted transition hover:bg-surface-hover hover:text-foreground"
                    aria-label="クリア"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                      className="h-4 w-4"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
              </label>
              {parseError && (
                <p className="mt-1.5 text-rose-500 text-xs">{parseError}</p>
              )}
            </div>
            {parsed && counts && (
              <div className="rounded-lg border border-border bg-primary-subtle p-4">
                <h4 className="mb-2 font-semibold text-primary-subtle-fg text-sm">
                  バックアップ内容のプレビュー
                </h4>
                <div className="grid gap-2 text-foreground-secondary text-sm sm:grid-cols-2">
                  <PreviewRow label="タイトル" value={parsed.meta.novelTitle} />
                  <PreviewRow
                    label="エクスポート日"
                    value={formatBackupDate(parsed.meta.exportedAt)}
                  />
                  {Object.entries(counts).map(([label, value]) => (
                    <PreviewRow
                      key={label}
                      label={label}
                      value={String(value)}
                    />
                  ))}
                </div>
              </div>
            )}
            <Button
              variant="danger"
              onClick={() => setConfirmOpen(true)}
              isLoading={restoring}
              disabled={!parsed}
              leftIcon={<RestoreIcon />}
            >
              リストア
            </Button>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleRestore}
        title="リストアの確認"
        message={`小説「${restoreTitle}」の既存データはすべて上書きされ、バックアップファイルのデータで置き換えられます。この操作は取り消せません。また、ベクトルデータはリストア後に手動で再生成する必要があります。`}
        confirmLabel="上書きして復元"
        cancelLabel="キャンセル"
        isLoading={restoring}
      />

      <ReindexProgressModal
        isOpen={reindex.modalOpen}
        onClose={() => reindex.setModalOpen(false)}
        progress={reindex.progress}
        isRunning={reindex.running}
        isDone={reindex.done}
        error={reindex.error}
        onStart={reindex.start}
        targetModelName={
          defaultEmbeddingConfig?.name ?? "デフォルト埋め込みモデル"
        }
        dimensions={defaultEmbeddingConfig?.dimensions}
      />
    </div>
  );
}
