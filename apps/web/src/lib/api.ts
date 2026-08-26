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

// 実際の fetch を使う実装。Vite proxy 経由で /api にマッピングされる。
function createApiClient(): ApiClient['api'] {
  async function requestJson<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => 'Request failed');
      throw new Error(text);
    }
    return (await res.json()) as T;
  }

  async function requestResponse(method: string, path: string, body?: unknown): Promise<Response> {
    const res = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => 'Request failed');
      throw new Error(text);
    }
    return res;
  }

  return {
    novels: {
      $get: async () => ({ json: async () => requestJson<Novel[]>('GET', '/api/novels') }),
      $post: async ({ json }) => ({
        json: async () => requestJson<Novel>('POST', '/api/novels', json),
      }),
      ':id': {
        $get: async ({ param }) => ({
          json: async () => requestJson<NovelDetail>('GET', `/api/novels/${param.id}`),
        }),
        $put: async ({ param, json }) => ({
          json: async () => requestJson<Novel>('PUT', `/api/novels/${param.id}`, json),
        }),
        $delete: async ({ param }) => ({
          json: async () => requestJson<ApiSuccessResponse>('DELETE', `/api/novels/${param.id}`),
        }),
        chapters: {
          $get: async ({ param }) => ({
            json: async () => requestJson<Chapter[]>('GET', `/api/novels/${param.id}/chapters`),
          }),
          $post: async ({ param, json }) => ({
            json: async () =>
              requestJson<Chapter>('POST', `/api/novels/${param.id}/chapters`, json),
          }),
        },
        characters: {
          $get: async ({ param }) => ({
            json: async () => requestJson<Character[]>('GET', `/api/novels/${param.id}/characters`),
          }),
          $post: async ({ param, json }) => ({
            json: async () =>
              requestJson<Character>('POST', `/api/novels/${param.id}/characters`, json),
          }),
          markdown: {
            $get: async ({ param }) => ({
              json: async () =>
                requestJson<{ markdown: string }>(
                  'GET',
                  `/api/novels/${param.id}/characters/markdown`,
                ),
            }),
            $put: async ({ param, json }) => ({
              json: async () =>
                requestJson<SaveCharactersMarkdownResult>(
                  'PUT',
                  `/api/novels/${param.id}/characters/markdown`,
                  json,
                ),
            }),
          },
          editSection: {
            $post: async ({ param, json }) => ({
              json: async () =>
                requestJson<EditCharacterSectionResult>(
                  'POST',
                  `/api/novels/${param.id}/characters/edit-section`,
                  json,
                ),
            }),
          },
          editDocument: {
            $post: async ({ param, json }) => ({
              json: async () =>
                requestJson<EditCharacterSectionResult>(
                  'POST',
                  `/api/novels/${param.id}/characters/edit-document`,
                  json,
                ),
            }),
          },
        },
        settings: {
          $get: async ({ param, query }) => ({
            json: async () => {
              const qs = query?.category ? `?category=${encodeURIComponent(query.category)}` : '';
              return requestJson<Setting[]>('GET', `/api/novels/${param.id}/settings${qs}`);
            },
          }),
          $post: async ({ param, json }) => ({
            json: async () =>
              requestJson<Setting>('POST', `/api/novels/${param.id}/settings`, json),
          }),
          draft: {
            $post: async ({ param, json }) => ({
              json: async () =>
                requestJson<SettingDraft>('POST', `/api/novels/${param.id}/settings/draft`, json),
            }),
          },
          markdown: {
            $get: async ({ param }) => ({
              json: async () =>
                requestJson<{ markdown: string }>(
                  'GET',
                  `/api/novels/${param.id}/settings/markdown`,
                ),
            }),
            $put: async ({ param, json }) => ({
              json: async () =>
                requestJson<SaveSettingsMarkdownResult>(
                  'PUT',
                  `/api/novels/${param.id}/settings/markdown`,
                  json,
                ),
            }),
          },
          editSection: {
            $post: async ({ param, json }) => ({
              json: async () =>
                requestJson<EditSettingSectionResult>(
                  'POST',
                  `/api/novels/${param.id}/settings/edit-section`,
                  json,
                ),
            }),
          },
          editDocument: {
            $post: async ({ param, json }) => ({
              json: async () =>
                requestJson<EditSettingSectionResult>(
                  'POST',
                  `/api/novels/${param.id}/settings/edit-document`,
                  json,
                ),
            }),
          },
        },
        llmInstructions: {
          $get: async ({ param, query }) => ({
            json: async () => {
              const qs = query?.entityType
                ? `?entityType=${encodeURIComponent(query.entityType)}`
                : '';
              return requestJson<LlmInstruction[]>(
                'GET',
                `/api/novels/${param.id}/llm-instructions${qs}`,
              );
            },
          }),
          $post: async ({ param, json }) => ({
            json: async () =>
              requestJson<LlmInstruction>('POST', `/api/novels/${param.id}/llm-instructions`, json),
          }),
        },
        timelines: {
          $get: async ({ param }) => ({
            json: async () => requestJson<Timeline[]>('GET', `/api/novels/${param.id}/timelines`),
          }),
          $post: async ({ param, json }) => ({
            json: async () =>
              requestJson<Timeline>('POST', `/api/novels/${param.id}/timelines`, json),
          }),
        },
        generate: {
          plot: {
            $post: async ({ param }) => ({
              json: async () =>
                requestJson<GeneratedPlot>('POST', `/api/novels/${param.id}/generate/plot`),
            }),
          },
        },
      },
    },
    chapters: {
      ':id': {
        $get: async ({ param }) => ({
          json: async () => requestJson<ChapterWithSections>('GET', `/api/chapters/${param.id}`),
        }),
        $post: async ({ param, json }) => ({
          json: async () =>
            requestJson<Section>('POST', `/api/chapters/${param.id}/sections`, json),
        }),
        $put: async ({ param, json }) => ({
          json: async () => requestJson<Chapter>('PUT', `/api/chapters/${param.id}`, json),
        }),
        $delete: async ({ param }) => ({
          json: async () => requestJson<ApiSuccessResponse>('DELETE', `/api/chapters/${param.id}`),
        }),
        generate: {
          summary: {
            $post: async ({ param }) => ({
              json: async () =>
                requestJson<GeneratedSummary>('POST', `/api/chapters/${param.id}/generate/summary`),
            }),
          },
        },
      },
    },
    sections: {
      ':id': {
        $get: async ({ param }) => ({
          json: async () => requestJson<SectionWithContent>('GET', `/api/sections/${param.id}`),
        }),
        $put: async ({ param, json }) => ({
          json: async () => requestJson<Section>('PUT', `/api/sections/${param.id}`, json),
        }),
        $delete: async ({ param }) => ({
          json: async () => requestJson<ApiSuccessResponse>('DELETE', `/api/sections/${param.id}`),
        }),
        generate: {
          summary: {
            $post: async ({ param }) => ({
              json: async () =>
                requestJson<GeneratedSummary>('POST', `/api/sections/${param.id}/generate/summary`),
            }),
          },
          content: {
            $post: async ({ param }) =>
              requestResponse('POST', `/api/sections/${param.id}/generate/content`),
          },
          extract: {
            $post: async ({ param }) => ({
              json: async () =>
                requestJson<ExtractResult>('POST', `/api/sections/${param.id}/generate/extract`),
            }),
          },
        },
        content: {
          $get: async ({ param }) => ({
            json: async () => requestJson<Content>('GET', `/api/sections/${param.id}/content`),
          }),
          $put: async ({ param, json }) => ({
            json: async () =>
              requestJson<Content>('PUT', `/api/sections/${param.id}/content`, json),
          }),
        },
      },
    },
    characters: {
      ':id': {
        $get: async ({ param }) => ({
          json: async () => requestJson<Character>('GET', `/api/characters/${param.id}`),
        }),
        $put: async ({ param, json }) => ({
          json: async () => requestJson<Character>('PUT', `/api/characters/${param.id}`, json),
        }),
        $delete: async ({ param }) => ({
          json: async () =>
            requestJson<ApiSuccessResponse>('DELETE', `/api/characters/${param.id}`),
        }),
        edit: {
          $post: async ({ param, json }) => ({
            json: async () =>
              requestJson<Character>('POST', `/api/characters/${param.id}/edit`, json),
          }),
        },
      },
    },
    settings: {
      ':id': {
        $get: async ({ param }) => ({
          json: async () => requestJson<Setting>('GET', `/api/settings/${param.id}`),
        }),
        $put: async ({ param, json }) => ({
          json: async () => requestJson<Setting>('PUT', `/api/settings/${param.id}`, json),
        }),
        $delete: async ({ param }) => ({
          json: async () => requestJson<ApiSuccessResponse>('DELETE', `/api/settings/${param.id}`),
        }),
        edit: {
          $post: async ({ param, json }) => ({
            json: async () => requestJson<Setting>('POST', `/api/settings/${param.id}/edit`, json),
          }),
        },
      },
    },
    timelines: {
      ':id': {
        $delete: async ({ param }) => ({
          json: async () => requestJson<ApiSuccessResponse>('DELETE', `/api/timelines/${param.id}`),
        }),
      },
    },
    llmInstructions: {
      ':id': {
        $delete: async ({ param }) => ({
          json: async () =>
            requestJson<ApiSuccessResponse>('DELETE', `/api/llm-instructions/${param.id}`),
        }),
      },
    },
    chat: {
      extractEntities: {
        $post: async ({ json }) => ({
          json: async () =>
            requestJson<ExtractedChatEntities>('POST', '/api/chat/extract-entities', json),
        }),
      },
      sessions: {
        $get: async (args) => ({
          json: async () => {
            const qs = args?.query?.novelId
              ? `?novelId=${encodeURIComponent(args.query.novelId)}`
              : '';
            return requestJson<ChatSession[]>('GET', `/api/chat/sessions${qs}`);
          },
        }),
        $post: async ({ json }) => ({
          json: async () => requestJson<ChatSession>('POST', '/api/chat/sessions', json),
        }),
        ':id': {
          $get: async ({ param }) => ({
            json: async () =>
              requestJson<ChatSessionDetail>('GET', `/api/chat/sessions/${param.id}`),
          }),
          $put: async ({ param, json }) => ({
            json: async () =>
              requestJson<ChatSession>('PUT', `/api/chat/sessions/${param.id}`, json),
          }),
          $delete: async ({ param }) => ({
            json: async () =>
              requestJson<ApiSuccessResponse>('DELETE', `/api/chat/sessions/${param.id}`),
          }),
        },
      },
    },
    backup: {
      $export: async (novelId: string) =>
        requestResponse('POST', `/api/backup/export?novelId=${encodeURIComponent(novelId)}`),
      $import: async (data: unknown) => ({
        json: async () => requestJson<ImportResult>('POST', '/api/backup/import', data),
      }),
    },
  };
}

export const api = typeof window !== 'undefined' ? createApiClient() : ({} as ApiClient['api']);
