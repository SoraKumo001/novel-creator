CREATE TABLE "consistency_reports" (
	"created_at" timestamp DEFAULT now(),
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" uuid NOT NULL,
	"ok" boolean NOT NULL,
	"target_section_id" uuid,
	"violations" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consistency_reports" ADD CONSTRAINT "consistency_reports_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "consistency_reports_novel_id_idx" ON "consistency_reports" USING btree ("novel_id");