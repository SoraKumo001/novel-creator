import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { AppContext } from "../context.js";
import { getServices } from "../core/services.js";
import { assertNovelAccess } from "../middleware/auth.js";
import {
  createNovelSchema,
  idParamSchema,
  updateNovelSchema,
} from "../schemas/index.js";
import { novelAnalysisRouter } from "./novels/analysis.js";
import { novelChaptersRouter } from "./novels/chapters.js";
import { novelCharactersRouter } from "./novels/characters.js";
import { novelForeshadowingsRouter } from "./novels/foreshadowings.js";
import { novelInstructionsRouter } from "./novels/instructions.js";
import { novelMembersRouter } from "./novels/members.js";
import { novelSettingsRouter } from "./novels/settings.js";
import { novelStoryOutlineRouter } from "./novels/storyOutline.js";
import { novelTimelinesRouter } from "./novels/timelines.js";

const novelsRouter = new Hono<AppContext>()
  // GET /api/novels - 一覧取得（本人または admin のみ）
  .get("/", async (c) => {
    const current = c.get("user");
    const rows = await getServices(c).novel.listNovels(
      current?.id,
      current?.role === "admin"
    );
    return c.json(rows);
  })
  // POST /api/novels - 作成（作成者を owner として同一 Tx で付与）
  .post("/", zValidator("json", createNovelSchema), async (c) => {
    const body = c.req.valid("json");
    const row = await getServices(c).novel.createNovel(
      {
        description: body.description ?? null,
        storyOutline: body.storyOutline ?? null,
        styleGuide: body.styleGuide ?? null,
        title: body.title,
      },
      c.get("user")?.id
    );
    return c.json(row, 201);
  })
  // GET /api/novels/:id - 個別取得（関連データ含む）
  .get("/:id", zValidator("param", idParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const denied = await assertNovelAccess(c, id);
    if (denied) {
      return denied;
    }
    const detail = await getServices(c).novel.getNovelDetail(id);
    return c.json({
      ...detail.novel,
      chapters: detail.chapters,
      characters: detail.characters,
      settings: detail.settings,
    });
  })
  // PUT /api/novels/:id - 更新
  .put(
    "/:id",
    zValidator("param", idParamSchema),
    zValidator("json", updateNovelSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const denied = await assertNovelAccess(c, id);
      if (denied) {
        return denied;
      }
      const body = c.req.valid("json");
      const row = await getServices(c).novel.updateNovel(id, body);
      return c.json(row);
    }
  )
  // DELETE /api/novels/:id - 削除
  .delete("/:id", zValidator("param", idParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const denied = await assertNovelAccess(c, id);
    if (denied) {
      return denied;
    }
    await getServices(c).novel.deleteNovel(id);
    return c.json({ success: true });
  })
  // サブルーターのマウント
  .route("/", novelChaptersRouter)
  .route("/", novelCharactersRouter)
  .route("/", novelSettingsRouter)
  .route("/", novelForeshadowingsRouter)
  .route("/", novelTimelinesRouter)
  .route("/", novelInstructionsRouter)
  .route("/", novelAnalysisRouter)
  .route("/", novelStoryOutlineRouter)
  .route("/", novelMembersRouter);

export default novelsRouter;
