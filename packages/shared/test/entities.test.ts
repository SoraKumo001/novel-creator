import { describe, expect, it } from "vitest";
import { characterSchema } from "../src/schemas/entities.js";

describe("entities schemas", () => {
  it("Character.traits は null と string[] の両方を受け付けること", () => {
    const withNull = characterSchema.parse({
      category: "主要人物",
      createdAt: null,
      description: null,
      id: "ch1",
      name: "主人公",
      novelId: "n1",
      relationships: null,
      traits: null,
      updatedAt: null,
    });
    const withArray = characterSchema.parse({
      category: "主要人物",
      createdAt: null,
      description: null,
      id: "ch1",
      name: "主人公",
      novelId: "n1",
      relationships: null,
      traits: ["勇敢", "冷静"],
      updatedAt: null,
    });
    expect(withNull.traits).toBeNull();
    expect(withArray.traits).toEqual(["勇敢", "冷静"]);
  });

  it("Character.relationships は文字列とオブジェクトの両方を受け付けること", () => {
    const asString = characterSchema.parse({
      category: "主要人物",
      createdAt: null,
      description: null,
      id: "ch1",
      name: "主人公",
      novelId: "n1",
      relationships: "ヒロインの幼馴染。",
      traits: null,
      updatedAt: null,
    });
    const asObject = characterSchema.parse({
      category: "主要人物",
      createdAt: null,
      description: null,
      id: "ch1",
      name: "主人公",
      novelId: "n1",
      relationships: { hero: "主人公", heroine: "ヒロイン" },
      traits: null,
      updatedAt: null,
    });
    expect(asString.relationships).toBe("ヒロインの幼馴染。");
    expect(asObject.relationships).toEqual({
      hero: "主人公",
      heroine: "ヒロイン",
    });
  });
});
