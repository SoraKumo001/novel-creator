import { analysisResults } from "@novel-creator/db";
import { describe, expect, it, vi } from "vitest";
import {
  deleteResultOp,
  listResultsOp,
} from "../src/core/analysis/analysis-results.js";
import type { ServiceContext } from "../src/core/types.js";

const NOVEL_ID = "11111111-1111-4111-8111-111111111111";

function createMockContext(db: unknown): ServiceContext {
  return {
    db,
    embedding: {},
    env: {},
    llm: {},
    vectorStore: {},
  } as unknown as ServiceContext;
}

describe("Analysis Domain Service & Operations", () => {
  describe("listResultsOp", () => {
    it("小説IDに紐づく分析結果一覧を取得して降順で整形すること", async () => {
      const mockRows = [
        {
          analysisType: "story-arc",
          createdAt: new Date("2026-01-01T00:00:00Z"),
          id: "r1",
          novelId: NOVEL_ID,
          result: { summary: "テスト要約" },
          targetChapterId: null,
          targetSectionId: null,
        },
      ];

      const db = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue(mockRows),
              }),
            }),
          }),
        }),
      };

      const ctx = createMockContext(db);
      const results = await listResultsOp(ctx, NOVEL_ID);

      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe("r1");
      expect(results[0]?.analysisType).toBe("story-arc");
      expect(results[0]?.createdAt).toBe("2026-01-01T00:00:00.000Z");
    });
  });

  describe("deleteResultOp", () => {
    it("指定された結果IDと小説IDで分析結果を削除すること", async () => {
      const deleteWhere = vi.fn().mockResolvedValue(undefined);
      const db = {
        delete: vi.fn().mockReturnValue({
          where: deleteWhere,
        }),
      };

      const ctx = createMockContext(db);
      await deleteResultOp(ctx, NOVEL_ID, "r1");

      expect(db.delete).toHaveBeenCalledWith(analysisResults);
      expect(deleteWhere).toHaveBeenCalled();
    });
  });
});
