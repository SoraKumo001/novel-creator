import {
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { novels } from "./novels.js";

/**
 * 小説へのメンバシップ（所有・共有管理）。
 * 初版の権限判定は owner-or-admin の二値に簡素化する（viewer/editor の分岐は後回し）。
 * 既存テーブルへの user_id 追加は行わず、この関連テーブルで所有関係を表現する。
 */
export const NOVEL_MEMBER_ROLES = ["owner", "editor", "viewer"] as const;
export type NovelMemberRole = (typeof NOVEL_MEMBER_ROLES)[number];

export const novelMembers = pgTable(
  "novel_members",
  {
    createdAt: timestamp("created_at").notNull().defaultNow(),
    id: uuid("id").primaryKey().defaultRandom(),
    novelId: uuid("novel_id")
      .notNull()
      .references(() => novels.id, { onDelete: "cascade" }),
    role: text("role", { enum: [...NOVEL_MEMBER_ROLES] })
      .notNull()
      .default("owner"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [
    unique("novel_members_novel_user_unique").on(t.novelId, t.userId),
    index("novel_members_novel_id_idx").on(t.novelId),
    index("novel_members_user_id_idx").on(t.userId),
  ]
);

export type NovelMember = typeof novelMembers.$inferSelect;
export type NewNovelMember = typeof novelMembers.$inferInsert;
