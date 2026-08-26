import { Code, ConnectError, type ConnectRouter } from '@connectrpc/connect';
import type { settings } from '@novel-creator/db';
import { SettingService } from '@novel-creator/proto';

import type { AppContext } from '../context.js';
import { NotFoundError, SettingDomainService, ValidationError } from '../core/index.js';

function formatSetting(row: typeof settings.$inferSelect) {
  return {
    id: row.id,
    novelId: row.novelId,
    category: row.category,
    name: row.name,
    description: row.description ?? undefined,
    metadataJson: JSON.stringify(row.metadata ?? {}),
    createdAt: row.createdAt ? row.createdAt.toISOString() : undefined,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : undefined,
  };
}

export function registerSettingService(
  router: ConnectRouter,
  getContext: () => AppContext['Variables'],
) {
  router.service(SettingService, {
    async listSettings(req) {
      const service = new SettingDomainService(getContext());
      const rows = await service.listSettings(req.novelId, req.category || undefined);
      return {
        settings: rows.map(formatSetting),
      };
    },

    async getSetting(req) {
      const service = new SettingDomainService(getContext());
      try {
        const setting = await service.getSetting(req.id);
        return formatSetting(setting);
      } catch (err) {
        if (err instanceof NotFoundError) {
          throw new ConnectError(err.message, Code.NotFound);
        }
        throw err;
      }
    },

    async createSetting(req) {
      const service = new SettingDomainService(getContext());
      let meta = {};
      try {
        if (req.metadataJson) {
          meta = JSON.parse(req.metadataJson);
        }
      } catch {
        meta = {};
      }

      try {
        const row = await service.createSetting({
          novelId: req.novelId,
          category: req.category,
          name: req.name,
          description: req.description ?? null,
          metadata: meta,
        });
        return formatSetting(row);
      } catch (err) {
        if (err instanceof ValidationError) {
          throw new ConnectError(err.message, Code.InvalidArgument);
        }
        throw err;
      }
    },

    async updateSetting(req) {
      const service = new SettingDomainService(getContext());
      let metaUpdate: Record<string, unknown> | undefined;
      if (req.metadataJson !== undefined) {
        try {
          metaUpdate = JSON.parse(req.metadataJson);
        } catch {
          metaUpdate = {};
        }
      }

      try {
        const row = await service.updateSetting(req.id, {
          category: req.category !== undefined ? req.category : undefined,
          name: req.name !== undefined ? req.name : undefined,
          description: req.description !== undefined ? req.description : undefined,
          metadata: metaUpdate,
        });
        return formatSetting(row);
      } catch (err) {
        if (err instanceof NotFoundError) {
          throw new ConnectError(err.message, Code.NotFound);
        }
        throw err;
      }
    },

    async deleteSetting(req) {
      const service = new SettingDomainService(getContext());
      try {
        await service.deleteSetting(req.id);
        return { success: true };
      } catch (err) {
        if (err instanceof NotFoundError) {
          throw new ConnectError(err.message, Code.NotFound);
        }
        throw err;
      }
    },

    async editSetting(req) {
      const service = new SettingDomainService(getContext());
      try {
        const row = await service.editSettingWithInstruction(req.id, req.instruction);
        return formatSetting(row);
      } catch (err) {
        if (err instanceof NotFoundError) {
          throw new ConnectError(err.message, Code.NotFound);
        }
        throw err;
      }
    },

    async generateDraft(req) {
      const service = new SettingDomainService(getContext());
      const result = await service.generateDraft(req.query, req.category);
      return {
        name: result.name,
        description: result.description,
        category: result.category,
        metadataJson: '{}',
      };
    },

    async getSettingsMarkdown(req) {
      const service = new SettingDomainService(getContext());
      const markdown = await service.getMarkdown(req.novelId);
      return { markdown };
    },

    async saveSettingsMarkdown(req) {
      const service = new SettingDomainService(getContext());
      const result = await service.saveMarkdown(req.novelId, req.markdown);
      return {
        settings: result.settings.map(formatSetting),
        createdCount: result.createdCount,
        updatedCount: result.updatedCount,
        deletedCount: result.deletedCount,
      };
    },

    async editSettingSection(req) {
      const service = new SettingDomainService(getContext());
      const result = await service.editSettingSection({
        novelId: req.novelId,
        category: req.category,
        name: req.name,
        description: req.description,
        instruction: req.instruction,
      });
      return {
        updatedSettings: [],
        parsedSummary: result,
      };
    },

    async editSettingDocument(req) {
      const service = new SettingDomainService(getContext());
      const result = await service.editSettingDocument(req.novelId, req.markdown, req.instruction);
      return {
        updatedSettings: [],
        parsedSummary: result,
      };
    },
  });
}
