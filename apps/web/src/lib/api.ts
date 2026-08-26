import type {
  ApiSuccessResponse,
  Character,
  Chapter,
  ChapterWithSections,
  ChatMessageItem,
  ChatSession,
  ChatSessionDetail,
  Content,
  CreateChapterInput,
  CreateCharacterInput,
  CreateChatSessionInput,
  CreateLlmInstructionInput,
  CreateNovelInput,
  CreateSectionInput,
  CreateSettingInput,
  CreateTimelineInput,
  EditCharacterSectionResult,
  EditInstructionInput,
  EditSettingSectionResult,
  ExtractResult,
  ExtractedChatEntities,
  GeneratedPlot,
  GeneratedSummary,
  ImportResult,
  LlmInstruction,
  Novel,
  NovelDetail,
  Section,
  SectionWithContent,
  Setting,
  SettingDraft,
  SettingDraftInput,
  SaveSettingsMarkdownResult,
  SaveCharactersMarkdownResult,
  Timeline,
  UpdateChapterInput,
  UpdateCharacterInput,
  UpdateChatSessionInput,
  UpdateContentInput,
  UpdateNovelInput,
  UpdateSectionInput,
  UpdateSettingInput,
} from './types.js';

import {
  backupClient,
  chapterClient,
  characterClient,
  chatClient,
  contentClient,
  generateClient,
  llmInstructionClient,
  novelClient,
  sectionClient,
  settingClient,
  timelineClient,
} from './grpc-client.js';

// 各メソッドが受け取る引数を厳密に定義する。
export type ApiClient = {
  api: {
    novels: {
      $get: () => Promise<{ json: () => Promise<Novel[]> }>;
      $post: (args: { json: CreateNovelInput }) => Promise<{ json: () => Promise<Novel> }>;
      ':id': {
        $get: (args: { param: { id: string } }) => Promise<{ json: () => Promise<NovelDetail> }>;
        $put: (args: {
          param: { id: string };
          json: UpdateNovelInput;
        }) => Promise<{ json: () => Promise<Novel> }>;
        $delete: (args: {
          param: { id: string };
        }) => Promise<{ json: () => Promise<ApiSuccessResponse> }>;
        chapters: {
          $get: (args: { param: { id: string } }) => Promise<{ json: () => Promise<Chapter[]> }>;
          $post: (args: {
            param: { id: string };
            json: CreateChapterInput;
          }) => Promise<{ json: () => Promise<Chapter> }>;
        };
        characters: {
          $get: (args: { param: { id: string } }) => Promise<{ json: () => Promise<Character[]> }>;
          $post: (args: {
            param: { id: string };
            json: CreateCharacterInput;
          }) => Promise<{ json: () => Promise<Character> }>;
          markdown: {
            $get: (args: {
              param: { id: string };
            }) => Promise<{ json: () => Promise<{ markdown: string }> }>;
            $put: (args: {
              param: { id: string };
              json: { markdown: string };
            }) => Promise<{ json: () => Promise<SaveCharactersMarkdownResult> }>;
          };
          editSection: {
            $post: (args: {
              param: { id: string };
              json: {
                category: string;
                name: string;
                description: string;
                traits: string[];
                relationships: string;
                instruction: string;
              };
            }) => Promise<{ json: () => Promise<EditCharacterSectionResult> }>;
          };
          editDocument: {
            $post: (args: {
              param: { id: string };
              json: { markdown: string; instruction: string };
            }) => Promise<{ json: () => Promise<EditCharacterSectionResult> }>;
          };
        };
        settings: {
          $get: (args: {
            param: { id: string };
            query?: { category?: string };
          }) => Promise<{ json: () => Promise<Setting[]> }>;
          $post: (args: {
            param: { id: string };
            json: CreateSettingInput;
          }) => Promise<{ json: () => Promise<Setting> }>;
          draft: {
            $post: (args: {
              param: { id: string };
              json: SettingDraftInput;
            }) => Promise<{ json: () => Promise<SettingDraft> }>;
          };
          markdown: {
            $get: (args: {
              param: { id: string };
            }) => Promise<{ json: () => Promise<{ markdown: string }> }>;
            $put: (args: {
              param: { id: string };
              json: { markdown: string };
            }) => Promise<{ json: () => Promise<SaveSettingsMarkdownResult> }>;
          };
          editSection: {
            $post: (args: {
              param: { id: string };
              json: { category: string; name: string; description: string; instruction: string };
            }) => Promise<{ json: () => Promise<EditSettingSectionResult> }>;
          };
          editDocument: {
            $post: (args: {
              param: { id: string };
              json: { markdown: string; instruction: string };
            }) => Promise<{ json: () => Promise<EditSettingSectionResult> }>;
          };
        };
        llmInstructions: {
          $get: (args: {
            param: { id: string };
            query?: { entityType?: string };
          }) => Promise<{ json: () => Promise<LlmInstruction[]> }>;
          $post: (args: {
            param: { id: string };
            json: CreateLlmInstructionInput;
          }) => Promise<{ json: () => Promise<LlmInstruction> }>;
        };
        timelines: {
          $get: (args: { param: { id: string } }) => Promise<{ json: () => Promise<Timeline[]> }>;
          $post: (args: {
            param: { id: string };
            json: CreateTimelineInput;
          }) => Promise<{ json: () => Promise<Timeline> }>;
        };
        generate: {
          plot: {
            $post: (args: {
              param: { id: string };
            }) => Promise<{ json: () => Promise<GeneratedPlot> }>;
          };
        };
      };
    };
    chapters: {
      ':id': {
        $get: (args: {
          param: { id: string };
        }) => Promise<{ json: () => Promise<ChapterWithSections> }>;
        $post: (args: {
          param: { id: string };
          json: CreateSectionInput;
        }) => Promise<{ json: () => Promise<Section> }>;
        $put: (args: {
          param: { id: string };
          json: UpdateChapterInput;
        }) => Promise<{ json: () => Promise<Chapter> }>;
        $delete: (args: {
          param: { id: string };
        }) => Promise<{ json: () => Promise<ApiSuccessResponse> }>;
        generate: {
          summary: {
            $post: (args: {
              param: { id: string };
            }) => Promise<{ json: () => Promise<GeneratedSummary> }>;
          };
        };
      };
    };
    sections: {
      ':id': {
        $get: (args: {
          param: { id: string };
        }) => Promise<{ json: () => Promise<SectionWithContent> }>;
        $put: (args: {
          param: { id: string };
          json: UpdateSectionInput;
        }) => Promise<{ json: () => Promise<Section> }>;
        $delete: (args: {
          param: { id: string };
        }) => Promise<{ json: () => Promise<ApiSuccessResponse> }>;
        generate: {
          summary: {
            $post: (args: {
              param: { id: string };
            }) => Promise<{ json: () => Promise<GeneratedSummary> }>;
          };
          content: {
            $post: (args: { param: { id: string } }) => Promise<Response>;
          };
          extract: {
            $post: (args: {
              param: { id: string };
            }) => Promise<{ json: () => Promise<ExtractResult> }>;
          };
        };
        content: {
          $get: (args: { param: { id: string } }) => Promise<{ json: () => Promise<Content> }>;
          $put: (args: {
            param: { id: string };
            json: UpdateContentInput;
          }) => Promise<{ json: () => Promise<Content> }>;
        };
      };
    };
    characters: {
      ':id': {
        $get: (args: { param: { id: string } }) => Promise<{ json: () => Promise<Character> }>;
        $put: (args: {
          param: { id: string };
          json: UpdateCharacterInput;
        }) => Promise<{ json: () => Promise<Character> }>;
        $delete: (args: {
          param: { id: string };
        }) => Promise<{ json: () => Promise<ApiSuccessResponse> }>;
        edit: {
          $post: (args: {
            param: { id: string };
            json: EditInstructionInput;
          }) => Promise<{ json: () => Promise<Character> }>;
        };
      };
    };
    settings: {
      ':id': {
        $get: (args: { param: { id: string } }) => Promise<{ json: () => Promise<Setting> }>;
        $put: (args: {
          param: { id: string };
          json: UpdateSettingInput;
        }) => Promise<{ json: () => Promise<Setting> }>;
        $delete: (args: {
          param: { id: string };
        }) => Promise<{ json: () => Promise<ApiSuccessResponse> }>;
        edit: {
          $post: (args: {
            param: { id: string };
            json: EditInstructionInput;
          }) => Promise<{ json: () => Promise<Setting> }>;
        };
      };
    };
    timelines: {
      ':id': {
        $delete: (args: {
          param: { id: string };
        }) => Promise<{ json: () => Promise<ApiSuccessResponse> }>;
      };
    };
    llmInstructions: {
      ':id': {
        $delete: (args: {
          param: { id: string };
        }) => Promise<{ json: () => Promise<ApiSuccessResponse> }>;
      };
    };
    chat: {
      extractEntities: {
        $post: (args: {
          json: { text: string };
        }) => Promise<{ json: () => Promise<ExtractedChatEntities> }>;
      };
      sessions: {
        $get: (args?: {
          query?: { novelId?: string };
        }) => Promise<{ json: () => Promise<ChatSession[]> }>;
        $post: (args: {
          json: CreateChatSessionInput;
        }) => Promise<{ json: () => Promise<ChatSession> }>;
        ':id': {
          $get: (args: {
            param: { id: string };
          }) => Promise<{ json: () => Promise<ChatSessionDetail> }>;
          $put: (args: {
            param: { id: string };
            json: UpdateChatSessionInput;
          }) => Promise<{ json: () => Promise<ChatSession> }>;
          $delete: (args: {
            param: { id: string };
          }) => Promise<{ json: () => Promise<ApiSuccessResponse> }>;
        };
      };
    };
    backup: {
      $export: (novelId: string) => Promise<Response>;
      $import: (data: unknown) => Promise<{ json: () => Promise<ImportResult> }>;
    };
  };
};

function jsonWrap<T>(fn: () => Promise<T>): Promise<{ json: () => Promise<T> }> {
  return Promise.resolve({
    json: fn,
  });
}

function parseJsonSafe(str: string) {
  try {
    return JSON.parse(str);
  } catch {
    return {};
  }
}

// ConnectRPC クライアントを利用した ApiClient 実装
function createApiClient(): ApiClient['api'] {
  return {
    novels: {
      $get: async () =>
        jsonWrap(async () => {
          const res = await novelClient.listNovels({});
          return res.novels.map((n) => ({
            id: n.id,
            title: n.title,
            description: n.description ?? null,
            createdAt: n.createdAt ?? null,
            updatedAt: n.updatedAt ?? null,
          }));
        }),
      $post: async ({ json }) =>
        jsonWrap(async () => {
          const res = await novelClient.createNovel({
            title: json.title,
            description: json.description,
          });
          return {
            id: res.id,
            title: res.title,
            description: res.description ?? null,
            createdAt: res.createdAt ?? null,
            updatedAt: res.updatedAt ?? null,
          };
        }),
      ':id': {
        $get: async ({ param }) =>
          jsonWrap(async () => {
            const res = await novelClient.getNovelDetail({ id: param.id });
            const n = res.novel!;
            return {
              id: n.id,
              title: n.title,
              description: n.description ?? null,
              createdAt: n.createdAt ?? null,
              updatedAt: n.updatedAt ?? null,
              chapters: res.chapters.map((ch) => ({
                id: ch.id,
                novelId: ch.novelId,
                title: ch.title,
                order: ch.order,
                summary: ch.summary ?? null,
                createdAt: ch.createdAt ?? null,
                updatedAt: ch.updatedAt ?? null,
              })),
              characters: res.characters.map((c) => ({
                id: c.id,
                novelId: c.novelId,
                category: c.category,
                name: c.name,
                description: c.description ?? null,
                traits: c.traits,
                relationships: parseJsonSafe(c.relationshipsJson),
                createdAt: c.createdAt ?? null,
                updatedAt: c.updatedAt ?? null,
              })),
              settings: res.settings.map((s) => ({
                id: s.id,
                novelId: s.novelId,
                category: s.category,
                name: s.name,
                description: s.description ?? null,
                metadata: parseJsonSafe(s.metadataJson),
                createdAt: s.createdAt ?? null,
                updatedAt: s.updatedAt ?? null,
              })),
            };
          }),
        $put: async ({ param, json }) =>
          jsonWrap(async () => {
            const res = await novelClient.updateNovel({
              id: param.id,
              title: json.title,
              description: json.description,
            });
            return {
              id: res.id,
              title: res.title,
              description: res.description ?? null,
              createdAt: res.createdAt ?? null,
              updatedAt: res.updatedAt ?? null,
            };
          }),
        $delete: async ({ param }) =>
          jsonWrap(async () => {
            await novelClient.deleteNovel({ id: param.id });
            return { success: true as const };
          }),
        chapters: {
          $get: async ({ param }) =>
            jsonWrap(async () => {
              const res = await chapterClient.listChapters({ novelId: param.id });
              return res.chapters.map((ch) => ({
                id: ch.id,
                novelId: ch.novelId,
                title: ch.title,
                order: ch.order,
                summary: ch.summary ?? null,
                createdAt: ch.createdAt ?? null,
                updatedAt: ch.updatedAt ?? null,
              }));
            }),
          $post: async ({ param, json }) =>
            jsonWrap(async () => {
              const res = await chapterClient.createChapter({
                novelId: param.id,
                title: json.title,
                order: json.order,
                summary: json.summary,
              });
              return {
                id: res.id,
                novelId: res.novelId,
                title: res.title,
                order: res.order,
                summary: res.summary ?? null,
                createdAt: res.createdAt ?? null,
                updatedAt: res.updatedAt ?? null,
              };
            }),
        },
        characters: {
          $get: async ({ param }) =>
            jsonWrap(async () => {
              const res = await characterClient.listCharacters({ novelId: param.id });
              return res.characters.map((c) => ({
                id: c.id,
                novelId: c.novelId,
                category: c.category,
                name: c.name,
                description: c.description ?? null,
                traits: c.traits,
                relationships: parseJsonSafe(c.relationshipsJson),
                createdAt: c.createdAt ?? null,
                updatedAt: c.updatedAt ?? null,
              }));
            }),
          $post: async ({ param, json }) =>
            jsonWrap(async () => {
              const res = await characterClient.createCharacter({
                novelId: param.id,
                category: json.category,
                name: json.name,
                description: json.description,
                traits: json.traits,
                relationshipsJson: JSON.stringify(json.relationships ?? {}),
              });
              return {
                id: res.id,
                novelId: res.novelId,
                category: res.category,
                name: res.name,
                description: res.description ?? null,
                traits: res.traits,
                relationships: parseJsonSafe(res.relationshipsJson),
                createdAt: res.createdAt ?? null,
                updatedAt: res.updatedAt ?? null,
              };
            }),
          markdown: {
            $get: async ({ param }) =>
              jsonWrap(async () => {
                const res = await characterClient.getCharactersMarkdown({ novelId: param.id });
                return { markdown: res.markdown };
              }),
            $put: async ({ param, json }) =>
              jsonWrap(async () => {
                const res = await characterClient.saveCharactersMarkdown({
                  novelId: param.id,
                  markdown: json.markdown,
                });
                return {
                  created: res.createdCount,
                  updated: res.updatedCount,
                  deleted: res.deletedCount,
                  duplicateCount: 0,
                };
              }),
          },
          editSection: {
            $post: async ({ param, json }) =>
              jsonWrap(async () => {
                const res = await characterClient.editCharacterSection({
                  novelId: param.id,
                  category: json.category,
                  name: json.name,
                  description: json.description,
                  traits: json.traits,
                  relationships: json.relationships,
                  instruction: json.instruction,
                });
                return {
                  markdown: res.parsedSummary ?? '',
                };
              }),
          },
          editDocument: {
            $post: async ({ param, json }) =>
              jsonWrap(async () => {
                const res = await characterClient.editCharacterDocument({
                  novelId: param.id,
                  markdown: json.markdown,
                  instruction: json.instruction,
                });
                return {
                  markdown: res.parsedSummary ?? '',
                };
              }),
          },
        },
        settings: {
          $get: async ({ param, query }) =>
            jsonWrap(async () => {
              const res = await settingClient.listSettings({
                novelId: param.id,
                category: query?.category,
              });
              return res.settings.map((s) => ({
                id: s.id,
                novelId: s.novelId,
                category: s.category,
                name: s.name,
                description: s.description ?? null,
                metadata: parseJsonSafe(s.metadataJson),
                createdAt: s.createdAt ?? null,
                updatedAt: s.updatedAt ?? null,
              }));
            }),
          $post: async ({ param, json }) =>
            jsonWrap(async () => {
              const res = await settingClient.createSetting({
                novelId: param.id,
                category: json.category,
                name: json.name,
                description: json.description,
                metadataJson: JSON.stringify(json.metadata ?? {}),
              });
              return {
                id: res.id,
                novelId: res.novelId,
                category: res.category,
                name: res.name,
                description: res.description ?? null,
                metadata: parseJsonSafe(res.metadataJson),
                createdAt: res.createdAt ?? null,
                updatedAt: res.updatedAt ?? null,
              };
            }),
          draft: {
            $post: async ({ param, json }) =>
              jsonWrap(async () => {
                const res = await settingClient.generateDraft({
                  novelId: param.id,
                  category: json.currentDraft?.category ?? '',
                  query: json.instruction,
                });
                return {
                  category: res.category,
                  name: res.name,
                  description: res.description,
                };
              }),
          },
          markdown: {
            $get: async ({ param }) =>
              jsonWrap(async () => {
                const res = await settingClient.getSettingsMarkdown({ novelId: param.id });
                return { markdown: res.markdown };
              }),
            $put: async ({ param, json }) =>
              jsonWrap(async () => {
                const res = await settingClient.saveSettingsMarkdown({
                  novelId: param.id,
                  markdown: json.markdown,
                });
                return {
                  created: res.createdCount,
                  updated: res.updatedCount,
                  deleted: res.deletedCount,
                  duplicateCount: 0,
                };
              }),
          },
          editSection: {
            $post: async ({ param, json }) =>
              jsonWrap(async () => {
                const res = await settingClient.editSettingSection({
                  novelId: param.id,
                  category: json.category,
                  name: json.name,
                  description: json.description,
                  instruction: json.instruction,
                });
                return {
                  markdown: res.parsedSummary ?? '',
                };
              }),
          },
          editDocument: {
            $post: async ({ param, json }) =>
              jsonWrap(async () => {
                const res = await settingClient.editSettingDocument({
                  novelId: param.id,
                  markdown: json.markdown,
                  instruction: json.instruction,
                });
                return {
                  markdown: res.parsedSummary ?? '',
                };
              }),
          },
        },
        llmInstructions: {
          $get: async ({ param, query }) =>
            jsonWrap(async () => {
              const res = await llmInstructionClient.listLlmInstructions({
                novelId: param.id,
                entityType: query?.entityType,
              });
              return res.instructions.map((ins) => ({
                id: ins.id,
                novelId: ins.novelId,
                entityType: ins.entityType,
                instruction: ins.instruction,
                createdAt: ins.createdAt ?? null,
              }));
            }),
          $post: async ({ param, json }) =>
            jsonWrap(async () => {
              const res = await llmInstructionClient.createLlmInstruction({
                novelId: param.id,
                entityType: json.entityType,
                instruction: json.instruction,
              });
              return {
                id: res.id,
                novelId: res.novelId,
                entityType: res.entityType,
                instruction: res.instruction,
                createdAt: res.createdAt ?? null,
              };
            }),
        },
        timelines: {
          $get: async ({ param }) =>
            jsonWrap(async () => {
              const res = await timelineClient.listTimelines({ novelId: param.id });
              return res.timelines.map((t) => ({
                id: t.id,
                novelId: t.novelId,
                sectionId: t.sectionId ?? null,
                event: t.event,
                order: t.order,
                timestamp: t.timestamp ?? null,
                createdAt: t.createdAt ?? null,
              }));
            }),
          $post: async ({ param, json }) =>
            jsonWrap(async () => {
              const res = await timelineClient.createTimeline({
                novelId: param.id,
                sectionId: json.sectionId,
                event: json.event,
                order: json.order,
                timestamp: json.timestamp,
              });
              return {
                id: res.id,
                novelId: res.novelId,
                sectionId: res.sectionId ?? null,
                event: res.event,
                order: res.order,
                timestamp: res.timestamp ?? null,
                createdAt: res.createdAt ?? null,
              };
            }),
        },
        generate: {
          plot: {
            $post: async ({ param }) =>
              jsonWrap(async () => {
                const res = await generateClient.generatePlot({ novelId: param.id });
                return {
                  title: res.title,
                  description: res.description,
                  chapters: res.chapters.map((ch) => ({
                    title: ch.title,
                    order: ch.order,
                    summary: ch.summary,
                  })),
                };
              }),
          },
        },
      },
    },
    chapters: {
      ':id': {
        $get: async ({ param }) =>
          jsonWrap(async () => {
            const res = await chapterClient.getChapter({ id: param.id });
            const ch = res.chapter!;
            return {
              id: ch.id,
              novelId: ch.novelId,
              title: ch.title,
              order: ch.order,
              summary: ch.summary ?? null,
              createdAt: ch.createdAt ?? null,
              updatedAt: ch.updatedAt ?? null,
              sections: res.sections.map((s) => ({
                id: s.id,
                chapterId: s.chapterId,
                title: s.title ?? null,
                order: s.order,
                summary: s.summary ?? null,
                createdAt: s.createdAt ?? null,
                updatedAt: s.updatedAt ?? null,
              })),
            };
          }),
        $post: async ({ param, json }) =>
          jsonWrap(async () => {
            const res = await sectionClient.createSection({
              chapterId: param.id,
              title: json.title,
              order: json.order,
              summary: json.summary,
            });
            return {
              id: res.id,
              chapterId: res.chapterId,
              title: res.title ?? null,
              order: res.order,
              summary: res.summary ?? null,
              createdAt: res.createdAt ?? null,
              updatedAt: res.updatedAt ?? null,
            };
          }),
        $put: async ({ param, json }) =>
          jsonWrap(async () => {
            const res = await chapterClient.updateChapter({
              id: param.id,
              title: json.title,
              order: json.order,
              summary: json.summary,
            });
            return {
              id: res.id,
              novelId: res.novelId,
              title: res.title,
              order: res.order,
              summary: res.summary ?? null,
              createdAt: res.createdAt ?? null,
              updatedAt: res.updatedAt ?? null,
            };
          }),
        $delete: async ({ param }) =>
          jsonWrap(async () => {
            await chapterClient.deleteChapter({ id: param.id });
            return { success: true as const };
          }),
        generate: {
          summary: {
            $post: async ({ param }) =>
              jsonWrap(async () => {
                const res = await generateClient.generateChapterSummary({ chapterId: param.id });
                return {
                  title: res.title,
                  order: res.order,
                  summary: res.summary,
                };
              }),
          },
        },
      },
    },
    sections: {
      ':id': {
        $get: async ({ param }) =>
          jsonWrap(async () => {
            const res = await sectionClient.getSection({ id: param.id });
            const s = res.section!;
            return {
              id: s.id,
              chapterId: s.chapterId,
              title: s.title ?? null,
              order: s.order,
              summary: s.summary ?? null,
              createdAt: s.createdAt ?? null,
              updatedAt: s.updatedAt ?? null,
              content: res.content
                ? {
                    id: res.content.id,
                    sectionId: res.content.sectionId,
                    body: res.content.body,
                    wordCount: res.content.wordCount ?? null,
                    createdAt: res.content.createdAt ?? null,
                    updatedAt: res.content.updatedAt ?? null,
                  }
                : null,
            };
          }),
        $put: async ({ param, json }) =>
          jsonWrap(async () => {
            const res = await sectionClient.updateSection({
              id: param.id,
              title: json.title,
              order: json.order,
              summary: json.summary,
            });
            return {
              id: res.id,
              chapterId: res.chapterId,
              title: res.title ?? null,
              order: res.order,
              summary: res.summary ?? null,
              createdAt: res.createdAt ?? null,
              updatedAt: res.updatedAt ?? null,
            };
          }),
        $delete: async ({ param }) =>
          jsonWrap(async () => {
            await sectionClient.deleteSection({ id: param.id });
            return { success: true as const };
          }),
        generate: {
          summary: {
            $post: async ({ param }) =>
              jsonWrap(async () => {
                const res = await generateClient.generateSectionSummary({ sectionId: param.id });
                return {
                  title: res.title,
                  order: res.order,
                  summary: res.summary,
                };
              }),
          },
          content: {
            $post: async ({ param }) => {
              // Server Streaming RPC を Web Response (SSE 互換ストリーム) にブリッジ
              const stream = new ReadableStream<Uint8Array>({
                async start(controller) {
                  const encoder = new TextEncoder();
                  try {
                    for await (const chunk of generateClient.generateSectionContent({
                      sectionId: param.id,
                    })) {
                      controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ text: chunk.chunk })}\n\n`),
                      );
                    }
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`),
                    );
                  } catch (err) {
                    controller.error(err);
                  } finally {
                    controller.close();
                  }
                },
              });
              return new Response(stream, {
                headers: { 'Content-Type': 'text/event-stream' },
              });
            },
          },
          extract: {
            $post: async ({ param }) =>
              jsonWrap(async () => {
                const res = await generateClient.extractEntities({ sectionId: param.id });
                return {
                  settings: res.settings.map((s) => ({
                    id: '',
                    novelId: '',
                    category: s.category,
                    name: s.name,
                    description: s.description ?? null,
                    metadata: {},
                    createdAt: null,
                    updatedAt: null,
                  })),
                  timelines: res.timelines.map((t) => ({
                    id: '',
                    novelId: '',
                    sectionId: param.id,
                    event: t.event,
                    order: t.order,
                    timestamp: t.timestamp || null,
                    createdAt: null,
                  })),
                };
              }),
          },
        },
        content: {
          $get: async ({ param }) =>
            jsonWrap(async () => {
              const res = await contentClient.getContent({ sectionId: param.id });
              return {
                id: res.id,
                sectionId: res.sectionId,
                body: res.body,
                wordCount: res.wordCount ?? null,
                createdAt: res.createdAt ?? null,
                updatedAt: res.updatedAt ?? null,
              };
            }),
          $put: async ({ param, json }) =>
            jsonWrap(async () => {
              const res = await contentClient.updateContent({
                sectionId: param.id,
                body: json.body,
              });
              return {
                id: res.id,
                sectionId: res.sectionId,
                body: res.body,
                wordCount: res.wordCount ?? null,
                createdAt: res.createdAt ?? null,
                updatedAt: res.updatedAt ?? null,
              };
            }),
        },
      },
    },
    characters: {
      ':id': {
        $get: async ({ param }) =>
          jsonWrap(async () => {
            const res = await characterClient.getCharacter({ id: param.id });
            return {
              id: res.id,
              novelId: res.novelId,
              category: res.category,
              name: res.name,
              description: res.description ?? null,
              traits: res.traits,
              relationships: parseJsonSafe(res.relationshipsJson),
              createdAt: res.createdAt ?? null,
              updatedAt: res.updatedAt ?? null,
            };
          }),
        $put: async ({ param, json }) =>
          jsonWrap(async () => {
            const res = await characterClient.updateCharacter({
              id: param.id,
              category: json.category,
              name: json.name,
              description: json.description,
              traits: json.traits,
              relationshipsJson: json.relationships
                ? JSON.stringify(json.relationships)
                : undefined,
            });
            return {
              id: res.id,
              novelId: res.novelId,
              category: res.category,
              name: res.name,
              description: res.description ?? null,
              traits: res.traits,
              relationships: parseJsonSafe(res.relationshipsJson),
              createdAt: res.createdAt ?? null,
              updatedAt: res.updatedAt ?? null,
            };
          }),
        $delete: async ({ param }) =>
          jsonWrap(async () => {
            await characterClient.deleteCharacter({ id: param.id });
            return { success: true as const };
          }),
        edit: {
          $post: async ({ param, json }) =>
            jsonWrap(async () => {
              const res = await characterClient.editCharacter({
                id: param.id,
                instruction: json.instruction,
              });
              return {
                id: res.id,
                novelId: res.novelId,
                category: res.category,
                name: res.name,
                description: res.description ?? null,
                traits: res.traits,
                relationships: parseJsonSafe(res.relationshipsJson),
                createdAt: res.createdAt ?? null,
                updatedAt: res.updatedAt ?? null,
              };
            }),
        },
      },
    },
    settings: {
      ':id': {
        $get: async ({ param }) =>
          jsonWrap(async () => {
            const res = await settingClient.getSetting({ id: param.id });
            return {
              id: res.id,
              novelId: res.novelId,
              category: res.category,
              name: res.name,
              description: res.description ?? null,
              metadata: parseJsonSafe(res.metadataJson),
              createdAt: res.createdAt ?? null,
              updatedAt: res.updatedAt ?? null,
            };
          }),
        $put: async ({ param, json }) =>
          jsonWrap(async () => {
            const res = await settingClient.updateSetting({
              id: param.id,
              category: json.category,
              name: json.name,
              description: json.description,
              metadataJson: json.metadata ? JSON.stringify(json.metadata) : undefined,
            });
            return {
              id: res.id,
              novelId: res.novelId,
              category: res.category,
              name: res.name,
              description: res.description ?? null,
              metadata: parseJsonSafe(res.metadataJson),
              createdAt: res.createdAt ?? null,
              updatedAt: res.updatedAt ?? null,
            };
          }),
        $delete: async ({ param }) =>
          jsonWrap(async () => {
            await settingClient.deleteSetting({ id: param.id });
            return { success: true as const };
          }),
        edit: {
          $post: async ({ param, json }) =>
            jsonWrap(async () => {
              const res = await settingClient.editSetting({
                id: param.id,
                instruction: json.instruction,
              });
              return {
                id: res.id,
                novelId: res.novelId,
                category: res.category,
                name: res.name,
                description: res.description ?? null,
                metadata: parseJsonSafe(res.metadataJson),
                createdAt: res.createdAt ?? null,
                updatedAt: res.updatedAt ?? null,
              };
            }),
        },
      },
    },
    timelines: {
      ':id': {
        $delete: async ({ param }) =>
          jsonWrap(async () => {
            await timelineClient.deleteTimeline({ id: param.id });
            return { success: true as const };
          }),
      },
    },
    llmInstructions: {
      ':id': {
        $delete: async ({ param }) =>
          jsonWrap(async () => {
            await llmInstructionClient.deleteLlmInstruction({ id: param.id });
            return { success: true as const };
          }),
      },
    },
    chat: {
      extractEntities: {
        $post: async ({ json }) =>
          jsonWrap(async () => {
            const res = await chatClient.extractEntities({ text: json.text });
            return {
              characters: res.characters.map((c) => ({
                name: c.name,
                category: c.category,
                description: c.description,
                traits: c.traits,
              })),
              settings: res.settings.map((s) => ({
                name: s.name,
                category: s.category,
                description: s.description,
              })),
            };
          }),
      },
      sessions: {
        $get: async (args) =>
          jsonWrap(async () => {
            const res = await chatClient.listChatSessions({ novelId: args?.query?.novelId });
            return res.sessions.map((s) => ({
              id: s.id,
              novelId: s.novelId ?? null,
              title: s.title,
              createdAt: s.createdAt ?? null,
              updatedAt: s.updatedAt ?? null,
            }));
          }),
        $post: async ({ json }) =>
          jsonWrap(async () => {
            const res = await chatClient.createChatSession({
              novelId: json.novelId,
              title: json.title ?? '',
              messages: [],
            });
            return {
              id: res.id,
              novelId: res.novelId ?? null,
              title: res.title,
              createdAt: res.createdAt ?? null,
              updatedAt: res.updatedAt ?? null,
            };
          }),
        ':id': {
          $get: async ({ param }) =>
            jsonWrap(async () => {
              const res = await chatClient.getChatSession({ id: param.id });
              const s = res.session!;
              return {
                id: s.id,
                novelId: s.novelId ?? null,
                title: s.title,
                createdAt: s.createdAt ?? null,
                updatedAt: s.updatedAt ?? null,
                messages: res.messages.map((m) => ({
                  id: m.id,
                  sessionId: m.sessionId,
                  role: m.role as ChatMessageItem['role'],
                  content: m.content,
                  createdAt: m.createdAt ?? null,
                })),
              };
            }),
          $put: async ({ param, json }) =>
            jsonWrap(async () => {
              const res = await chatClient.updateChatSession({
                id: param.id,
                title: json.title,
                messages: [],
              });
              return {
                id: res.id,
                novelId: res.novelId ?? null,
                title: res.title,
                createdAt: res.createdAt ?? null,
                updatedAt: res.updatedAt ?? null,
              };
            }),
          $delete: async ({ param }) =>
            jsonWrap(async () => {
              await chatClient.deleteChatSession({ id: param.id });
              return { success: true as const };
            }),
        },
      },
    },
    backup: {
      $export: async (novelId: string) => {
        const res = await backupClient.exportNovel({ novelId });
        return new Response(res.jsonData, {
          headers: { 'Content-Type': 'application/json' },
        });
      },
      $import: async (data: unknown) =>
        jsonWrap(async () => {
          const res = await backupClient.importNovel({
            jsonData: typeof data === 'string' ? data : JSON.stringify(data),
          });
          return {
            success: true as const,
            novelId: res.novelId,
            counts: {},
          };
        }),
    },
  };
}

export const api = typeof window !== 'undefined' ? createApiClient() : ({} as ApiClient['api']);
