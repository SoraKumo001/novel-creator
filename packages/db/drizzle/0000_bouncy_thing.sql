CREATE TABLE "analysis_results" (
	"analysis_type" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" uuid NOT NULL,
	"result" jsonb NOT NULL,
	"target_chapter_id" uuid,
	"target_section_id" uuid
);
--> statement-breakpoint
CREATE TABLE "account" (
	"access_token" text,
	"access_token_expires_at" timestamp,
	"account_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"id_token" text,
	"issuer" text NOT NULL,
	"password" text,
	"provider_id" text NOT NULL,
	"refresh_token" text,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"impersonated_by" text,
	"ip_address" text,
	"token" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"ban_expires" timestamp,
	"ban_reason" text,
	"banned" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"image" text,
	"name" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chapters" (
	"created_at" timestamp DEFAULT now(),
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" uuid NOT NULL,
	"order" integer NOT NULL,
	"summary" text,
	"title" text NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "characters" (
	"category" text DEFAULT '未分類' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"description" text,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"novel_id" uuid NOT NULL,
	"relationships" jsonb,
	"traits" jsonb,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parts" jsonb,
	"role" text NOT NULL,
	"session_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_sessions" (
	"created_at" timestamp DEFAULT now(),
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" uuid,
	"permission_mode" text DEFAULT 'consult' NOT NULL,
	"title" text DEFAULT '新しい相談' NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contents" (
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_id" uuid NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"word_count" integer,
	CONSTRAINT "contents_section_id_unique" UNIQUE("section_id")
);
--> statement-breakpoint
CREATE TABLE "custom_prompts" (
	"category" text DEFAULT 'inline' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"description" text,
	"icon" text DEFAULT '🪄',
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"novel_id" uuid,
	"order" integer DEFAULT 0 NOT NULL,
	"system_prompt" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_prompt" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edit_histories" (
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"description" text DEFAULT '手動保存' NOT NULL,
	"entity_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" uuid NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"word_count" integer
);
--> statement-breakpoint
CREATE TABLE "embedding_configs" (
	"api_key" text,
	"base_url" text,
	"created_at" timestamp DEFAULT now(),
	"description" text,
	"dimensions" integer DEFAULT 3072 NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"model_id" text NOT NULL,
	"name" text NOT NULL,
	"provider" text NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "foreshadowings" (
	"category" text DEFAULT '未分類' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"description" text,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" uuid NOT NULL,
	"placed_section_id" uuid,
	"resolved_section_id" uuid,
	"status" text DEFAULT 'unresolved' NOT NULL,
	"title" text NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ideas" (
	"body" text,
	"created_at" timestamp DEFAULT now(),
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" uuid NOT NULL,
	"source" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"title" text NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "llm_configs" (
	"api_key" text,
	"base_url" text,
	"created_at" timestamp DEFAULT now(),
	"description" text,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"model_id" text NOT NULL,
	"name" text NOT NULL,
	"provider" text NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "llm_instructions" (
	"created_at" timestamp DEFAULT now(),
	"entity_type" text NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instruction" text NOT NULL,
	"novel_id" uuid NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "novel_members" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" uuid NOT NULL,
	"role" text DEFAULT 'owner' NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "novel_members_novel_user_unique" UNIQUE("novel_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "novels" (
	"created_at" timestamp DEFAULT now(),
	"description" text,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_outline" text,
	"style_guide" text,
	"title" text NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sections" (
	"chapter_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order" integer NOT NULL,
	"summary" text,
	"title" text,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"category" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"description" text,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"metadata" jsonb,
	"name" text NOT NULL,
	"novel_id" uuid NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "timelines" (
	"created_at" timestamp DEFAULT now(),
	"event" text NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" uuid NOT NULL,
	"order" integer NOT NULL,
	"section_id" uuid,
	"timestamp" text
);
--> statement-breakpoint
ALTER TABLE "analysis_results" ADD CONSTRAINT "analysis_results_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_prompts" ADD CONSTRAINT "custom_prompts_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edit_histories" ADD CONSTRAINT "edit_histories_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foreshadowings" ADD CONSTRAINT "foreshadowings_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foreshadowings" ADD CONSTRAINT "foreshadowings_placed_section_id_sections_id_fk" FOREIGN KEY ("placed_section_id") REFERENCES "public"."sections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foreshadowings" ADD CONSTRAINT "foreshadowings_resolved_section_id_sections_id_fk" FOREIGN KEY ("resolved_section_id") REFERENCES "public"."sections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_instructions" ADD CONSTRAINT "llm_instructions_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_api_keys" ADD CONSTRAINT "mcp_api_keys_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_api_keys" ADD CONSTRAINT "mcp_api_keys_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "novel_members" ADD CONSTRAINT "novel_members_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "novel_members" ADD CONSTRAINT "novel_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timelines" ADD CONSTRAINT "timelines_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timelines" ADD CONSTRAINT "timelines_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analysis_results_novel_id_idx" ON "analysis_results" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "chapters_novel_id_idx" ON "chapters" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "characters_novel_id_idx" ON "characters" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "chat_messages_session_id_idx" ON "chat_messages" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "chat_messages_session_created_idx" ON "chat_messages" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "chat_sessions_novel_id_idx" ON "chat_sessions" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "custom_prompts_novel_id_idx" ON "custom_prompts" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "edit_histories_novel_id_idx" ON "edit_histories" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "edit_histories_entity_created_idx" ON "edit_histories" USING btree ("novel_id","entity_type","entity_id","created_at" desc);--> statement-breakpoint
CREATE INDEX "foreshadowings_novel_id_idx" ON "foreshadowings" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "foreshadowings_placed_section_id_idx" ON "foreshadowings" USING btree ("placed_section_id");--> statement-breakpoint
CREATE INDEX "foreshadowings_resolved_section_id_idx" ON "foreshadowings" USING btree ("resolved_section_id");--> statement-breakpoint
CREATE INDEX "ideas_novel_id_idx" ON "ideas" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "llm_instructions_novel_id_idx" ON "llm_instructions" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "mcp_api_keys_novel_id_idx" ON "mcp_api_keys" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "mcp_api_keys_user_id_idx" ON "mcp_api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "novel_members_novel_id_idx" ON "novel_members" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "novel_members_user_id_idx" ON "novel_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sections_chapter_id_idx" ON "sections" USING btree ("chapter_id");--> statement-breakpoint
CREATE INDEX "settings_novel_id_idx" ON "settings" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "timelines_novel_id_idx" ON "timelines" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "timelines_section_id_idx" ON "timelines" USING btree ("section_id");