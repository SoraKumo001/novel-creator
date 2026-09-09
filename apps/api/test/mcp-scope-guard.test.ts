import { describe, expect, it } from "vitest";

import type { McpAuth } from "../src/core/types.js";
import { NotFoundError } from "../src/core/types.js";
import { assertNovelScope } from "../src/mcp/scope-guard.js";

const NOVEL_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_NOVEL_ID = "22222222-2222-4222-8222-222222222222";

function toScopedAuth(novelId: string | null): McpAuth {
  return {
    keyId: "key-1",
    novelId,
    userId: "user-1",
  };
}

describe("assertNovelScope", () => {
  it("スコープ一致の場合は何も投げないこと", () => {
    const auth = toScopedAuth(NOVEL_ID);

    expect(() => assertNovelScope(auth, NOVEL_ID)).not.toThrow();
  });

  it("スコープ不一致の場合は NotFoundError を投げること（404化・403にしない）", () => {
    const auth = toScopedAuth(NOVEL_ID);

    expect(() => assertNovelScope(auth, OTHER_NOVEL_ID)).toThrow(NotFoundError);
    expect(() => assertNovelScope(auth, OTHER_NOVEL_ID)).toThrow(
      OTHER_NOVEL_ID
    );
    try {
      assertNovelScope(auth, OTHER_NOVEL_ID);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(NotFoundError);
      expect((error as Error).name).toBe("NotFoundError");
    }
  });

  it("全体キー（novelId が null）の場合はどの小説も許可すること", () => {
    const auth = toScopedAuth(null);

    expect(() => assertNovelScope(auth, NOVEL_ID)).not.toThrow();
    expect(() => assertNovelScope(auth, OTHER_NOVEL_ID)).not.toThrow();
  });

  it("認証なし（undefined）の場合は許可すること", () => {
    expect(() => assertNovelScope(undefined, NOVEL_ID)).not.toThrow();
    expect(() => assertNovelScope(undefined, OTHER_NOVEL_ID)).not.toThrow();
  });
});
