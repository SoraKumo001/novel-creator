import { z } from "zod";

export const checkGlossaryBodySchema = z.object({
  modelConfigId: z.string().uuid().optional().nullable(),
  sectionId: z.string().uuid(),
});

export const consistencyReportParamsSchema = z.object({
  id: z.uuid(),
  reportId: z.uuid(),
});

export const novelGlossaryEntryParamsSchema = z.object({
  entryId: z.uuid(),
  id: z.uuid(),
});
