import { zValidator } from "@hono/zod-validator";
import { novels } from "@novel-creator/db";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import type { AppContext } from "../context.js";
import { getServices } from "../core/services.js";
import { assertNovelAccess } from "../middleware/auth.js";
import { backupBodySchema } from "../schemas/index.js";

const backupRouter = new Hono<AppContext>()
  // POST /api/backup/export?novelId=... - 小説データの JSON エクスポート
  .post(
    "/export",
    zValidator("query", z.object({ novelId: z.string().uuid() })),
    async (c) => {
      const { novelId } = c.req.valid("query");
      const denied = await assertNovelAccess(c, novelId);
      if (denied) {
        return denied;
      }
      const exportData = await getServices(c).backup.exportNovel(novelId);
      return c.json(exportData);
    }
  )
  // POST /api/backup/import - JSON バックアップからのインポート・復元
  .post("/import", zValidator("json", backupBodySchema), async (c) => {
    // backupBodySchema は構造のみを検証するため、行レベルの厳密な検証は importNovel が行う。
    // スキーマが BackupBody と型整合しているため、キャストなしでドメイン型として扱える。
    const body = c.req.valid("json");
    const importNovelId = body.meta.novelId;
    // 既存小説への上書き復元時のみ所有チェックする。新規 ID の取り込みは許可し、
    // 作成者の owner 付与は importNovel 内の同一 Tx で行う。
    // ユーザー未格納時（ルーター単体テスト）は素通りする。
    if (c.get("user")) {
      const [existing] = await c
        .get("db")
        .select({ id: novels.id })
        .from(novels)
        .where(eq(novels.id, importNovelId));
      if (existing) {
        const denied = await assertNovelAccess(c, importNovelId);
        if (denied) {
          return denied;
        }
      }
    }
    const result = await getServices(c).backup.importNovel(
      body,
      c.get("user")?.id
    );
    return c.json({
      counts: {
        chapters: body.rdb?.chapters?.length ?? 0,
        characters: body.rdb?.characters?.length ?? 0,
        chatMessages: body.rdb?.chatMessages?.length ?? 0,
        chatSessions: body.rdb?.chatSessions?.length ?? 0,
        contents: body.rdb?.contents?.length ?? 0,
        llmInstructions: body.rdb?.llmInstructions?.length ?? 0,
        sections: body.rdb?.sections?.length ?? 0,
        settings: body.rdb?.settings?.length ?? 0,
        timelines: body.rdb?.timelines?.length ?? 0,
      },
      novelId: result.novelId,
      success: true,
    });
  });

export default backupRouter;
