import { appendNote } from "../src/components/chat/entity-insert/saveEntities.js";
import {
  toEditableCharacter,
  toEditableForeshadowing,
  toEditablePlot,
  toEditableSetting,
  toEditableTimeline,
} from "../src/components/chat/entity-insert/toEditable.js";

describe("entity-insert collection helpers", () => {
  describe("toEditable*（LLM 抽出結果 → 編集可能アイテム変換）", () => {
    it("toEditableCharacter は traits を traitsString に展開し、ID とアクションを付与すること", () => {
      const item = toEditableCharacter(
        {
          name: "アリス",
          category: "主人公",
          description: "勇敢な少女",
          traits: ["金髪", "剣士"],
        },
        2
      );
      expect(item.name).toBe("アリス");
      expect(item.traitsString).toBe("金髪, 剣士");
      expect(item._selected).toBe(true);
      expect(item.action).toBe("create");
      expect(item._id).toMatch(/^char-\d+-2$/);
    });

    it("toEditableCharacter は traits が配列でない場合 traitsString を空にすること", () => {
      const item = toEditableCharacter(
        {
          name: "ボブ",
          category: "脇役",
          description: "",
          traits: undefined as unknown as string[],
        },
        0
      );
      expect(item.traitsString).toBe("");
    });

    it("toEditableSetting / toEditableForeshadowing / toEditableTimeline / toEditablePlot は共通メタを付与すること", () => {
      const setting = toEditableSetting(
        { name: "魔法王国", category: "世界観" },
        0
      );
      expect(setting._id).toMatch(/^set-\d+-0$/);
      expect(setting._selected).toBe(true);
      expect(setting.action).toBe("create");

      const fore = toEditableForeshadowing(
        { title: "父の失踪", description: "", status: "unresolved" },
        1
      );
      expect(fore._id).toMatch(/^fore-\d+-1$/);
      expect(fore.action).toBe("create");

      const timeline = toEditableTimeline({ event: "ギルド入会" }, 3);
      expect(timeline._id).toMatch(/^time-\d+-3$/);
      expect(timeline.action).toBe("create");

      const plot = toEditablePlot({ title: "第1話", summary: "プロローグ" }, 4);
      expect(plot._id).toMatch(/^plot-\d+-4$/);
      expect(plot.action).toBe("create");
    });
  });

  describe("appendNote（merge 時の追記フォーマット）", () => {
    it("既存テキストがある場合は「既存 + 【追記】 + 新規」を組み立てること", () => {
      expect(appendNote("既存の説明", "追記内容")).toBe(
        "既存の説明\n\n【追記】\n追記内容"
      );
    });

    it("既存テキストが空の場合は新規テキストのみを返すこと", () => {
      expect(appendNote("", "追記内容")).toBe("追記内容");
      expect(appendNote("   ", "追記内容")).toBe("追記内容");
    });

    it("新規テキストの前後の空白を除去すること", () => {
      expect(appendNote("既存", "  追記  ")).toBe("既存\n\n【追記】\n追記");
    });
  });
});
