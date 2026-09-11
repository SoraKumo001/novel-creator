import { describe, expect, it, vi } from "vitest";
import {
  extractRetryDelayMs,
  type RetryAttemptInfo,
  withRetry,
} from "../src/retry.js";

describe("retry", () => {
  describe("extractRetryDelayMs", () => {
    it("Google Gemini の message 内の retry in Xs を抽出できること", () => {
      const error = {
        message:
          "Quota exceeded... model: gemini-embedding-2\nPlease retry in 16.462914827s.",
      };
      expect(extractRetryDelayMs(error)).toBe(16_463);
    });

    it("responseBody 内の retryDelay: 16s を抽出できること", () => {
      const error = {
        responseBody: JSON.stringify({
          error: {
            details: [
              {
                "@type": "type.googleapis.com/google.rpc.RetryInfo",
                retryDelay: "16s",
              },
            ],
          },
        }),
      };
      expect(extractRetryDelayMs(error)).toBe(16_000);
    });

    it("responseHeaders の retry-after を抽出できること", () => {
      const error = {
        responseHeaders: {
          "retry-after": "5",
        },
      };
      expect(extractRetryDelayMs(error)).toBe(5000);
    });

    it("該当する情報がない場合は null を返すこと", () => {
      const error = new Error("Generic network error");
      expect(extractRetryDelayMs(error)).toBeNull();
    });
  });

  describe("withRetry and onRetry", () => {
    it("リトライ時に onRetry コールバックが呼ばれ、試行回数と待機時間が渡されること", async () => {
      let callCount = 0;
      const retryEvents: RetryAttemptInfo[] = [];

      const mockFn = vi.fn().mockImplementation(async () => {
        callCount += 1;
        if (callCount === 1) {
          const err = new TypeError("fetch failed");
          throw err;
        }
        return "success";
      });

      const result = await withRetry(mockFn, {
        maxRetries: 2,
        retryDelay: 10,
        onRetry: (info) => retryEvents.push(info),
      });

      expect(result).toBe("success");
      expect(callCount).toBe(2);
      expect(retryEvents).toHaveLength(1);
      expect(retryEvents[0].attempt).toBe(1);
      expect(retryEvents[0].maxRetries).toBe(2);
      expect(retryEvents[0].delayMs).toBe(10);
      expect(retryEvents[0].isRateLimit).toBe(false);
    });

    it("429 レート制限エラーで isRateLimit が true になること", async () => {
      let callCount = 0;
      const retryEvents: RetryAttemptInfo[] = [];

      const mockFn = vi.fn().mockImplementation(async () => {
        callCount += 1;
        if (callCount === 1) {
          const err = new TypeError(
            "Rate limit reached. Please retry in 0.05s."
          );
          Object.assign(err, { statusCode: 429 });
          throw err;
        }
        return "ok";
      });

      const result = await withRetry(mockFn, {
        maxRetries: 2,
        retryDelay: 10,
        onRetry: (info) => retryEvents.push(info),
      });

      expect(result).toBe("ok");
      expect(retryEvents).toHaveLength(1);
      expect(retryEvents[0].isRateLimit).toBe(true);
      // 0.05s (50ms) + 500ms safety margin = 550ms
      expect(retryEvents[0].delayMs).toBe(550);
    });
  });
});
