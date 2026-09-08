CREATE TABLE "mcp_api_keys" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"encrypted_key" text NOT NULL,
	"expires_at" timestamp,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key_hash" text NOT NULL,
	"name" text NOT NULL,
	"novel_id" uuid,
	"prefix" text NOT NULL,
	"revoked_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "mcp_api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
ALTER TABLE "mcp_api_keys" ADD CONSTRAINT "mcp_api_keys_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_api_keys" ADD CONSTRAINT "mcp_api_keys_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mcp_api_keys_novel_id_idx" ON "mcp_api_keys" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "mcp_api_keys_user_id_idx" ON "mcp_api_keys" USING btree ("user_id");