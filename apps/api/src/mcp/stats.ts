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
  latency: Record<string, McpLatencyHistogram>;
  perStatus: Record<McpEventStatus, number>;
  totals: number;
  uptimeSec: number;
}

/**
 * レイテンシヒストグラムの境界（ミリ秒）。
 * p50/p95 推定用。label は tool 名ではなく method のみ使う
 * （高カーディナリティ化を避けるため）。
 */
export const MCP_LATENCY_BOUNDS_MS: readonly number[] = [
  50, 100, 250, 500, 1000, 2500, 5000, 10_000, 30_000,
];

export interface McpLatencyHistogram {
  /** 累積バケット（bounds と同数＋ +Inf 枠）。 */
  buckets: number[];
  count: number;
  p50Ms: number | null;
  p95Ms: number | null;
  sumMs: number;
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
const latencyByMethod: Map<string, McpLatencyHistogram> = new Map();

function emptyHistogram(): McpLatencyHistogram {
  return {
    buckets: new Array(MCP_LATENCY_BOUNDS_MS.length + 1).fill(0),
    count: 0,
    p50Ms: null,
    p95Ms: null,
    sumMs: 0,
  };
}

function estimateQuantile(
  buckets: number[],
  count: number,
  q: number
): number | null {
  if (count === 0) {
    return null;
  }
  const rank = Math.ceil(q * count);
  for (const [index, value] of buckets.entries()) {
    if (value >= rank) {
      return index < MCP_LATENCY_BOUNDS_MS.length
        ? (MCP_LATENCY_BOUNDS_MS[index] as number)
        : null;
    }
  }
  return null;
}

/** MCP リクエストイベントを1件記録する。 */
export function recordMcpEvent(status: McpEventStatus): void {
  counts[status] += 1;
}

/**
 * レイテンシを1件記録する。method label のみ使い、tool 名は使わない。
 */
export function recordMcpLatency(method: string, durationMs: number): void {
  const label = method || "unknown";
  let histogram = latencyByMethod.get(label);
  if (!histogram) {
    histogram = emptyHistogram();
    latencyByMethod.set(label, histogram);
  }
  const duration = Math.max(0, durationMs);
  histogram.count += 1;
  histogram.sumMs += duration;
  const boundIndex = MCP_LATENCY_BOUNDS_MS.findIndex((b) => duration <= b);
  const start = boundIndex === -1 ? histogram.buckets.length - 1 : boundIndex;
  for (let i = start; i < histogram.buckets.length; i += 1) {
    histogram.buckets[i] = (histogram.buckets[i] ?? 0) + 1;
  }
  histogram.p50Ms = estimateQuantile(histogram.buckets, histogram.count, 0.5);
  histogram.p95Ms = estimateQuantile(histogram.buckets, histogram.count, 0.95);
}

/** 集計スナップショットを返す。 */
export function getMcpStats(now: number = Date.now()): McpStats {
  const totals = STATUSES.reduce((sum, s) => sum + counts[s], 0);
  const latency: Record<string, McpLatencyHistogram> = {};
  for (const [method, histogram] of latencyByMethod) {
    latency[method] = { ...histogram, buckets: [...histogram.buckets] };
  }
  return {
    latency,
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
  latencyByMethod.clear();
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
  lines.push(
    "# HELP mcp_latency_bucket MCP request latency histogram by method",
    "# TYPE mcp_latency_bucket histogram"
  );
  for (const [method, histogram] of Object.entries(stats.latency)) {
    for (const [index, bound] of MCP_LATENCY_BOUNDS_MS.entries()) {
      lines.push(
        `mcp_latency_bucket{method="${method}",le="${bound}"} ${histogram.buckets[index] ?? 0}`
      );
    }
    lines.push(
      `mcp_latency_bucket{method="${method}",le="+Inf"} ${histogram.buckets[histogram.buckets.length - 1] ?? 0}`
    );
    lines.push(`mcp_latency_sum{method="${method}"} ${histogram.sumMs}`);
    lines.push(`mcp_latency_count{method="${method}"} ${histogram.count}`);
  }
  return `${lines.join("\n")}\n`;
}
