import { Code, ConnectError, type ConnectRouter } from '@connectrpc/connect';
import type { characters } from '@novel-creator/db';
import { CharacterService } from '@novel-creator/proto';

import type { AppContext } from '../context.js';
import { CharacterDomainService, NotFoundError, ValidationError } from '../core/index.js';

function formatCharacter(row: typeof characters.$inferSelect) {
  return {
    id: row.id,
    novelId: row.novelId,
    category: row.category,
    name: row.name,
    description: row.description ?? undefined,
    traits: (row.traits as string[]) ?? [],
    relationshipsJson: JSON.stringify(row.relationships ?? {}),
    createdAt: row.createdAt ? row.createdAt.toISOString() : undefined,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : undefined,
  };
}

export function registerCharacterService(
  router: ConnectRouter,
  getContext: () => AppContext['Variables'],
) {
  router.service(CharacterService, {
    async listCharacters(req) {
      const service = new CharacterDomainService(getContext());
      const rows = await service.listCharacters(req.novelId);
      return {
        characters: rows.map(formatCharacter),
      };
    },

    async getCharacter(req) {
      const service = new CharacterDomainService(getContext());
      try {
        const character = await service.getCharacter(req.id);
        return formatCharacter(character);
      } catch (err) {
        if (err instanceof NotFoundError) {
          throw new ConnectError(err.message, Code.NotFound);
        }
        throw err;
      }
    },

    async createCharacter(req) {
      const service = new CharacterDomainService(getContext());
      let rel = {};
      try {
        if (req.relationshipsJson) {
          rel = JSON.parse(req.relationshipsJson);
        }
      } catch {
        rel = {};
      }

      try {
        const row = await service.createCharacter({
          novelId: req.novelId,
          category: req.category,
          name: req.name,
          description: req.description ?? null,
          traits: req.traits ?? [],
          relationships: rel,
        });
        return formatCharacter(row);
      } catch (err) {
        if (err instanceof ValidationError) {
          throw new ConnectError(err.message, Code.InvalidArgument);
        }
        throw err;
      }
    },

    async updateCharacter(req) {
      const service = new CharacterDomainService(getContext());
      let relUpdate: Record<string, unknown> | undefined;
      if (req.relationshipsJson !== undefined) {
        try {
          relUpdate = JSON.parse(req.relationshipsJson);
        } catch {
          relUpdate = {};
        }
      }

      try {
        const row = await service.updateCharacter(req.id, {
          category: req.category !== undefined ? req.category : undefined,
          name: req.name !== undefined ? req.name : undefined,
          description: req.description !== undefined ? req.description : undefined,
          traits: req.traits !== undefined ? req.traits : undefined,
          relationships: relUpdate,
        });
        return formatCharacter(row);
      } catch (err) {
        if (err instanceof NotFoundError) {
          throw new ConnectError(err.message, Code.NotFound);
        }
        throw err;
      }
    },

    async deleteCharacter(req) {
      const service = new CharacterDomainService(getContext());
      try {
        await service.deleteCharacter(req.id);
        return { success: true };
      } catch (err) {
        if (err instanceof NotFoundError) {
          throw new ConnectError(err.message, Code.NotFound);
        }
        throw err;
      }
    },

    async editCharacter(req) {
      const service = new CharacterDomainService(getContext());
      try {
        const row = await service.editCharacterWithInstruction(req.id, req.instruction);
        return formatCharacter(row);
      } catch (err) {
        if (err instanceof NotFoundError) {
          throw new ConnectError(err.message, Code.NotFound);
        }
        throw err;
      }
    },

    async getCharactersMarkdown(req) {
      const service = new CharacterDomainService(getContext());
      const markdown = await service.getMarkdown(req.novelId);
      return { markdown };
    },

    async saveCharactersMarkdown(req) {
      const service = new CharacterDomainService(getContext());
      const result = await service.saveMarkdown(req.novelId, req.markdown);
      return {
        characters: result.characters.map(formatCharacter),
        createdCount: result.createdCount,
        updatedCount: result.updatedCount,
        deletedCount: result.deletedCount,
      };
    },

    async editCharacterSection(req) {
      const service = new CharacterDomainService(getContext());
      const result = await service.editCharacterSection({
        novelId: req.novelId,
        category: req.category,
        name: req.name,
        description: req.description,
        traits: req.traits,
        relationships: req.relationships,
        instruction: req.instruction,
      });
      return {
        updatedCharacters: [],
        parsedSummary: result,
      };
    },

    async editCharacterDocument(req) {
      const service = new CharacterDomainService(getContext());
      const result = await service.editCharacterDocument(
        req.novelId,
        req.markdown,
        req.instruction,
      );
      return {
        updatedCharacters: [],
        parsedSummary: result,
      };
    },
  });
}
