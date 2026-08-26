import { createClient } from '@connectrpc/connect';
import { createConnectTransport } from '@connectrpc/connect-web';
import {
  BackupService,
  ChapterService,
  CharacterService,
  ChatService,
  ContentService,
  GenerateService,
  LlmInstructionService,
  NovelService,
  SectionService,
  SettingService,
  TimelineService,
} from '@novel-creator/proto';

const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

export const transport = createConnectTransport({
  baseUrl,
});

export const novelClient = createClient(NovelService, transport);
export const chapterClient = createClient(ChapterService, transport);
export const sectionClient = createClient(SectionService, transport);
export const contentClient = createClient(ContentService, transport);
export const characterClient = createClient(CharacterService, transport);
export const settingClient = createClient(SettingService, transport);
export const timelineClient = createClient(TimelineService, transport);
export const llmInstructionClient = createClient(LlmInstructionService, transport);
export const generateClient = createClient(GenerateService, transport);
export const chatClient = createClient(ChatService, transport);
export const backupClient = createClient(BackupService, transport);
