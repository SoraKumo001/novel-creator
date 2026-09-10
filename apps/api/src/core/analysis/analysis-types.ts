export type AnalysisStreamEvent =
  | { current: number; stage: string; total: number; type: "progress" }
  | { result: unknown; savedId: string; type: "complete" }
  | { message: string; type: "error" };

export interface PersonaReviewInput {
  chapterId?: string;
  customBody?: string;
  modelConfigId?: string | null;
  sectionId?: string;
}
