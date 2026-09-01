import { AnalysisDomainService } from "./analysis.service.js";
import { BackupDomainService } from "./backup.service.js";
import { ChapterDomainService } from "./chapter.service.js";
import { CharacterDomainService } from "./character.service.js";
import { ChatDomainService } from "./chat.service.js";
import { ContentDomainService } from "./content.service.js";
import { CustomPromptDomainService } from "./custom-prompt.service.js";
import { EmbeddingConfigDomainService } from "./embedding-config.service.js";
import { ForeshadowingDomainService } from "./foreshadowing.service.js";
import { GenerateDomainService } from "./generate.service.js";
import { HistoryDomainService } from "./history.service.js";
import { LlmConfigDomainService } from "./llm-config.service.js";
import { LlmInstructionDomainService } from "./llm-instruction.service.js";
import { NovelDomainService } from "./novel.service.js";
import { ReindexDomainService } from "./reindex.service.js";
import { SectionDomainService } from "./section.service.js";
import { SettingDomainService } from "./setting.service.js";
import { TimelineDomainService } from "./timeline.service.js";
import type { ServiceContext } from "./types.js";

export interface DomainServices {
  analysis: AnalysisDomainService;
  backup: BackupDomainService;
  chapter: ChapterDomainService;
  character: CharacterDomainService;
  chat: ChatDomainService;
  content: ContentDomainService;
  customPrompt: CustomPromptDomainService;
  embeddingConfig: EmbeddingConfigDomainService;
  foreshadowing: ForeshadowingDomainService;
  generate: GenerateDomainService;
  history: HistoryDomainService;
  llmConfig: LlmConfigDomainService;
  llmInstruction: LlmInstructionDomainService;
  novel: NovelDomainService;
  reindex: ReindexDomainService;
  section: SectionDomainService;
  setting: SettingDomainService;
  timeline: TimelineDomainService;
}

export function createDomainServices(ctx: ServiceContext): DomainServices {
  return {
    analysis: new AnalysisDomainService(ctx),
    backup: new BackupDomainService(ctx),
    chapter: new ChapterDomainService(ctx),
    character: new CharacterDomainService(ctx),
    chat: new ChatDomainService(ctx),
    content: new ContentDomainService(ctx),
    customPrompt: new CustomPromptDomainService(ctx),
    embeddingConfig: new EmbeddingConfigDomainService(ctx),
    foreshadowing: new ForeshadowingDomainService(ctx),
    generate: new GenerateDomainService(ctx),
    history: new HistoryDomainService(ctx),
    llmConfig: new LlmConfigDomainService(ctx),
    llmInstruction: new LlmInstructionDomainService(ctx),
    novel: new NovelDomainService(ctx),
    reindex: new ReindexDomainService(ctx),
    section: new SectionDomainService(ctx),
    setting: new SettingDomainService(ctx),
    timeline: new TimelineDomainService(ctx),
  };
}

/**
 * Hono コンテキストから DomainServices を取得する。
 * c.var.services が未設定の場合は on-demand で生成する。
 */
export function getServices(c: {
  var: Partial<ServiceContext & { services?: DomainServices }>;
}): DomainServices {
  if (c.var.services) {
    return c.var.services;
  }
  return createDomainServices({
    db: c.var.db!,
    embedding: c.var.embedding!,
    env: c.var.env!,
    llm: c.var.llm!,
    vectorStore: c.var.vectorStore!,
  });
}
