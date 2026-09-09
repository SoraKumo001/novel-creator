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
const ADOPTED_IDEA_ID = "55555555-5555-4555-8555-555555555555";
const DRAFT_IDEA_ID = "66666666-6666-4666-8666-666666666666";
const UNKNOWN_IDEA_ID = "77777777-7777-4777-8777-777777777777";

function createStubServices(): DomainServices {
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
      listCharacters: async () => [characterRow],
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
    idea: {
      getIdea: async (id: string) => {
        if (id === ADOPTED_IDEA_ID) {
          return {
            body: "鍵は王家の証という展開メモ",
            id,
            novelId: NOVEL_ID,
            status: "adopted",
            title: "逆転の鍵",
          };
        }
        if (id === DRAFT_IDEA_ID) {
          return {
            body: "まだ温めている案",
            id,
            novelId: NOVEL_ID,
            status: "draft",
            title: "下書き案",
          };
        }
        throw new NotFoundError("Idea", id);
      },
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
  } as unknown as DomainServices;
}

async function createClient(auth: McpAuth | undefined): Promise<Client> {
  const server = createNovelCreatorMcpServer(createStubServices(), {
    mcpAuth: auth,
  } as never);
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client(
    { name: "guided-flow-test", version: "0.0.0" },
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

function promptText(result: {
  messages: Array<{ content?: { text?: string; type: string } }>;
}): string {
  const content = result.messages[0]?.content;
  if (content?.type !== "text" || typeof content.text !== "string") {
    throw new Error("unexpected prompt message shape");
  }
  return content.text;
}

describe("guided flow prompts", () => {
  it("character_monologueが独白+3案のmessages構造を返すこと", async () => {
    const client = await createClient(scopedAuth(NOVEL_ID));
    try {
      const result = await client.getPrompt({
        arguments: {
          characterId: CHAR_ID,
          novelId: NOVEL_ID,
          situation: "決戦前夜",
        },
        name: "character_monologue",
      });
      expect(result.messages.length).toBeGreaterThan(0);
      expect(result.messages[0]?.role).toBe("user");
      expect(result.messages[0]?.content?.type).toBe("text");
      const text = promptText(result);
      expect(text).toContain("アオイ");
      expect(text).toContain("3案");
      expect(text).toContain("review_consistency");
    } finally {
      await client.close();
    }
  });

  it("idea_to_outlineが採用済み案の落とし込み手順を返すこと", async () => {
    const client = await createClient(scopedAuth(NOVEL_ID));
    try {
      const result = await client.getPrompt({
        arguments: { ideaId: ADOPTED_IDEA_ID, novelId: NOVEL_ID },
        name: "idea_to_outline",
      });
      expect(result.messages.length).toBeGreaterThan(0);
      expect(result.messages[0]?.role).toBe("user");
      expect(result.messages[0]?.content?.type).toBe("text");
      const text = promptText(result);
      expect(text).toContain("逆転の鍵");
      for (const keyword of ["章", "節", "伏線"]) {
        expect(text).toContain(keyword);
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
          arguments: { characterId: CHAR_ID, novelId: NOVEL_ID },
          name: "character_monologue",
        })
      ).rejects.toThrow(/Novel/);
      await expect(
        client.getPrompt({
          arguments: { ideaId: ADOPTED_IDEA_ID, novelId: NOVEL_ID },
          name: "idea_to_outline",
        })
      ).rejects.toThrow(/Novel/);
    } finally {
      await client.close();
    }
  });

  it("存在しないideaId・characterIdはNotFoundになること", async () => {
    const client = await createClient(scopedAuth(NOVEL_ID));
    try {
      await expect(
        client.getPrompt({
          arguments: { ideaId: UNKNOWN_IDEA_ID, novelId: NOVEL_ID },
          name: "idea_to_outline",
        })
      ).rejects.toThrow(UNKNOWN_IDEA_ID);
      await expect(
        client.getPrompt({
          arguments: { characterId: UNKNOWN_CHAR_ID, novelId: NOVEL_ID },
          name: "character_monologue",
        })
      ).rejects.toThrow(UNKNOWN_CHAR_ID);
    } finally {
      await client.close();
    }
  });

  it("draft時は先にadoptの誘導文面を返すこと", async () => {
    const client = await createClient(scopedAuth(NOVEL_ID));
    try {
      const result = await client.getPrompt({
        arguments: { ideaId: DRAFT_IDEA_ID, novelId: NOVEL_ID },
        name: "idea_to_outline",
      });
      expect(result.messages.length).toBeGreaterThan(0);
      const text = promptText(result);
      expect(text).toContain("adopt");
      expect(text).toContain("下書き案");
    } finally {
      await client.close();
    }
  });
});
