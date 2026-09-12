import type { Database } from "@novel-creator/db";
import type { Env } from "@novel-creator/shared";
import type { VectorStore } from "@novel-creator/vector";
import type { EmbeddingModel, LanguageModel } from "ai";
import type { AuthUser } from "../context.js";
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
import { IdeaDomainService } from "./idea.service.js";
import { LlmConfigDomainService } from "./llm-config.service.js";
import { LlmInstructionDomainService } from "./llm-instruction.service.js";
import { NovelDomainService } from "./novel.service.js";
import { ReindexDomainService } from "./reindex.service.js";
import { SectionDomainService } from "./section.service.js";
import { SettingDomainService } from "./setting.service.js";
import { TimelineDomainService } from "./timeline.service.js";
import type { McpAuth, ServiceContext } from "./types.js";

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
  idea: IdeaDomainService;
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
    idea: new IdeaDomainService(ctx),
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
 * services はリクエストミドルウェアで生成・注入されることが前提。
 * 未設定の場合は配線ミスのため例外を投げる（on-demand 生成は行わない）。
 * ログインユーザーが存在する場合は、そのユーザーの userId が注入された
 * 専用の DomainServices を生成・キャッシュして返す。
 */
export function getServices(c: {
  get?: (key: string) => unknown;
  set?: (key: string, value: unknown) => void;
  var: {
    db?: Database;
    embedding?: EmbeddingModel;
    env?: Env;
    llm?: LanguageModel;
    mcpAuth?: McpAuth;
    requestServices?: DomainServices;
    services?: DomainServices;
    user?: AuthUser;
    vectorStore?: VectorStore;
  };
}): DomainServices {
  const user =
    c.var.user ?? (c.get ? (c.get("user") as AuthUser | undefined) : undefined);

  if (
    user?.id &&
    c.var.db &&
    c.var.env &&
    c.var.llm &&
    c.var.embedding &&
    c.var.vectorStore
  ) {
    if (c.var.requestServices) {
      return c.var.requestServices;
    }
    const reqServices = createDomainServices({
      db: c.var.db,
      embedding: c.var.embedding,
      env: c.var.env,
      llm: c.var.llm,
      mcpAuth: c.var.mcpAuth,
      userId: user.id,
      vectorStore: c.var.vectorStore,
    });
    if (c.set) {
      c.set("requestServices", reqServices);
    } else {
      c.var.requestServices = reqServices;
    }
    return reqServices;
  }

  const services: DomainServices | undefined = c.var.services;
  if (!services) {
    throw new Error("services is not set on request context");
  }
  return services;
}
