import type { ServiceContext } from './types.js';
import { NovelDomainService } from './novel.service.js';
import { ChapterDomainService } from './chapter.service.js';
import { SectionDomainService } from './section.service.js';
import { ContentDomainService } from './content.service.js';
import { CharacterDomainService } from './character.service.js';
import { SettingDomainService } from './setting.service.js';
import { TimelineDomainService } from './timeline.service.js';
import { LlmInstructionDomainService } from './llm-instruction.service.js';
import { GenerateDomainService } from './generate.service.js';
import { ChatDomainService } from './chat.service.js';
import { BackupDomainService } from './backup.service.js';
import { HistoryDomainService } from './history.service.js';
import { ForeshadowingDomainService } from './foreshadowing.service.js';

export interface DomainServices {
  novel: NovelDomainService;
  chapter: ChapterDomainService;
  section: SectionDomainService;
  content: ContentDomainService;
  character: CharacterDomainService;
  setting: SettingDomainService;
  timeline: TimelineDomainService;
  foreshadowing: ForeshadowingDomainService;
  llmInstruction: LlmInstructionDomainService;
  generate: GenerateDomainService;
  chat: ChatDomainService;
  backup: BackupDomainService;
  history: HistoryDomainService;
}

export function createDomainServices(ctx: ServiceContext): DomainServices {
  return {
    novel: new NovelDomainService(ctx),
    chapter: new ChapterDomainService(ctx),
    section: new SectionDomainService(ctx),
    content: new ContentDomainService(ctx),
    character: new CharacterDomainService(ctx),
    setting: new SettingDomainService(ctx),
    timeline: new TimelineDomainService(ctx),
    foreshadowing: new ForeshadowingDomainService(ctx),
    llmInstruction: new LlmInstructionDomainService(ctx),
    generate: new GenerateDomainService(ctx),
    chat: new ChatDomainService(ctx),
    backup: new BackupDomainService(ctx),
    history: new HistoryDomainService(ctx),
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
    llm: c.var.llm!,
    embedding: c.var.embedding!,
    vectorStore: c.var.vectorStore!,
    env: c.var.env!,
  });
}
