import {
  streamCheckVoiceOp,
  streamPersonaReviewOp,
  streamStoryArcOp,
} from "./analysis/analysis-operations.js";
import { deleteResultOp, listResultsOp } from "./analysis/analysis-results.js";
import type {
  AnalysisStreamEvent,
  PersonaReviewInput,
} from "./analysis/analysis-types.js";
import {
  deleteConsistencyReportOp,
  listConsistencyReportsOp,
  streamCheckGlossaryOp,
} from "./consistency/consistency-operations.js";
import type { ServiceContext } from "./types.js";

export type { AnalysisStreamEvent, PersonaReviewInput };

export class AnalysisDomainService {
  constructor(private readonly ctx: ServiceContext) {}

  async *streamStoryArc(
    novelId: string,
    modelConfigId?: string | null
  ): AsyncGenerator<AnalysisStreamEvent, void, undefined> {
    yield* streamStoryArcOp(this.ctx, novelId, modelConfigId);
  }

  async *streamCheckVoice(
    novelId: string,
    sectionId?: string,
    customBody?: string,
    modelConfigId?: string | null
  ): AsyncGenerator<AnalysisStreamEvent, void, undefined> {
    yield* streamCheckVoiceOp(
      this.ctx,
      novelId,
      sectionId,
      customBody,
      modelConfigId
    );
  }

  async *streamPersonaReview(
    novelId: string,
    input: PersonaReviewInput
  ): AsyncGenerator<AnalysisStreamEvent, void, undefined> {
    yield* streamPersonaReviewOp(this.ctx, novelId, input);
  }

  async *streamCheckGlossary(
    novelId: string,
    sectionId: string
  ): AsyncGenerator<AnalysisStreamEvent, void, undefined> {
    yield* streamCheckGlossaryOp(this.ctx, novelId, sectionId);
  }

  async listConsistencyReports(novelId: string) {
    return listConsistencyReportsOp(this.ctx, novelId);
  }

  async deleteConsistencyReport(novelId: string, reportId: string) {
    return deleteConsistencyReportOp(this.ctx, novelId, reportId);
  }

  async listResults(
    novelId: string,
    analysisType?: "story-arc" | "check-voice" | "persona-review"
  ) {
    return listResultsOp(this.ctx, novelId, analysisType);
  }

  async deleteResult(novelId: string, resultId: string) {
    return deleteResultOp(this.ctx, novelId, resultId);
  }
}
