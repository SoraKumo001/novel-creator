import type { InlineAssistAction } from "@novel-creator/llm";
import {
  analyzeSettingImpactOp,
  generateStyleGuideDraftOp,
  inlineAssistOp,
  proofreadContentOp,
} from "./generate/assist-operations.js";
import {
  extractSectionEntitiesOp,
  generateChapterSummaryOp,
  generatePlotOp,
  generateSectionContentOp,
  generateSectionSummaryOp,
} from "./generate/content-operations.js";
import {
  type SectionPromptContext,
  withVariant,
} from "./generate/section-context.js";
import type { ServiceContext } from "./types.js";

export type { SectionPromptContext };
export { withVariant };

export class GenerateDomainService {
  constructor(private readonly ctx: ServiceContext) {}

  async generatePlot(novelId: string, modelConfigId?: string | null) {
    return generatePlotOp(this.ctx, novelId, modelConfigId);
  }

  async generateChapterSummary(chapterId: string) {
    return generateChapterSummaryOp(this.ctx, chapterId);
  }

  async generateSectionSummary(sectionId: string) {
    return generateSectionSummaryOp(this.ctx, sectionId);
  }

  async *generateSectionContent(
    sectionId: string,
    modelConfigId?: string | null
  ): AsyncGenerator<string> {
    yield* generateSectionContentOp(this.ctx, sectionId, modelConfigId);
  }

  async extractEntities(sectionId: string) {
    return extractSectionEntitiesOp(this.ctx, sectionId);
  }

  async proofreadContent(
    sectionId: string,
    customBody?: string,
    modelConfigId?: string | null
  ) {
    return proofreadContentOp(this.ctx, sectionId, customBody, modelConfigId);
  }

  async *inlineAssist(
    sectionId: string,
    input: {
      selectedText: string;
      action: InlineAssistAction;
      customInstruction?: string;
      customPromptId?: string | null;
      surroundingText?: string;
      modelConfigId?: string | null;
      variantCount?: number;
    }
  ): AsyncIterable<{ text: string; variant: number }> {
    yield* inlineAssistOp(this.ctx, sectionId, input);
  }

  async generateStyleGuideDraft(
    novelId: string,
    modelConfigId?: string | null
  ): Promise<string> {
    return generateStyleGuideDraftOp(this.ctx, novelId, modelConfigId);
  }

  async analyzeSettingImpact(
    novelId: string,
    input: {
      changeTarget: "character" | "setting";
      targetName: string;
      beforeValue: string;
      afterValue: string;
      modelConfigId?: string | null;
    }
  ) {
    return analyzeSettingImpactOp(this.ctx, novelId, input);
  }
}
