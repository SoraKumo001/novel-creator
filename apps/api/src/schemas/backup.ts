import type {
  NewChapter,
  NewCharacter,
  NewChatMessage,
  NewChatSession,
  NewContent,
  NewLlmInstruction,
  NewNovel,
  NewSection,
  NewSetting,
  NewTimeline,
} from "@novel-creator/db";
import { z } from "zod";

// ---- バックアップ ----
// バックアップの構造を緩く検証する。行レベルの厳密な検証は importNovel が行うため、
// ここでは rdb.novel の存在と各テーブルの配列形状のみを保証する。
// ワイヤ上の行は任意の JSON オブジェクトのため、ドメイン型（New* 行）へは
// 型ガード（z.custom）で復元する。検証の緩さ（wire format）は従来どおり。
const isRecordObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export const backupBodySchema = z.object({
  meta: z.object({
    exportedAt: z.string().optional(),
    novelId: z.string(),
    novelTitle: z.string().optional(),
    version: z.number(),
  }),
  rdb: z.object({
    chapters: z.custom<NewChapter[]>(Array.isArray).optional(),
    characters: z.custom<NewCharacter[]>(Array.isArray).optional(),
    chatMessages: z.custom<NewChatMessage[]>(Array.isArray).optional(),
    chatSessions: z.custom<NewChatSession[]>(Array.isArray).optional(),
    contents: z.custom<NewContent[]>(Array.isArray).optional(),
    llmInstructions: z.custom<NewLlmInstruction[]>(Array.isArray).optional(),
    novel: z.custom<NewNovel>(isRecordObject),
    sections: z.custom<NewSection[]>(Array.isArray).optional(),
    settings: z.custom<NewSetting[]>(Array.isArray).optional(),
    timelines: z.custom<NewTimeline[]>(Array.isArray).optional(),
  }),
});
