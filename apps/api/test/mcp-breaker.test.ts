import { describe, expect, it } from "vitest";

import {
  type BreakerStore,
  checkBreaker,
  recordFailure,
  recordSuccess,
  releaseMcpSlot,
  resetMcpSlots,
  tryAcquireMcpSlot,
} from "../src/mcp/breaker.js";
import {
  getMcpStats,
  recordMcpLatency,
  renderMcpMetrics,
  resetMcpStats,
} from "../src/mcp/stats.js";

describe("circuit breaker", () => {
  it("5連続失敗でopenすること", () => {
    const store: BreakerStore = new Map();
    for (let i = 0; i < 4; i += 1) {
      recordFailure("k", { now: 0, store });
      expect(checkBreaker("k", { now: 0, store }).open).toBe(false);
    }
    recordFailure("k", { now: 0, store });

    const result = checkBreaker("k", { now: 0, store });
    expect(result.open).toBe(true);
    expect(result.retryAfterSec).toBeGreaterThan(0);
  });

  it("open期間終了後はhalf-openで1件のみ試行許可すること", () => {
    const store: BreakerStore = new Map();
    for (let i = 0; i < 5; i += 1) {
      recordFailure("k", { now: 0, store });
    }
    expect(checkBreaker("k", { now: 1000, store }).open).toBe(true);

    // 30s 経過後は1件試行を許可する。
    expect(checkBreaker("k", { now: 30_001, store }).open).toBe(false);
    // 試行中は再び遮断する。
    expect(checkBreaker("k", { now: 30_001, store }).open).toBe(true);
  });

  it("half-open成功でclose・失敗で再openすること", () => {
    const store: BreakerStore = new Map();
    for (let i = 0; i < 5; i += 1) {
      recordFailure("k", { now: 0, store });
    }
    expect(checkBreaker("k", { now: 30_001, store }).open).toBe(false);

    recordSuccess("k", { store });
    expect(checkBreaker("k", { now: 30_002, store }).open).toBe(false);

    for (let i = 0; i < 5; i += 1) {
      recordFailure("k", { now: 40_000, store });
    }
    expect(checkBreaker("k", { now: 70_001, store }).open).toBe(false);
    recordFailure("k", { now: 70_001, store });
    const reopened = checkBreaker("k", { now: 70_002, store });
    expect(reopened.open).toBe(true);
  });
});

describe("concurrent limit", () => {
  it("上限超過で拒否し返却で復帰すること", () => {
    resetMcpSlots();
    try {
      for (let i = 0; i < 20; i += 1) {
        expect(tryAcquireMcpSlot()).toBe(true);
      }
      expect(tryAcquireMcpSlot()).toBe(false);
      releaseMcpSlot();
      expect(tryAcquireMcpSlot()).toBe(true);
    } finally {
      resetMcpSlots();
    }
  });
});

describe("stats latency", () => {
  it("method別に集計しp50/p95を推定すること", () => {
    resetMcpStats();
    recordMcpLatency("tools/call", 40);
    recordMcpLatency("tools/call", 60);
    recordMcpLatency("tools/call", 600);
    recordMcpLatency("tools/list", 1200);

    const stats = getMcpStats();
    const call = stats.latency["tools/call"];
    expect(call?.count).toBe(3);
    expect(call?.sumMs).toBe(700);
    // 累積バケット: 40→[50..], 60→[100..], 600→[1000..]
    expect(call?.buckets[0]).toBe(1);
    expect(call?.buckets[4]).toBe(3);
    // rank ceil(0.5*3)=2 → 100ms、rank ceil(0.95*3)=3 → 1000ms
    expect(call?.p50Ms).toBe(100);
    expect(call?.p95Ms).toBe(1000);
    expect(stats.latency["tools/list"]?.count).toBe(1);
  });

  it("metricsにlatencyバケットが出ること", () => {
    resetMcpStats();
    recordMcpLatency("tools/call", 40);

    const text = renderMcpMetrics(getMcpStats());
    expect(text).toContain('mcp_latency_bucket{method="tools/call",le="50"} 1');
    expect(text).toContain(
      'mcp_latency_bucket{method="tools/call",le="+Inf"} 1'
    );
    expect(text).toContain('mcp_latency_count{method="tools/call"} 1');
  });
});
