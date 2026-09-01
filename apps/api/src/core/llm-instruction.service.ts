import { llmInstructions } from "@novel-creator/db";
import { and, desc, eq } from "drizzle-orm";
import { assertFound, type ServiceContext, ValidationError } from "./types.js";

export class LlmInstructionDomainService {
  constructor(private readonly ctx: ServiceContext) {}

  async listInstructions(novelId: string, entityType?: string) {
    const conditions = [eq(llmInstructions.novelId, novelId)];
    if (entityType) {
      conditions.push(eq(llmInstructions.entityType, entityType));
    }
    return this.ctx.db
      .select()
      .from(llmInstructions)
      .where(and(...conditions))
      .orderBy(desc(llmInstructions.createdAt));
  }

  async createInstruction(data: {
    novelId: string;
    entityType: string;
    instruction: string;
  }) {
    if (!data.instruction?.trim()) {
      throw new ValidationError("Instruction is required");
    }

    const [existing] = await this.ctx.db
      .select()
      .from(llmInstructions)
      .where(
        and(
          eq(llmInstructions.novelId, data.novelId),
          eq(llmInstructions.entityType, data.entityType),
          eq(llmInstructions.instruction, data.instruction)
        )
      );
    if (existing) {
      return existing;
    }

    const [row] = await this.ctx.db
      .insert(llmInstructions)
      .values({
        entityType: data.entityType,
        instruction: data.instruction,
        novelId: data.novelId,
      })
      .returning();
    return row;
  }

  async deleteInstruction(id: string) {
    const [row] = await this.ctx.db
      .delete(llmInstructions)
      .where(eq(llmInstructions.id, id))
      .returning();
    assertFound(row, "Instruction not found");
    return row;
  }
}
