CREATE TABLE "glossary_entries" (
	"aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"category" text DEFAULT '未分類' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"description" text,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" uuid NOT NULL,
	"reading" text,
	"term" text NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "glossary_entries" ADD CONSTRAINT "glossary_entries_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "glossary_entries_novel_id_idx" ON "glossary_entries" USING btree ("novel_id");