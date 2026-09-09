import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";

import type { DomainServices } from "../src/core/services.js";
import type { McpAuth } from "../src/core/types.js";
import { createNovelCreatorMcpServer } from "../src/mcp/server.js";

const NOVEL_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_NOVEL_ID = "22222222-2222-4222-8222-222222222222";

interface IdeaRow {
  body: string | null;
  id: string;
  novelId: string;
  source: string | null;
  status: string;
  title: string;
}

function scopedAuth(novelId: string): McpAuth {
  return { keyId: "key-1", novelId, userId: "user-1" };
}

function createStubServices(seed: IdeaRow[]): DomainServices {
  const store: IdeaRow[] = [...seed];
  let counter = 100;
  const nextId = (): string => {
    counter += 1;
    return `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`;
  };
  return {
    character: {
      listCharacters: async () => [
        { id: "c1", name: "アオイ", novelId: NOVEL_ID },
      ],
    },
    idea: {
      createIdea: async (
        novelId: string,
        data: { body?: string | null; source?: string | null; title: string }
      ): Promise<IdeaRow> => {
        const row: IdeaRow = {
          body: data.body ?? null,
          id: nextId(),
          novelId,
          source: data.source ?? null,
          status: "draft",
          title: data.title,
        };
        store.push(row);
        return row;
      },
      getIdea: async (id: string): Promise<IdeaRow> => {
        const found = store.find((r) => r.id === id);
        if (!found) {
          const error = new Error(`Idea ${id}`) as Error & { name: string };
          error.name = "NotFoundError";
          throw error;
        }
        return found;
      },
      listIdeas: async (
        novelId: string,
        options?: { status?: string }
      ): Promise<IdeaRow[]> => {
        const mine = store.filter((r) => r.novelId === novelId);
        if (options?.status !== undefined) {
          return mine.filter((r) => r.status === options.status);
        }
        return mine.filter((r) => r.status !== "rejected");
      },
      setIdeaStatus: async (id: string, status: string): Promise<IdeaRow> => {
        const found = store.find((r) => r.id === id);
        if (!found) {
          throw new Error(`Idea ${id}`);
        }
        found.status = status;
        return found;
      },
      updateIdea: async (
        id: string,
        data: { body?: string | null; title?: string }
      ): Promise<IdeaRow> => {
        const found = store.find((r) => r.id === id);
        if (!found) {
          throw new Error(`Idea ${id}`);
        }
        if (data.title !== undefined) {
          found.title = data.title;
        }
        if (data.body !== undefined) {
          found.body = data.body;
        }
        return found;
      },
    },
    setting: {
      listSettings: async () => [{ id: "s1", name: "大陸設定" }],
    },
    timeline: {
      listTimelines: async () => [{ event: "王国建国", id: "t1" }],
    },
  } as unknown as DomainServices;
}

async function createClient(
  auth: McpAuth | undefined,
  seed: IdeaRow[] = []
): Promise<{ client: Client; close: () => Promise<void> }> {
  const server = createNovelCreatorMcpServer(createStubServices(seed), {
    mcpAuth: auth,
  } as never);
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client(
    { name: "idea-store-test", version: "0.0.0" },
    { capabilities: {} }
  );
  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);
  return { client, close: async (): Promise<void> => client.close() };
}

function firstText(result: unknown): string {
  const r = result as {
    content: Array<{ text?: string; type: string }>;
    isError?: boolean;
  };
  const first = r.content[0];
  if (first?.type !== "text" || typeof first.text !== "string") {
    throw new Error("unexpected tool result shape");
  }
  return first.text;
}

function isErrorResult(result: unknown): boolean {
  return (result as { isError?: boolean }).isError === true;
}

describe("idea store tools", () => {
  it("create_ideaで作成できること", async () => {
    const { client, close } = await createClient(scopedAuth(NOVEL_ID));
    try {
      const result = await client.callTool({
        arguments: { novelId: NOVEL_ID, title: "逆転の鍵" },
        name: "create_idea",
      });
      expect(isErrorResult(result)).toBe(false);
      expect(firstText(result)).toContain("逆転の鍵");
    } finally {
      await close();
    }
  });

  it("list_ideasデフォルトで却下済みを除外すること", async () => {
    const seed: IdeaRow[] = [
      {
        body: null,
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        novelId: NOVEL_ID,
        source: null,
        status: "draft",
        title: "採用候補",
      },
      {
        body: null,
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        novelId: NOVEL_ID,
        source: null,
        status: "rejected",
        title: "ボツ案",
      },
    ];
    const { client, close } = await createClient(scopedAuth(NOVEL_ID), seed);
    try {
      const result = await client.callTool({
        arguments: { novelId: NOVEL_ID },
        name: "list_ideas",
      });
      const list = JSON.parse(firstText(result)) as IdeaRow[];
      expect(list.map((r) => r.title)).toContain("採用候補");
      expect(list.map((r) => r.title)).not.toContain("ボツ案");
    } finally {
      await close();
    }
  });

  it("list_ideasでstatus指定時は却下済みを返すこと", async () => {
    const seed: IdeaRow[] = [
      {
        body: null,
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        novelId: NOVEL_ID,
        source: null,
        status: "rejected",
        title: "ボツ案",
      },
    ];
    const { client, close } = await createClient(scopedAuth(NOVEL_ID), seed);
    try {
      const result = await client.callTool({
        arguments: { novelId: NOVEL_ID, status: "rejected" },
        name: "list_ideas",
      });
      const list = JSON.parse(firstText(result)) as IdeaRow[];
      expect(list.map((r) => r.title)).toContain("ボツ案");
    } finally {
      await close();
    }
  });

  it("update_ideaとset_idea_status遷移ができること（adopt時は誘導文付き）", async () => {
    const seed: IdeaRow[] = [
      {
        body: "旧メモ",
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        novelId: NOVEL_ID,
        source: null,
        status: "draft",
        title: "旧題",
      },
    ];
    const { client, close } = await createClient(scopedAuth(NOVEL_ID), seed);
    try {
      const updated = await client.callTool({
        arguments: {
          ideaId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          novelId: NOVEL_ID,
          title: "新題",
        },
        name: "update_idea",
      });
      expect(firstText(updated)).toContain("新題");
      const adopted = await client.callTool({
        arguments: {
          ideaId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          novelId: NOVEL_ID,
          status: "adopted",
        },
        name: "set_idea_status",
      });
      expect(firstText(adopted)).toContain("adopted");
      expect(firstText(adopted)).toContain("create_chapter等で反映");
    } finally {
      await close();
    }
  });

  it("スコープ不一致・所有者不一致はNotFound系エラーになること", async () => {
    const seed: IdeaRow[] = [
      {
        body: null,
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        novelId: NOVEL_ID,
        source: null,
        status: "draft",
        title: "他人の案",
      },
    ];
    const { client, close } = await createClient(
      scopedAuth(OTHER_NOVEL_ID),
      seed
    );
    try {
      const scoped = await client.callTool({
        arguments: { novelId: NOVEL_ID, title: "横断" },
        name: "create_idea",
      });
      expect(isErrorResult(scoped)).toBe(true);
      const owned = await client.callTool({
        arguments: {
          ideaId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          novelId: OTHER_NOVEL_ID,
          title: "乗っ取り",
        },
        name: "update_idea",
      });
      expect(isErrorResult(owned)).toBe(true);
      expect(firstText(owned)).toMatch(/Idea|NotFound|見つかりません/);
    } finally {
      await close();
    }
  });

  it("draw_story_seedsが構造化seedを返すこと（空要素は除外）", async () => {
    const { client, close } = await createClient(scopedAuth(NOVEL_ID));
    try {
      const result = await client.callTool({
        arguments: { count: 2, novelId: NOVEL_ID },
        name: "draw_story_seeds",
      });
      expect(isErrorResult(result)).toBe(false);
      const seeds = JSON.parse(firstText(result)) as Array<{
        character: string | null;
        prompt: string;
        setting: string | null;
        timeline: string | null;
      }>;
      expect(seeds).toHaveLength(2);
      for (const seedItem of seeds) {
        expect(typeof seedItem.prompt).toBe("string");
        expect(seedItem.prompt.length).toBeGreaterThan(0);
      }
    } finally {
      await close();
    }
  });
});
