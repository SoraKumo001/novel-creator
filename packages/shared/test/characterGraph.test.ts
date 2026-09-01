import { describe, expect, it } from "vitest";
import {
  type CharacterGraphNode,
  generateCharacterMermaidGraph,
} from "../src/characterGraph.js";

describe("characterGraph", () => {
  it("空のリストの場合は空メッセージのグラフが返ること", () => {
    const output = generateCharacterMermaidGraph([]);
    expect(output).toContain("graph LR");
    expect(output).toContain("empty");
  });

  it("カテゴリと関係性から Mermaid グラフが生成されること", () => {
    const characters: CharacterGraphNode[] = [
      {
        category: "勇者パーティ",
        id: "1",
        name: "主人公",
        relationships: "ヒロイン: 信頼\nライバル: 敵対",
      },
      {
        category: "勇者パーティ",
        id: "2",
        name: "ヒロイン",
        relationships: "主人公: 好意",
      },
      {
        category: "帝国軍",
        id: "3",
        name: "ライバル",
        relationships: "主人公: 宿敵",
      },
    ];

    const output = generateCharacterMermaidGraph(characters);
    expect(output).toContain("graph LR");
    expect(output).toContain('subgraph sub_0["勇者パーティ"]');
    expect(output).toContain('subgraph sub_1["帝国軍"]');
    expect(output).toContain("主人公");
    expect(output).toContain("ヒロイン");
    expect(output).toContain("ライバル");
    expect(output).toContain("信頼");
    expect(output).toContain("敵対");
  });
});
