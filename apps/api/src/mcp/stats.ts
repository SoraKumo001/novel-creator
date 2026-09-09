/**
 * MCP インメモリ集計（Workers対応）。
 * リクエスト間のメモリ共有がない環境でも安全なよう、
 * 単純なモジュール内カウンタのみで構成する。
 */

export type McpEventStatus =
  | "auth_fail"
  | "error"
  | "ok"
  | "rate_limited"
  | "timeout";

export interface McpStats {
  perStatus: Record<McpEventStatus, number>;
  totals: number;
  uptimeSec: number;
}

const STATUSES: readonly McpEventStatus[] = [
  "ok",
  "auth_fail",
  "rate_limited",
  "timeout",
  "error",
];

const startedAt: number = Date.now();
const counts: Record<McpEventStatus, number> = {
  auth_fail: 0,
  error: 0,
  ok: 0,
  rate_limited: 0,
  timeout: 0,
};

/** MCP リクエストイベントを1件記録する。 */
export function recordMcpEvent(status: McpEventStatus): void {
  counts[status] += 1;
}

/** 集計スナップショットを返す。 */
export function getMcpStats(now: number = Date.now()): McpStats {
  const totals = STATUSES.reduce((sum, s) => sum + counts[s], 0);
  return {
    perStatus: { ...counts },
    totals,
    uptimeSec: Math.max(0, Math.floor((now - startedAt) / 1000)),
  };
}

/** カウンタを初期化する（主にテスト用）。 */
export function resetMcpStats(): void {
  for (const s of STATUSES) {
    counts[s] = 0;
  }
}

/** Prometheus風テキスト形式に変換する。 */
export function renderMcpMetrics(stats: McpStats): string {
  const lines: string[] = [
    "# HELP mcp_tool_events_total MCP request events by status",
    "# TYPE mcp_tool_events_total counter",
  ];
  for (const s of STATUSES) {
    lines.push(`mcp_tool_events_total{status="${s}"} ${stats.perStatus[s]}`);
  }
  lines.push(
    "# HELP mcp_uptime_seconds MCP process uptime in seconds",
    "# TYPE mcp_uptime_seconds gauge",
    `mcp_uptime_seconds ${stats.uptimeSec}`
  );
  return `${lines.join("\n")}\n`;
}
