import { z } from "zod";

export const idParamSchema = z.object({
  id: z.uuid(),
});

export const novelIdParamSchema = z.object({
  novelId: z.uuid(),
});

export const chapterIdParamSchema = z.object({
  chapterId: z.uuid(),
});

export const sectionIdParamSchema = z.object({
  sectionId: z.uuid(),
});
