import { afterEach, describe, expect, it, vi } from "vitest";

import { parseEnv, parseEnvFromBindings } from "../src/env.js";

const LOCAL_FALLBACK_URL = "postgres://novel:novel@localhost:5433/novel";

const warnSpies: Array<ReturnType<typeof vi.spyOn>> = [];

afterEach(() => {
  for (const spy of warnSpies) {
    spy.mockRestore();
  }
  warnSpies.length = 0;
});

function spyOnConsoleWarn() {
  const spy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  warnSpies.push(spy);
  return spy;
}

describe("parseEnvFromBindings", () => {
  it("DATABASE_URL バインディングが無ければエラーを投げること", () => {
    expect(() => parseEnvFromBindings({})).toThrow(/DATABASE_URL/);
  });

  it("DATABASE_URL が undefined でもエラーを投げること", () => {
    expect(() => parseEnvFromBindings({ DATABASE_URL: undefined })).toThrow(
      /DATABASE_URL/
    );
  });

  it("DATABASE_URL バインディングがあればパースできること", () => {
    const env = parseEnvFromBindings({
      DATABASE_URL: "postgres://example:5432/novel",
      LLM_PROVIDER: "openai",
    });
    expect(env.DATABASE_URL).toBe("postgres://example:5432/novel");
    expect(env.LLM_PROVIDER).toBe("openai");
  });

  it("オブジェクト型バインディング（Hyperdrive 等）を無視してパースできること", () => {
    const env = parseEnvFromBindings({
      DATABASE_URL: "postgres://example:5432/novel",
      HYPERDRIVE: { connectionString: "postgres://hyperdrive/db" },
    });
    expect(env.DATABASE_URL).toBe("postgres://example:5432/novel");
  });
});

describe("parseEnv DATABASE_URL fallback", () => {
  it("NODE_ENV=production で DATABASE_URL 未設定なら一度だけ警告してローカル既定値を使うこと", () => {
    const warn = spyOnConsoleWarn();

    const env = parseEnv({ NODE_ENV: "production" });
    expect(env.DATABASE_URL).toBe(LOCAL_FALLBACK_URL);

    // 2 回目以降は警告しない（one-time）
    parseEnv({ NODE_ENV: "production" });
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("NODE_ENV=production でも DATABASE_URL を明示していれば警告しないこと", () => {
    const warn = spyOnConsoleWarn();

    const env = parseEnv({
      DATABASE_URL: "postgres://example:5432/novel",
      NODE_ENV: "production",
    });
    expect(env.DATABASE_URL).toBe("postgres://example:5432/novel");
    expect(warn).not.toHaveBeenCalled();
  });

  it("開発環境では DATABASE_URL 未設定でも警告せずローカル既定値を使うこと", () => {
    const warn = spyOnConsoleWarn();

    const env = parseEnv({});
    expect(env.DATABASE_URL).toBe(LOCAL_FALLBACK_URL);
    expect(warn).not.toHaveBeenCalled();
  });
});
