DELETE FROM "mcp_api_keys" WHERE "novel_id" IS NULL;
ALTER TABLE "mcp_api_keys" ALTER COLUMN "novel_id" SET NOT NULL;
