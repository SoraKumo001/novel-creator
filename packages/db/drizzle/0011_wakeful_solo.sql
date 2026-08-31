CREATE TABLE "custom_prompts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"icon" text DEFAULT '🪄',
	"category" text DEFAULT 'inline' NOT NULL,
	"system_prompt" text,
	"user_prompt" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "custom_prompts" ADD CONSTRAINT "custom_prompts_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;