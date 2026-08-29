import { eq } from 'drizzle-orm';
import { foreshadowings, novels, type NewForeshadowing } from '@novel-creator/db';
import { assertFound, type ServiceContext } from './types.js';

export class ForeshadowingDomainService {
  constructor(private readonly ctx: ServiceContext) {}

  async getForeshadowingsByNovel(novelId: string) {
    return this.ctx.db
      .select()
      .from(foreshadowings)
      .where(eq(foreshadowings.novelId, novelId))
      .orderBy(foreshadowings.createdAt);
  }

  async getForeshadowing(id: string) {
    const [item] = await this.ctx.db.select().from(foreshadowings).where(eq(foreshadowings.id, id));
    assertFound(item, 'Foreshadowing not found');
    return item;
  }

  async createForeshadowing(
    novelId: string,
    input: Omit<NewForeshadowing, 'id' | 'novelId' | 'createdAt' | 'updatedAt'>,
  ) {
    const [novel] = await this.ctx.db.select().from(novels).where(eq(novels.id, novelId));
    assertFound(novel, 'Novel not found');

    const [created] = await this.ctx.db
      .insert(foreshadowings)
      .values({
        novelId,
        title: input.title,
        description: input.description,
        status: input.status ?? 'unresolved',
        placedSectionId: input.placedSectionId,
        resolvedSectionId: input.resolvedSectionId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return created;
  }

  async updateForeshadowing(
    id: string,
    input: Partial<Omit<NewForeshadowing, 'id' | 'novelId' | 'createdAt' | 'updatedAt'>>,
  ) {
    const [existing] = await this.ctx.db
      .select()
      .from(foreshadowings)
      .where(eq(foreshadowings.id, id));
    assertFound(existing, 'Foreshadowing not found');

    const [updated] = await this.ctx.db
      .update(foreshadowings)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.placedSectionId !== undefined ? { placedSectionId: input.placedSectionId } : {}),
        ...(input.resolvedSectionId !== undefined
          ? { resolvedSectionId: input.resolvedSectionId }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(foreshadowings.id, id))
      .returning();

    return updated;
  }

  async deleteForeshadowing(id: string) {
    const [existing] = await this.ctx.db
      .select()
      .from(foreshadowings)
      .where(eq(foreshadowings.id, id));
    assertFound(existing, 'Foreshadowing not found');

    await this.ctx.db.delete(foreshadowings).where(eq(foreshadowings.id, id));
  }
}
