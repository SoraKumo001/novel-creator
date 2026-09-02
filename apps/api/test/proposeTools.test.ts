import { describe, expect, it } from "vitest";
import { createProposeTools } from "../src/core/tools/proposeTools.js";
import type { ServiceContext } from "../src/core/types.js";

function createDummyCtx(): ServiceContext {
  return {
    db: {} as never,
    embedding: {} as never,
    env: {} as never,
    llm: {} as never,
    vectorStore: {} as never,
  };
}

describe("proposeTools", () => {
  const NOVEL_ID = "novel-uuid-123";

  it("createProposeTools は全 7 つの提案ツールを返す", () => {
    const tools = createProposeTools(createDummyCtx(), NOVEL_ID);
    expect(tools.proposeCreateCharacter).toBeDefined();
    expect(tools.proposeCreateSetting).toBeDefined();
    expect(tools.proposeAddForeshadowing).toBeDefined();
    expect(tools.proposeAddTimelineEvent).toBeDefined();
    expect(tools.proposeUpdatePlot).toBeDefined();
    expect(tools.proposeUpdateStoryOutline).toBeDefined();
    expect(tools.proposeBulkCreate).toBeDefined();
  });

  describe("proposeBulkCreate", () => {
    it("複数の人物や設定を含む一括提案ペイロードを生成できること", async () => {
      const tools = createProposeTools(createDummyCtx(), NOVEL_ID);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (tools.proposeBulkCreate as any).execute({
        characters: [{ name: "ルーク", description: "騎士" }],
        settings: [
          { name: "王国", category: "世界観", description: "平和な国" },
        ],
      });

      expect(res).toEqual({
        data: {
          characters: [
            {
              category: "未分類",
              description: "騎士",
              name: "ルーク",
              traits: [],
            },
          ],
          foreshadowings: [],
          settings: [
            { category: "世界観", description: "平和な国", name: "王国" },
          ],
          timelines: [],
        },
        novelId: NOVEL_ID,
        proposalType: "bulk",
        summary:
          "設定の一括登録提案（合計2件: 人物1件、設定1件、伏線0件、年表0件）",
        type: "proposal",
      });
    });
  });

  describe("proposeUpdateStoryOutline", () => {
    it("セクション名・本文・モード・理由を指定して提案ペイロードを生成できること", async () => {
      const tools = createProposeTools(createDummyCtx(), NOVEL_ID);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (tools.proposeUpdateStoryOutline as any).execute({
        content: "主人公が勝利する結末。",
        mode: "replace",
        reason: "王道エンド",
        sectionName: "結（結末・エンディング）",
      });

      expect(res).toEqual({
        data: {
          content: "主人公が勝利する結末。",
          mode: "replace",
          reason: "王道エンド",
          sectionName: "結（結末・エンディング）",
        },
        novelId: NOVEL_ID,
        proposalType: "story_outline",
        summary:
          "ストーリー構想「結（結末・エンディング）」の更新提案（王道エンド）",
        type: "proposal",
      });
    });

    it("小説IDが未解決の場合はエラーを返すこと", async () => {
      const tools = createProposeTools(createDummyCtx(), null);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (tools.proposeUpdateStoryOutline as any).execute({
        content: "あらすじテキスト",
        sectionName: "全体あらすじ",
      });

      expect(res).toEqual({ error: "対象の小説が指定されていません。" });
    });
  });
});
