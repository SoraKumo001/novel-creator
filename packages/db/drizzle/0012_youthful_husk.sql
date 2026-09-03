ALTER TABLE "embedding_configs" ALTER COLUMN "dimensions" SET DEFAULT 3072;--> statement-breakpoint
CREATE INDEX "chapters_novel_id_idx" ON "chapters" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "sections_chapter_id_idx" ON "sections" USING btree ("chapter_id");--> statement-breakpoint
CREATE INDEX "characters_novel_id_idx" ON "characters" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "settings_novel_id_idx" ON "settings" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "timelines_novel_id_idx" ON "timelines" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "timelines_section_id_idx" ON "timelines" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "llm_instructions_novel_id_idx" ON "llm_instructions" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "chat_messages_session_id_idx" ON "chat_messages" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "chat_sessions_novel_id_idx" ON "chat_sessions" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "edit_histories_novel_id_idx" ON "edit_histories" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "foreshadowings_novel_id_idx" ON "foreshadowings" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "foreshadowings_placed_section_id_idx" ON "foreshadowings" USING btree ("placed_section_id");--> statement-breakpoint
CREATE INDEX "foreshadowings_resolved_section_id_idx" ON "foreshadowings" USING btree ("resolved_section_id");--> statement-breakpoint
CREATE INDEX "analysis_results_novel_id_idx" ON "analysis_results" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "custom_prompts_novel_id_idx" ON "custom_prompts" USING btree ("novel_id");