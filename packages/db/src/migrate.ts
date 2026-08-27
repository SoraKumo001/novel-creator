import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';

async function runMigrate() {
  const connectionString =
    process.env.DATABASE_URL ?? 'postgres://novel:novel@localhost:5433/novel';
  console.log(`[db:migrate] Connecting to ${connectionString}...`);

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  try {
    console.log('[db:migrate] Ensuring edit_histories table exists...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "edit_histories" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "novel_id" uuid NOT NULL,
        "entity_type" text NOT NULL,
        "entity_id" text NOT NULL,
        "title" text DEFAULT '' NOT NULL,
        "content" text NOT NULL,
        "description" text DEFAULT '手動保存' NOT NULL,
        "word_count" integer,
        "created_at" timestamp DEFAULT now() NOT NULL
      );
    `);

    // 外部キー制約の追加（存在しない場合のみ）
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'edit_histories_novel_id_novels_id_fk'
        ) THEN
          ALTER TABLE "edit_histories" 
          ADD CONSTRAINT "edit_histories_novel_id_novels_id_fk" 
          FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;
        END IF;
      END $$;
    `);

    console.log('[db:migrate] Table edit_histories is ready.');
  } catch (err) {
    console.error('[db:migrate] Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

void runMigrate();
