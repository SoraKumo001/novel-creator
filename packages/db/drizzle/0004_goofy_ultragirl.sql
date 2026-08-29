CREATE TABLE "foreshadowings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'unresolved' NOT NULL,
	"placed_section_id" uuid,
	"resolved_section_id" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "parts" jsonb;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD COLUMN "permission_mode" text DEFAULT 'consult' NOT NULL;--> statement-breakpoint
ALTER TABLE "foreshadowings" ADD CONSTRAINT "foreshadowings_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foreshadowings" ADD CONSTRAINT "foreshadowings_placed_section_id_sections_id_fk" FOREIGN KEY ("placed_section_id") REFERENCES "public"."sections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foreshadowings" ADD CONSTRAINT "foreshadowings_resolved_section_id_sections_id_fk" FOREIGN KEY ("resolved_section_id") REFERENCES "public"."sections"("id") ON DELETE set null ON UPDATE no action;