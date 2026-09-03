import { useState } from "react";
import { useToast } from "@/hooks/useToast.js";
import { toErrorMessage } from "@/lib/errors.js";
import { formatDateTimeJa } from "@/lib/format.js";
import { streamReindex } from "@/lib/services/vector.js";
import type { BackupData, ReindexProgressEvent } from "@/lib/types.js";

/**
 * backup ルートの API知識・表示ヘルパーの集約（routes 配下のみ）。
 * バリデーション・件数集計・日付整形・ファイル保存・再構築フローを一箇所に寄せ、
 * backup.lazy.tsx 本体を薄く保つ。SSE・API形状の変更なし。
 */

export function isBackupData(value: unknown): value is BackupData {
  if (!value || typeof value !== "object") {
    return false;
  }
  const v = value as Record<string, unknown>;
  if (!v.meta || typeof v.meta !== "object") {
    return false;
  }
  const meta = v.meta as Record<string, unknown>;
  if (typeof meta.novelId !== "string" || typeof meta.novelTitle !== "string") {
    return false;
  }
  if (!v.rdb || typeof v.rdb !== "object" || Array.isArray(v.rdb)) {
    return false;
  }
  return true;
}

export function buildCounts(data: BackupData): Record<string, number> {
  const labels: Record<string, string> = {
    novels: "小説",
    chapters: "章",
    sections: "節",
    contents: "本文",
    characters: "人物",
    settings: "設定",
    timelines: "タイムライン",
    llmInstructions: "LLM指示",
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

export function formatBackupDate(value: string | null | undefined): string {
  if (!value) {
    return "未設定";
  }
  return formatDateTimeJa(value, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function downloadBackupFile(data: BackupData, novelId: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  const filename = `novel-backup-${novelId}-${date}.json`;
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function parseBackupFile(file: File): Promise<BackupData> {
  const text = await file.text();
  const parsed = JSON.parse(text) as unknown;
  if (!isBackupData(parsed)) {
    throw new Error("バックアップファイルの形式が正しくありません");
  }
  return parsed;
}

/** ベクトル再構築フロー（設定ページと同一の streamReindex 呼び出しを集約） */
export function useReindexFlow(defaultEmbeddingConfigId?: string) {
  const [modalOpen, setModalOpen] = useState(false);
  const [progress, setProgress] = useState<ReindexProgressEvent | null>(null);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const openModal = () => {
    setProgress(null);
    setDone(false);
    setError(null);
    setModalOpen(true);
  };

  const start = async () => {
    setRunning(true);
    setDone(false);
    setError(null);
    setProgress({
      current: 0,
      total: 0,
      percent: 0,
      stage: "再構築を開始しています...",
    });
    try {
      await streamReindex({
        embeddingConfigId: defaultEmbeddingConfigId,
        onProgress: (p) => setProgress(p),
        onDone: () => {
          setRunning(false);
          setDone(true);
          toast.success("インデックス再構築が完了しました");
        },
        onError: (err) => {
          setRunning(false);
          setError(err);
          toast.error(`再構築エラー: ${err}`);
        },
      });
    } catch (e) {
      setRunning(false);
      setError(toErrorMessage(e));
      toast.error(toErrorMessage(e));
    }
  };

  return {
    modalOpen,
    setModalOpen,
    progress,
    running,
    done,
    error,
    openModal,
    start,
  };
}

export function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

export function DownloadIcon() {
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

export function UploadIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className ?? "h-5 w-5"}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
      />
    </svg>
  );
}

export function RestoreIcon() {
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

export function WarningIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className ?? "h-5 w-5"}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
      />
    </svg>
  );
}
