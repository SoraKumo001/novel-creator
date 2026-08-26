import * as services from './services/index.js';
import type {
  ApiSuccessResponse,
  Character,
  Chapter,
  ChapterWithSections,
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
  return Promise.resolve({ json: fn });
}

function createApiClient(): ApiClient['api'] {
  return {
    novels: {
      $get: () => jsonWrap(() => services.fetchNovels()),
      $post: ({ json }) => jsonWrap(() => services.createNovel(json)),
      ':id': {
        $get: ({ param }) => jsonWrap(() => services.fetchNovelDetail(param.id)),
        $put: ({ param, json }) => jsonWrap(() => services.updateNovel(param.id, json)),
        $delete: ({ param }) =>
          jsonWrap(async () => {
            await services.deleteNovel(param.id);
            return { success: true as const };
          }),
        chapters: {
          $get: ({ param }) =>
            jsonWrap(async () => {
              const res = await services.fetchChapters(param.id);
              return res.map(({ sections: _sections, ...c }) => c);
            }),
          $post: ({ param, json }) => jsonWrap(() => services.createChapter(param.id, json)),
        },
        characters: {
          $get: ({ param }) => jsonWrap(() => services.fetchCharacters(param.id)),
          $post: ({ param, json }) => jsonWrap(() => services.createCharacter(param.id, json)),
          markdown: {
            $get: ({ param }) => jsonWrap(() => services.fetchCharactersMarkdown(param.id)),
            $put: ({ param, json }) =>
              jsonWrap(() => services.saveCharactersMarkdown(param.id, json.markdown)),
          },
          editSection: {
            $post: ({ param, json }) =>
              jsonWrap(() => services.editCharacterSection(param.id, json)),
          },
          editDocument: {
            $post: ({ param, json }) =>
              jsonWrap(() =>
                services.editCharacterDocument(param.id, json.markdown, json.instruction),
              ),
          },
        },
        settings: {
          $get: ({ param, query }) =>
            jsonWrap(() => services.fetchSettings(param.id, query?.category)),
          $post: ({ param, json }) => jsonWrap(() => services.createSetting(param.id, json)),
          draft: {
            $post: ({ param, json }) =>
              jsonWrap(() => services.generateSettingDraft(param.id, json)),
          },
          markdown: {
            $get: ({ param }) => jsonWrap(() => services.fetchSettingsMarkdown(param.id)),
            $put: ({ param, json }) =>
              jsonWrap(() => services.saveSettingsMarkdown(param.id, json.markdown)),
          },
          editSection: {
            $post: ({ param, json }) => jsonWrap(() => services.editSettingSection(param.id, json)),
          },
          editDocument: {
            $post: ({ param, json }) =>
              jsonWrap(() =>
                services.editSettingDocument(param.id, json.markdown, json.instruction),
              ),
          },
        },
        llmInstructions: {
          $get: ({ param, query }) =>
            jsonWrap(() => services.fetchLlmInstructions(param.id, query?.entityType)),
          $post: ({ param, json }) => jsonWrap(() => services.createLlmInstruction(param.id, json)),
        },
        timelines: {
          $get: ({ param }) => jsonWrap(() => services.fetchTimelines(param.id)),
          $post: ({ param, json }) => jsonWrap(() => services.createTimeline(param.id, json)),
        },
        generate: {
          plot: {
            $post: ({ param }) => jsonWrap(() => services.generatePlot(param.id)),
          },
        },
      },
    },
    chapters: {
      ':id': {
        $get: ({ param }) => jsonWrap(() => services.fetchChapter(param.id)),
        $post: ({ param, json }) => jsonWrap(() => services.createSection(param.id, json)),
        $put: ({ param, json }) => jsonWrap(() => services.updateChapter(param.id, json)),
        $delete: ({ param }) =>
          jsonWrap(async () => {
            await services.deleteChapter(param.id);
            return { success: true as const };
          }),
        generate: {
          summary: {
            $post: ({ param }) => jsonWrap(() => services.generateChapterSummary(param.id)),
          },
        },
      },
    },
    sections: {
      ':id': {
        $get: ({ param }) => jsonWrap(() => services.fetchSection(param.id)),
        $put: ({ param, json }) => jsonWrap(() => services.updateSection(param.id, json)),
        $delete: ({ param }) =>
          jsonWrap(async () => {
            await services.deleteSection(param.id);
            return { success: true as const };
          }),
        generate: {
          summary: {
            $post: ({ param }) => jsonWrap(() => services.generateSectionSummary(param.id)),
          },
          content: {
            $post: async ({ param }: { param: { id: string } }) => {
              const stream = services.generateSectionContent(param.id);
              const encoder = new TextEncoder();
              const readable = new ReadableStream({
                async start(controller) {
                  try {
                    for await (const chunk of stream) {
                      controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`),
                      );
                    }
                    controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                    controller.close();
                  } catch (err) {
                    controller.error(err);
                  }
                },
              });
              return new Response(readable, {
                headers: { 'Content-Type': 'text/event-stream' },
              });
            },
          },
          extract: {
            $post: ({ param }) => jsonWrap(() => services.extractEntities(param.id)),
          },
        },
        content: {
          $get: ({ param }) => jsonWrap(() => services.fetchContent(param.id)),
          $put: ({ param, json }) => jsonWrap(() => services.updateContent(param.id, json)),
        },
      },
    },
    characters: {
      ':id': {
        $get: ({ param }) =>
          jsonWrap(async () => {
            const res = await services.fetchCharacters('');
            const found = res.find((c) => c.id === param.id);
            if (!found) throw new Error('Character not found');
            return found;
          }),
        $put: ({ param, json }) => jsonWrap(() => services.updateCharacter(param.id, json)),
        $delete: ({ param }) =>
          jsonWrap(async () => {
            await services.deleteCharacter(param.id);
            return { success: true as const };
          }),
        edit: {
          $post: ({ param, json }) => jsonWrap(() => services.editCharacter(param.id, json)),
        },
      },
    },
    settings: {
      ':id': {
        $get: ({ param }) =>
          jsonWrap(async () => {
            const res = await services.fetchSettings('');
            const found = res.find((s) => s.id === param.id);
            if (!found) throw new Error('Setting not found');
            return found;
          }),
        $put: ({ param, json }) => jsonWrap(() => services.updateSetting(param.id, json)),
        $delete: ({ param }) =>
          jsonWrap(async () => {
            await services.deleteSetting(param.id);
            return { success: true as const };
          }),
        edit: {
          $post: ({ param, json }) => jsonWrap(() => services.editSetting(param.id, json)),
        },
      },
    },
    timelines: {
      ':id': {
        $delete: ({ param }) =>
          jsonWrap(async () => {
            await services.deleteTimeline(param.id);
            return { success: true as const };
          }),
      },
    },
    llmInstructions: {
      ':id': {
        $delete: ({ param }) =>
          jsonWrap(async () => {
            await services.deleteLlmInstruction(param.id);
            return { success: true as const };
          }),
      },
    },
    chat: {
      extractEntities: {
        $post: ({ json }) => jsonWrap(() => services.extractChatEntities(json.text)),
      },
      sessions: {
        $get: (args) => jsonWrap(() => services.fetchChatSessions(args?.query?.novelId)),
        $post: ({ json }) => jsonWrap(() => services.createChatSession(json)),
        ':id': {
          $get: ({ param }) => jsonWrap(() => services.fetchChatSession(param.id)),
          $put: ({ param, json }) => jsonWrap(() => services.updateChatSession(param.id, json)),
          $delete: ({ param }) =>
            jsonWrap(async () => {
              await services.deleteChatSession(param.id);
              return { success: true as const };
            }),
        },
      },
    },
    backup: {
      $export: (novelId) => services.exportNovelBackup(novelId),
      $import: (data) => services.importNovelBackup(data),
    },
  };
}

export const api = createApiClient();
export * from './services/index.js';
