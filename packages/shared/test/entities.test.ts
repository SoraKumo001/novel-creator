import { describe, expect, it } from "vitest";
import {
  chapterSchema,
  characterSchema,
  chatMessageSchema,
  chatSessionSchema,
  contentSchema,
  foreshadowingSchema,
  foreshadowingStatusSchema,
  llmInstructionSchema,
  novelSchema,
  sectionSchema,
  settingSchema,
  timelineSchema,
} from "../src/schemas/entities.js";

describe("entities schemas", () => {
  it("Novel の完全なオブジェクトをパースできること", () => {
    const result = novelSchema.parse({
      createdAt: "2026-01-01T00:00:00.000Z",
      description: "説明",
      id: "n1",
      title: "タイトル",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
    expect(result.title).toBe("タイトル");
  });

  it("Novel.description は null を受け付けること", () => {
    const result = novelSchema.parse({
      createdAt: null,
      description: null,
      id: "n1",
      title: "タイトル",
      updatedAt: null,
    });
    expect(result.description).toBeNull();
  });

  it("Chapter / Section / Content の完全なオブジェクトをパースできること", () => {
    const chapter = chapterSchema.parse({
      createdAt: null,
      id: "c1",
      novelId: "n1",
      order: 1,
      summary: null,
      title: "第一章",
      updatedAt: null,
    });
    const section = sectionSchema.parse({
      chapterId: "c1",
      createdAt: null,
      id: "s1",
      order: 1,
      summary: "要約",
      title: null,
      updatedAt: null,
    });
    const content = contentSchema.parse({
      body: "本文",
      createdAt: null,
      id: "ct1",
      sectionId: "s1",
      updatedAt: null,
      wordCount: 100,
    });
    expect(chapter.order).toBe(1);
    expect(section.title).toBeNull();
    expect(content.wordCount).toBe(100);
  });

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

  it("Setting / Timeline / Foreshadowing / LlmInstruction の完全なオブジェクトをパースできること", () => {
    const setting = settingSchema.parse({
      category: "世界観",
      createdAt: null,
      description: null,
      id: "st1",
      metadata: { type: "magic" },
      name: "魔法体系",
      novelId: "n1",
      updatedAt: null,
    });
    const timeline = timelineSchema.parse({
      createdAt: null,
      event: "事件",
      id: "t1",
      novelId: "n1",
      order: 1,
      sectionId: null,
      timestamp: null,
    });
    const foreshadowing = foreshadowingSchema.parse({
      createdAt: null,
      description: null,
      id: "f1",
      novelId: "n1",
      placedSectionId: null,
      resolvedSectionId: null,
      status: "unresolved",
      title: "伏線",
      updatedAt: null,
    });
    const llm = llmInstructionSchema.parse({
      createdAt: null,
      entityType: "character",
      id: "l1",
      instruction: "指示",
      novelId: "n1",
    });
    expect(setting.metadata).toEqual({ type: "magic" });
    expect(timeline.event).toBe("事件");
    expect(foreshadowing.status).toBe("unresolved");
    expect(llm.entityType).toBe("character");
  });

  it("Timeline は updatedAt を持たない（updatedAt なしでパースできる）こと", () => {
    const result = timelineSchema.parse({
      createdAt: null,
      event: "事件",
      id: "t1",
      novelId: "n1",
      order: 1,
      sectionId: null,
      timestamp: null,
    });
    expect(result).not.toHaveProperty("updatedAt");
  });

  it("foreshadowingStatusSchema は 3 値をすべて受け付けること", () => {
    expect(foreshadowingStatusSchema.parse("unresolved")).toBe("unresolved");
    expect(foreshadowingStatusSchema.parse("resolved")).toBe("resolved");
    expect(foreshadowingStatusSchema.parse("abandoned")).toBe("abandoned");
  });

  it("foreshadowingStatusSchema は不正な値を拒否すること", () => {
    expect(() => foreshadowingStatusSchema.parse("invalid")).toThrow();
  });

  it("ChatSession の完全なオブジェクトをパースできること", () => {
    const result = chatSessionSchema.parse({
      createdAt: null,
      id: "cs1",
      novelId: null,
      title: "セッション",
      updatedAt: null,
    });
    expect(result.title).toBe("セッション");
  });

  it("ChatMessage は user / assistant ロールを受け付けること", () => {
    const user = chatMessageSchema.parse({
      content: "こんにちは",
      createdAt: null,
      id: "m1",
      role: "user",
      sessionId: "cs1",
    });
    const assistant = chatMessageSchema.parse({
      content: "こんにちは",
      createdAt: null,
      id: "m2",
      role: "assistant",
      sessionId: "cs1",
    });
    expect(user.role).toBe("user");
    expect(assistant.role).toBe("assistant");
  });

  it("ChatMessage は system ロールを拒否すること", () => {
    expect(() =>
      chatMessageSchema.parse({
        content: "システム",
        createdAt: null,
        id: "m1",
        role: "system",
        sessionId: "cs1",
      })
    ).toThrow();
  });
});
