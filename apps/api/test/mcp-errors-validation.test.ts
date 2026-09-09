import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { isRetryable, toJsonRpcError } from "../src/mcp/errors.js";
import { notifyToolsChanged } from "../src/mcp/server.js";
import { batchMax20, boundedText, uuidSchema } from "../src/mcp/validation.js";

describe("toJsonRpcError", () => {
  it("対応表のコードを変換すること", () => {
    expect(toJsonRpcError(-32_700)).toEqual({
      code: -32_700,
      message: "Parse error",
    });
    expect(toJsonRpcError(-32_600).message).toBe("Invalid Request");
    expect(toJsonRpcError(-32_601).message).toBe("Method not found");
    expect(toJsonRpcError(-32_602).message).toBe("Invalid params");
    expect(toJsonRpcError(-32_603).message).toBe("Internal error");
    expect(toJsonRpcError(-32_020).message).toBe("HeaderMismatch");
    expect(toJsonRpcError(-32_021).message).toBe("MissingCapability");
  });

  it("未知のコードはUnknown errorにすること", () => {
    expect(toJsonRpcError(-31_999)).toEqual({
      code: -31_999,
      message: "Unknown error",
    });
  });
});

describe("isRetryable", () => {
  it("transport/-32603/503/timeoutのみtrueを返すこと", () => {
    expect(isRetryable("transport")).toBe(true);
    expect(isRetryable("timeout")).toBe(true);
    expect(isRetryable(-32_603)).toBe(true);
    expect(isRetryable(503)).toBe(true);
  });

  it("それ以外はfalseを返すこと", () => {
    expect(isRetryable(-32_600)).toBe(false);
    expect(isRetryable(-32_601)).toBe(false);
    expect(isRetryable(-32_602)).toBe(false);
    expect(isRetryable(400)).toBe(false);
    expect(isRetryable("validation")).toBe(false);
  });
});

describe("batchMax20", () => {
  it("上限超過でthrowし20件は通すこと", () => {
    const schema = batchMax20(z.string());
    expect(() => schema.parse(new Array(21).fill("x") as string[])).toThrow();
    expect(schema.parse(new Array(20).fill("x") as string[])).toHaveLength(20);
    expect(uuidSchema.safeParse("not-a-uuid").success).toBe(false);
    expect(boundedText(3).safeParse("abcd").success).toBe(false);
  });
});

describe("notifyToolsChanged", () => {
  it("notification未対応ではnoopで解決すること", async () => {
    await expect(notifyToolsChanged({} as McpServer)).resolves.toBeUndefined();
  });
});
