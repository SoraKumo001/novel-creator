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
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ideas_novel_id_idx" ON "ideas" USING btree ("novel_id");