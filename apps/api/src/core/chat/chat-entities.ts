import { extractChatEntities, generateText } from "@novel-creator/llm";
import type { ServiceContext } from "../types.js";

const EXISTING_OR_NEW_LABEL_PATTERN =
  /[（(【][\s\u3000]*(?:既存|新規|既存キャラ|新規キャラ|既存設定|新規設定|既存情報|新規案|既存人物|新規人物)[\s\u3000]*[）)】]/gi;

function cleanLabel(str?: string): string {
  return (str ?? "").replace(EXISTING_OR_NEW_LABEL_PATTERN, "").trim();
}

interface RawExtractedEntities {
  characters?: {
    name: string;
    category?: string;
    description?: string;
    traits?: string[];
  }[];
  foreshadowings?: {
    title: string;
    description?: string;
    status?: "unresolved" | "resolved" | "abandoned";
  }[];
  plots?: { title: string; summary?: string }[];
  settings?: { name: string; category?: string; description?: string }[];
  timelines?: { event: string; timestamp?: string }[];
}

function parseEntitiesJson(rawResult: string): RawExtractedEntities {
  try {
    const jsonStr = rawResult
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const resultObj: unknown = JSON.parse(jsonStr);
    if (resultObj && typeof resultObj === "object") {
      const obj = resultObj as Record<string, unknown>;
      return {
        characters: Array.isArray(obj["characters"])
          ? (obj["characters"] as RawExtractedEntities["characters"])
          : [],
        foreshadowings: Array.isArray(obj["foreshadowings"])
          ? (obj["foreshadowings"] as RawExtractedEntities["foreshadowings"])
          : [],
        plots: Array.isArray(obj["plots"])
          ? (obj["plots"] as RawExtractedEntities["plots"])
          : [],
        settings: Array.isArray(obj["settings"])
          ? (obj["settings"] as RawExtractedEntities["settings"])
          : [],
        timelines: Array.isArray(obj["timelines"])
          ? (obj["timelines"] as RawExtractedEntities["timelines"])
          : [],
      };
    }
  } catch {
    // パース失敗時は空で継続する
  }
  return {
    characters: [],
    foreshadowings: [],
    plots: [],
    settings: [],
    timelines: [],
  };
}

export async function extractChatEntitiesFromText(
  ctx: ServiceContext,
  text: string
) {
  const prompt = extractChatEntities(text);
  const rawResult = await generateText(ctx.llm, prompt);
  const parsed = parseEntitiesJson(rawResult);

  return {
    characters: (parsed.characters ?? []).map((c) => ({
      category: cleanLabel(c.category),
      description: c.description ?? "",
      name: cleanLabel(c.name),
      traits: c.traits ?? [],
    })),
    foreshadowings: (parsed.foreshadowings ?? []).map((f) => ({
      description: f.description ?? "",
      status:
        f.status === "resolved" || f.status === "abandoned"
          ? f.status
          : "unresolved",
      title: cleanLabel(f.title),
    })),
    plots: (parsed.plots ?? []).map((p) => ({
      summary: p.summary ?? "",
      title: cleanLabel(p.title),
    })),
    settings: (parsed.settings ?? []).map((s) => ({
      category: cleanLabel(s.category),
      description: s.description ?? "",
      name: cleanLabel(s.name),
    })),
    timelines: (parsed.timelines ?? []).map((t) => ({
      event: cleanLabel(t.event),
      timestamp: t.timestamp ?? "",
    })),
  };
}
