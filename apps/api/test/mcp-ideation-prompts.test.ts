import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";

import type { DomainServices } from "../src/core/services.js";
import { type McpAuth, NotFoundError } from "../src/core/types.js";
import { createNovelCreatorMcpServer } from "../src/mcp/server.js";

const NOVEL_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_NOVEL_ID = "22222222-2222-4222-8222-222222222222";
const CHAR_ID = "33333333-3333-4333-8333-333333333333";
const UNKNOWN_CHAR_ID = "44444444-4444-4444-8444-444444444444";

const NEW_PROMPTS = [
  "twist_ideas",
  "what_if_brainstorm",
  "character_driven_plot",
  "evaluate_ideas",
  "plan_foreshadowing_payoff",
] as const;

function createStubServices(failCharacters = false): DomainServices {
  const characterRow = {
    category: "主人公",
    description: "秘密を抱えた剣士",
    id: CHAR_ID,
    name: "アオイ",
    novelId: NOVEL_ID,
    traits: ["冷静沈着"],
  };
  return {
    chapter: {
      getMarkdown: async () => "# 第一章\n## 第一節\n",
    },
    character: {
      getCharacter: async (id: string) => {
        if (id !== CHAR_ID) {
          throw new NotFoundError("Character", id);
        }
        return characterRow;
      },
      listCharacters: async () => {
        if (failCharacters) {
          throw new Error("character store down");
        }
        return [characterRow];
      },
    },
    foreshadowing: {
      getForeshadowingsByNovel: async () => [
        {
          description: "錆びた鍵の謎",
          id: "f1",
          status: "unresolved",
          title: "地下室の鍵",
        },
      ],
    },
    novel: {
      getNovelDetail: async () => ({
        novel: {
          description: "概要",
          storyOutline: "あらすじ",
          styleGuide: "文体",
          title: "テスト小説",
        },
      }),
    },
    setting: {
      listSettings: async () => [
        {
          category: "世界観",
          description: "魔法が残る大陸",
          id: "s1",
          name: "大陸設定",
        },
      ],
    },
    timeline: {
      listTimelines: async () => [
        { event: "王国建国", id: "t1", timestamp: "帝都暦1年" },
      ],
    },
  } as unknown as DomainServices;
}

async function createClient(
  auth: McpAuth | undefined,
  failCharacters = false
): Promise<Client> {
  const server = createNovelCreatorMcpServer(
    createStubServices(failCharacters),
    {
      mcpAuth: auth,
    } as never
  );
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client(
    { name: "ideation-test", version: "0.0.0" },
    { capabilities: {} }
  );
  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);
  return client;
}

function scopedAuth(novelId: string): McpAuth {
  return { keyId: "key-1", novelId, userId: "user-1" };
}

describe("ideation prompts", () => {
  it("5件の新規プロンプトが登録されていること", async () => {
    const client = await createClient(undefined);
    try {
      const names: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await client.listPrompts(
          cursor === undefined ? undefined : { cursor }
        );
        for (const p of page.prompts) {
          names.push(p.name);
        }
        cursor = page.nextCursor;
      } while (cursor !== undefined);
      expect(names).toHaveLength(10);
      for (const name of NEW_PROMPTS) {
        expect(names).toContain(name);
      }
    } finally {
      await client.close();
    }
  });

  it("新規5件がmessages構造を返すこと", async () => {
    const client = await createClient(scopedAuth(NOVEL_ID));
    try {
      const args: Record<string, Record<string, string>> = {
        character_driven_plot: { characterId: CHAR_ID, novelId: NOVEL_ID },
        evaluate_ideas: { ideas: "案A: 鍵は王家の証", novelId: NOVEL_ID },
        plan_foreshadowing_payoff: { novelId: NOVEL_ID },
        twist_ideas: { novelId: NOVEL_ID },
        what_if_brainstorm: {
          novelId: NOVEL_ID,
          premise: "もしも鍵が偽物だったら",
        },
      };
      for (const name of NEW_PROMPTS) {
        const result = await client.getPrompt({
          arguments: args[name] as Record<string, string>,
          name,
        });
        expect(result.messages.length).toBeGreaterThan(0);
        const first = result.messages[0];
        expect(first?.role).toBe("user");
        const content = first?.content;
        expect(content?.type).toBe("text");
      }
    } finally {
      await client.close();
    }
  });

  it("スコープ不一致でNotFoundになること", async () => {
    const client = await createClient(scopedAuth(OTHER_NOVEL_ID));
    try {
      await expect(
        client.getPrompt({
          arguments: { novelId: NOVEL_ID },
          name: "twist_ideas",
        })
      ).rejects.toThrow(/Novel/);
    } finally {
      await client.close();
    }
  });

  it("evaluate採点文面に4軸が含まれること", async () => {
    const client = await createClient(scopedAuth(NOVEL_ID));
    try {
      const result = await client.getPrompt({
        arguments: { ideas: "案A", novelId: NOVEL_ID },
        name: "evaluate_ideas",
      });
      const content = result.messages[0]?.content;
      expect(content?.type).toBe("text");
      const text = (content as { text: string }).text;
      for (const axis of ["新規性", "伏線整合", "キャラ一貫性", "執筆コスト"]) {
        expect(text).toContain(axis);
      }
    } finally {
      await client.close();
    }
  });

  it("存在しないcharacterIdはNotFoundになること", async () => {
    const client = await createClient(scopedAuth(NOVEL_ID));
    try {
      await expect(
        client.getPrompt({
          arguments: { characterId: UNKNOWN_CHAR_ID, novelId: NOVEL_ID },
          name: "character_driven_plot",
        })
      ).rejects.toThrow(UNKNOWN_CHAR_ID);
    } finally {
      await client.close();
    }
  });

  it("人物・時系列の取得失敗でも全体を落とさないこと", async () => {
    const client = await createClient(scopedAuth(NOVEL_ID), true);
    try {
      const result = await client.getPrompt({
        arguments: { novelId: NOVEL_ID },
        name: "plan_foreshadowing_payoff",
      });
      expect(result.messages.length).toBeGreaterThan(0);
    } finally {
      await client.close();
    }
  });
});
