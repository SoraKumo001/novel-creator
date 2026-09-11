import { describe, expect, it } from "vitest";
import { z } from "zod";
import { isRetryable, toJsonRpcError } from "../src/mcp/errors.js";
import { batchMax20, boundedText, uuidSchema } from "../src/mcp/validation.js";

describe("toJsonRpcError", () => {
  it("未知のコードはUnknown errorにフォールバックすること", () => {
    expect(toJsonRpcError(-31_999)).toEqual({
      code: -31_999,
      message: "Unknown error",
    });
  });
});

describe("isRetryable", () => {
  it("リトライ可能エラー（transport, 503等）と非リトライ可能エラーを判定できること", () => {
    expect(isRetryable("transport")).toBe(true);
    expect(isRetryable(503)).toBe(true);
    expect(isRetryable(400)).toBe(false);
    expect(isRetryable("validation")).toBe(false);
  });
});

describe("validation helpers", () => {
  it("batchMax20: 上限20件を超過した場合はエラーになること", () => {
    const schema = batchMax20(z.string());
    expect(() => schema.parse(new Array(21).fill("x") as string[])).toThrow();
    expect(schema.parse(new Array(20).fill("x") as string[])).toHaveLength(20);
    expect(uuidSchema.safeParse("not-a-uuid").success).toBe(false);
    expect(boundedText(3).safeParse("abcd").success).toBe(false);
  });
});
