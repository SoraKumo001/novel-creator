import { useState, useRef } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Button } from '@/components/Button.js';
import { Card, CardHeader } from '@/components/Card.js';
import { ConfirmDialog } from '@/components/ConfirmDialog.js';
import { Loading } from '@/components/Loading.js';
import { useExportNovel } from '@/hooks/useBackup.js';
import { useNovels } from '@/hooks/useNovels.js';
import { useRestoreNovel } from '@/hooks/useRestore.js';
import { useToast } from '@/hooks/useToast.js';
import { toErrorMessage } from '@/lib/errors.js';
import type { BackupData } from '@/lib/types.js';

export const Route = createFileRoute('/backup')({
  component: BackupPage,
});

export function BackupPage() {
  const { novels, loading: loadingNovels, error: novelsError } = useNovels();
  const { exportNovel, exporting } = useExportNovel();
  const { restoreNovel, restoring } = useRestoreNovel();
  const toast = useToast();

  const [selectedNovelId, setSelectedNovelId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<BackupData | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    if (!selectedNovelId) return;
    try {
      const res = await exportNovel(selectedNovelId);
      const data = (await res.json()) as BackupData;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const date = new Date().toISOString().slice(0, 10);
      const filename = `novel-backup-${selectedNovelId}-${date}.json`;
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('バックアップを作成しました');
    } catch (e) {
      toast.error(toErrorMessage(e));
    }
  }

  function resetFile() {
    setFile(null);
    setParsed(null);
    setParseError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setParsed(null);
    setParseError(null);
    if (!f) return;

    try {
      const text = await f.text();
      const parsed = JSON.parse(text) as unknown;
      if (!isBackupData(parsed)) {
        throw new Error('バックアップファイルの形式が正しくありません');
      }
      setParsed(parsed);
    } catch (e) {
      setParseError(toErrorMessage(e));
    }
  }

  async function handleRestore() {
    if (!parsed) return;
    setConfirmOpen(false);
    try {
      await restoreNovel(parsed);
      toast.success('リストアが完了しました。ベクトルデータの再生成をお忘れなく');
      resetFile();
    } catch (e) {
      toast.error(toErrorMessage(e));
    }
  }

  const counts = parsed ? buildCounts(parsed) : null;
  const restoreTitle = parsed?.meta?.novelTitle ?? '選択中の小説';

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          バックアップ・リストア
        </h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">
          小説単位でデータをJSONファイルに保存・復元します。
        </p>
      </div>

      <div className="space-y-6">
        {/* エクスポート */}
        <Card>
          <CardHeader
            title="バックアップ（エクスポート）"
            subtitle="小説単位でデータをJSONファイルに保存します"
          />

          {loadingNovels && <Loading message="読み込み中..." />}

          {!loadingNovels && novelsError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-300">
              {novelsError}
            </div>
          )}

          {!loadingNovels && !novelsError && novels.length === 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              小説がまだありません。新規作成してからバックアップしてください。
            </div>
          )}

          {!loadingNovels && !novelsError && novels.length > 0 && (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="novel-select"
                  className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  小説を選択
                </label>
                <select
                  id="novel-select"
                  value={selectedNovelId}
                  onChange={(e) => setSelectedNovelId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-400"
                >
                  <option value="">選択してください</option>
                  {novels.map((novel) => (
                    <option key={novel.id} value={novel.id}>
                      {novel.title}
                    </option>
                  ))}
                </select>
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

        {/* インポート */}
        <Card>
          <CardHeader
            title="リストア（インポート）"
            subtitle="バックアップファイルからデータを復元します"
          />

          <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
            <div className="flex items-start gap-2.5">
              <WarningIcon className="mt-0.5 h-5 w-5 shrink-0" />
              <p>
                リストア後はベクトルデータの再生成（整合性更新）を手動で実行してください。バックアップにはベクトルデータは含まれません。
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="backup-file"
                className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
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
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 transition hover:border-indigo-400 hover:bg-indigo-50/50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-indigo-500 dark:hover:bg-slate-700/50"
              >
                <UploadIcon className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                <span className="flex-1 truncate">{file ? file.name : 'JSONファイルを選択'}</span>
                {file && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      resetFile();
                    }}
                    className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
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
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </label>
              {parseError && <p className="mt-1.5 text-xs text-rose-500">{parseError}</p>}
            </div>

            {parsed && counts && (
              <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-4 dark:border-indigo-900/30 dark:bg-indigo-900/15">
                <h4 className="mb-2 text-sm font-semibold text-indigo-900 dark:text-indigo-200">
                  バックアップ内容のプレビュー
                </h4>
                <div className="grid gap-2 text-sm text-slate-700 dark:text-slate-300 sm:grid-cols-2">
                  <PreviewRow label="タイトル" value={parsed.meta.novelTitle} />
                  <PreviewRow label="エクスポート日" value={formatDate(parsed.meta.exportedAt)} />
                  {Object.entries(counts).map(([label, value]) => (
                    <PreviewRow key={label} label={label} value={String(value)} />
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
    </div>
  );
}

function isBackupData(value: unknown): value is BackupData {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (!v.meta || typeof v.meta !== 'object') return false;
  const meta = v.meta as Record<string, unknown>;
  if (typeof meta.novelId !== 'string' || typeof meta.novelTitle !== 'string') return false;
  if (!v.rdb || typeof v.rdb !== 'object' || Array.isArray(v.rdb)) return false;
  return true;
}

function buildCounts(data: BackupData): Record<string, number> {
  const labels: Record<string, string> = {
    novels: '小説',
    chapters: '章',
    sections: '節',
    contents: '本文',
    characters: '人物',
    settings: '設定',
    timelines: 'タイムライン',
    llmInstructions: 'LLM指示',
  };

  const result: Record<string, number> = {};
  for (const [key, rows] of Object.entries(data.rdb)) {
    if (Array.isArray(rows)) {
      const label = labels[key] ?? key;
      result[label] = rows.length;
    }
  }
  return result;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '未設定';
  try {
    return new Date(value).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="font-medium text-slate-900 dark:text-slate-100">{value}</span>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="h-4 w-4"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
      />
    </svg>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className ?? 'h-5 w-5'}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
      />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="h-4 w-4"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.5 16.556 18.375 12 18.375s-8.25-1.875-8.25-4.375v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"
      />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className ?? 'h-5 w-5'}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
      />
    </svg>
  );
}
