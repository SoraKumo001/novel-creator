import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * better-auth の drizzleAdapter が使用する認証テーブル群。
 * better-auth CLI (`npx @better-auth/cli generate`) の生成形に準拠し、
 * email+password 方式 + 将来の OAuth 受け入れに必要な account / verification まで作成する。
 * パスワードハッシュは better-auth 既定の scrypt を使用する（コード側の設定は不要）。
 */
export const user = pgTable("user", {
  banExpires: timestamp("ban_expires"),
  banReason: text("ban_reason"),
  banned: boolean("banned").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  id: text("id").primaryKey(),
  image: text("image"),
  name: text("name").notNull(),
  role: text("role").notNull().default("user"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  id: text("id").primaryKey(),
  impersonatedBy: text("impersonated_by"),
  ipAddress: text("ip_address"),
  token: text("token").notNull().unique(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  accessToken: text("access_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  accountId: text("account_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  id: text("id").primaryKey(),
  idToken: text("id_token"),
  issuer: text("issuer").notNull(),
  password: text("password"),
  providerId: text("provider_id").notNull(),
  refreshToken: text("refresh_token"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const verification = pgTable("verification", {
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
  value: text("value").notNull(),
});

export type AuthUser = typeof user.$inferSelect;
export type NewAuthUser = typeof user.$inferInsert;
export type AuthSession = typeof session.$inferSelect;
export type AuthAccount = typeof account.$inferSelect;
export type AuthVerification = typeof verification.$inferSelect;
