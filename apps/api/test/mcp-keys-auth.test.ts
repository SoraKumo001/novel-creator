import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createMcpKey, revokeMcpKey } from "../src/core/mcp-key.service.js";
import { ForbiddenError, ValidationError } from "../src/core/types.js";

type Row = Record<string, unknown>;

function createFakeMcpDb() {
  const novelsList: Row[] = [];
  const novelMembersList: Row[] = [];
  const keysList: Row[] = [];

  const db = {
    insert: (_table: unknown) => ({
      values: (value: Row) => ({
        returning: async (): Promise<Row[]> => {
          const now = new Date();
          const row: Row = {
            createdAt: now,
            updatedAt: now,
            ...value,
            id: (value["id"] as string | undefined) ?? randomUUID(),
          };
          keysList.push(row);
          return [row];
        },
      }),
    }),
    select: (fields?: unknown) => ({
      from: (table: unknown) => {
        if (
          table &&
          typeof table === "object" &&
          "title" in table &&
          !("novelId" in table)
        ) {
          return {
            where: async (cond: unknown) => novelsList,
          };
        }
        if (
          table &&
          typeof table === "object" &&
          "role" in table &&
          "novelId" in table
        ) {
          return {
            where: async (cond: unknown) => novelMembersList,
          };
        }
        return {
          leftJoin: (_joinTable: unknown, _on: unknown) => ({
            orderBy: async () =>
              keysList.map((k) => ({
                ...k,
                novelTitle:
                  novelsList.find((n) => n["id"] === k["novelId"])?.["title"] ??
                  null,
              })),
            where: (..._conds: unknown[]) => ({
              orderBy: async () =>
                keysList.map((k) => ({
                  ...k,
                  novelTitle:
                    novelsList.find((n) => n["id"] === k["novelId"])?.[
                      "title"
                    ] ?? null,
                })),
            }),
          }),
          where: async (cond: unknown) => keysList,
        };
      },
    }),
    update: (_table: unknown) => ({
      set: (patch: Row) => ({
        where: (..._conds: unknown[]) => ({
          returning: async (): Promise<Row[]> => {
            if (keysList[0]) {
              Object.assign(keysList[0], patch);
              return [keysList[0]];
            }
            return [];
          },
        }),
      }),
    }),
  };

  return { db, keysList, novelMembersList, novelsList };
}

describe("MCP Keys Novel & User Association", () => {
  const env = { MASTER_SECRET: "test-master-secret-for-mcp-keys-1234" };
  const userA = { id: "user-a", role: "user" };
  const userB = { id: "user-b", role: "user" };
  const adminUser = { id: "admin-user", role: "admin" };
  const novelId = randomUUID();

  it("一般ユーザーは自身の参加作品に対して MCP キーを発行できること", async () => {
    const { db, novelsList, novelMembersList } = createFakeMcpDb();
    novelsList.push({ id: novelId, title: "テスト小説A" });
    novelMembersList.push({ id: randomUUID(), novelId, userId: userA.id });

    const result = await createMcpKey(
      db as never,
      {
        name: "user-a-key",
        novelId,
        userId: userA.id,
      },
      env,
      userA
    );

    expect(result.plainKey).toMatch(/^mcp_/);
    expect(result.record.novelId).toBe(novelId);
    expect(result.record.userId).toBe(userA.id);
  });

  it("一般ユーザーは参加していない作品のキーを発行しようとすると ForbiddenError になること", async () => {
    const { db, novelsList } = createFakeMcpDb();
    novelsList.push({ id: novelId, title: "テスト小説A" });

    await expect(
      createMcpKey(
        db as never,
        {
          name: "user-b-key",
          novelId,
          userId: userB.id,
        },
        env,
        userB
      )
    ).rejects.toThrow(ForbiddenError);
  });

  it("管理者はメンバーシップがなくてもキーを発行できること", async () => {
    const { db, novelsList } = createFakeMcpDb();
    novelsList.push({ id: novelId, title: "テスト小説A" });

    const result = await createMcpKey(
      db as never,
      {
        name: "admin-key",
        novelId,
        userId: adminUser.id,
      },
      env,
      adminUser
    );

    expect(result.plainKey).toMatch(/^mcp_/);
    expect(result.record.novelId).toBe(novelId);
  });

  it("キー名や novelId が空の場合は ValidationError になること", async () => {
    const { db } = createFakeMcpDb();

    await expect(
      createMcpKey(
        db as never,
        {
          name: "",
          novelId,
          userId: userA.id,
        },
        env,
        userA
      )
    ).rejects.toThrow(ValidationError);

    await expect(
      createMcpKey(
        db as never,
        {
          name: "valid-name",
          novelId: "",
          userId: userA.id,
        },
        env,
        userA
      )
    ).rejects.toThrow(ValidationError);
  });

  it("一般ユーザーが他人のキーを失効しようとすると ForbiddenError になること", async () => {
    const { db, keysList } = createFakeMcpDb();
    const keyId = randomUUID();
    keysList.push({
      createdAt: new Date(),
      id: keyId,
      name: "user-a-key",
      novelId,
      userId: userA.id,
    });

    await expect(revokeMcpKey(db as never, keyId, userB)).rejects.toThrow(
      ForbiddenError
    );
  });

  it("自身のキーまたは管理者はキーを失効できること", async () => {
    const { db, keysList } = createFakeMcpDb();
    const keyId = randomUUID();
    keysList.push({
      createdAt: new Date(),
      id: keyId,
      name: "user-a-key",
      novelId,
      userId: userA.id,
    });

    const revoked = await revokeMcpKey(db as never, keyId, userA);
    expect(revoked.revokedAt).toBeDefined();

    const keyId2 = randomUUID();
    keysList[0] = {
      createdAt: new Date(),
      id: keyId2,
      name: "user-a-key-2",
      novelId,
      userId: userA.id,
    };
    const revokedByAdmin = await revokeMcpKey(db as never, keyId2, adminUser);
    expect(revokedByAdmin.revokedAt).toBeDefined();
  });
});
