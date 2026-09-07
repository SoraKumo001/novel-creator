interface ConnectionTestResultProps {
  latencyMs: number;
  message: string;
  success: boolean;
}

/**
 * 接続テスト結果の表示専用バナー。
 * ConfigFormModal 内の成功/失敗バナーと見た目は同一。
 */
export function ConnectionTestResult({
  latencyMs,
  message,
  success,
}: ConnectionTestResultProps) {
  return (
    <div
      className={`rounded-lg border p-3 text-xs ${
        success
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border-danger/30 bg-danger/10 text-danger"
      }`}
    >
      <div className="font-semibold">
        {success ? "✓ 接続成功" : "✗ 接続失敗"} ({latencyMs}ms)
      </div>
      <div className="mt-1 break-all">{message}</div>
    </div>
  );
}
