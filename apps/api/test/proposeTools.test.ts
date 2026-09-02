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

  it("createProposeTools は全 9 つの提案ツールを返す", () => {
    const tools = createProposeTools(createDummyCtx(), NOVEL_ID);
    expect(tools.proposeCreateCharacter).toBeDefined();
    expect(tools.proposeCreateSetting).toBeDefined();
    expect(tools.proposeDeleteSetting).toBeDefined();
    expect(tools.proposeDeleteCharacter).toBeDefined();
    expect(tools.proposeAddForeshadowing).toBeDefined();
    expect(tools.proposeAddTimelineEvent).toBeDefined();
    expect(tools.proposeUpdatePlot).toBeDefined();
    expect(tools.proposeUpdateStoryOutline).toBeDefined();
    expect(tools.proposeBulkCreate).toBeDefined();
  });

  describe("proposeCreateSetting", () => {
    it("oldSettingName を指定した場合に置換・削除情報を含む提案ペイロードを生成すること", async () => {
      const tools = createProposeTools(createDummyCtx(), NOVEL_ID);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (tools.proposeCreateSetting as any).execute({
        category: "世界観",
        description: "新たな皇国",
        name: "神聖ルミナス皇国",
        oldSettingName: "ルミナス帝国",
      });

      expect(res).toEqual({
        data: {
          category: "世界観",
          description: "新たな皇国",
          name: "神聖ルミナス皇国",
          oldSettingName: "ルミナス帝国",
        },
        novelId: NOVEL_ID,
        proposalType: "setting",
        summary:
          "世界観設定「神聖ルミナス皇国」(世界観)の登録提案（旧「ルミナス帝国」を削除して置換）",
        type: "proposal",
      });
    });
  });

  describe("proposeDeleteSetting", () => {
    it("設定削除の提案ペイロードを生成できること", async () => {
      const tools = createProposeTools(createDummyCtx(), NOVEL_ID);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (tools.proposeDeleteSetting as any).execute({
        name: "旧帝国",
        reason: "世界観再構築のため",
      });

      expect(res).toEqual({
        data: {
          name: "旧帝国",
          reason: "世界観再構築のため",
        },
        novelId: NOVEL_ID,
        proposalType: "delete_setting",
        summary: "世界観設定「旧帝国」の削除提案（世界観再構築のため）",
        type: "proposal",
      });
    });
  });

  describe("proposeBulkCreate", () => {
    it("複数の人物や設定、および削除リストを含む一括提案ペイロードを生成できること", async () => {
      const tools = createProposeTools(createDummyCtx(), NOVEL_ID);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (tools.proposeBulkCreate as any).execute({
        characters: [{ name: "ルーク", description: "騎士" }],
        deleteSettings: ["旧帝国"],
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
          deleteCharacters: [],
          deleteSettings: ["旧帝国"],
          foreshadowings: [],
          settings: [
            { category: "世界観", description: "平和な国", name: "王国" },
          ],
          timelines: [],
        },
        novelId: NOVEL_ID,
        proposalType: "bulk",
        summary:
          "設定の一括登録提案（合計3件: 人物1件、設定1件、旧設定削除1件）",
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
