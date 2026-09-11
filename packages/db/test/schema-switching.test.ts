import path from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { describe, expect, it } from "vitest";

import { createDb, getSearchPath, schema } from "../src/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("getSearchPath", () => {
  it("クエリパラメータからスキーマ名を取得できること", () => {
    expect(
      getSearchPath("postgres://user:pass@localhost:5432/db?schema=tenant_1")
    ).toBe("tenant_1");
  });

  it("スキーマ指定がない場合は public を返すこと", () => {
    expect(getSearchPath("postgres://user:pass@localhost:5432/db")).toBe(
      "public"
    );
  });

  it("不正な URL の場合は public を返すこと", () => {
    expect(getSearchPath("invalid-connection-string")).toBe("public");
  });
});

describe("PostgreSQL スキーマ切り替え結合テスト", () => {
  const baseConnectionString =
    process.env.DATABASE_URL ?? "postgres://novel:novel@localhost:5433/novel";
  const testSchemaName = "test_switching_schema";
  const tenantConnectionString = `${baseConnectionString}?schema=${testSchemaName}`;

  it("指定スキーマへのマイグレーションとデータの完全分離ができること", async () => {
    const adminPool = new Pool({ connectionString: baseConnectionString });
    let isDbAvailable = false;
    try {
      await adminPool.query("SELECT 1;");
      isDbAvailable = true;
    } catch {
      console.warn(
        "PostgreSQL に接続できないため、結合テストをスキップします。"
      );
    }

    if (!isDbAvailable) {
      await adminPool.end();
      return;
    }

    try {
      // 1. クリーンアップ & スキーマ作成
      await adminPool.query(
        `DROP SCHEMA IF EXISTS "${testSchemaName}" CASCADE;`
      );
      await adminPool.query(`CREATE SCHEMA IF NOT EXISTS "${testSchemaName}";`);

      // 2. マイグレーション実行
      const tenantPool = new Pool({
        connectionString: tenantConnectionString,
        options: `-c search_path=${testSchemaName},public`,
      });
      const tenantDb = drizzle(tenantPool, { schema });
      const migrationsFolder = path.resolve(__dirname, "../drizzle");

      await migrate(tenantDb, {
        migrationsFolder,
        migrationsSchema: testSchemaName,
      });

      // 3. テーブルが testSchemaName に作成されたことを検証
      const tablesResult = await tenantDb.execute(sql`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = ${testSchemaName} AND table_name = 'novels';
      `);
      expect(tablesResult.rows.length).toBe(1);

      // 4. データ挿入
      const inserted = await tenantDb
        .insert(schema.novels)
        .values({
          title: "テナント別小説タイトル",
          description: "スキーマ切り替えテスト用",
        })
        .returning();
      expect(inserted.length).toBe(1);
      expect(inserted[0]?.title).toBe("テナント別小説タイトル");

      // 5. createDb 経由での参照確認
      const appDb = createDb(tenantConnectionString);
      const fetched = await appDb
        .select()
        .from(schema.novels)
        .where(sql`id = ${inserted[0]?.id}`);
      expect(fetched.length).toBe(1);
      expect(fetched[0]?.title).toBe("テナント別小説タイトル");

      // 6. public 側にはデータが存在しないことを確認（完全分離）
      const publicDb = createDb(baseConnectionString);
      const publicFetched = await publicDb
        .select()
        .from(schema.novels)
        .where(sql`id = ${inserted[0]?.id}`);
      expect(publicFetched.length).toBe(0);

      await tenantPool.end();
    } finally {
      // クリーンアップ
      await adminPool.query(
        `DROP SCHEMA IF EXISTS "${testSchemaName}" CASCADE;`
      );
      await adminPool.end();
    }
  });
});
