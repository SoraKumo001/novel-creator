import { Code, ConnectError, type ConnectRouter } from '@connectrpc/connect';
import { GenerateService } from '@novel-creator/proto';

import type { AppContext } from '../context.js';
import { GenerateDomainService, NotFoundError } from '../core/index.js';

export function registerGenerateService(
  router: ConnectRouter,
  getContext: () => AppContext['Variables'],
) {
  router.service(GenerateService, {
    async generatePlot(req) {
      const service = new GenerateDomainService(getContext());
      try {
        const result = await service.generatePlot(req.novelId);
        return {
          title: result.title,
          description: result.description,
          chapters: result.chapters.map((ch) => ({
            title: ch.title,
            order: ch.order,
            summary: ch.summary,
          })),
        };
      } catch (err) {
        if (err instanceof NotFoundError) {
          throw new ConnectError(err.message, Code.NotFound);
        }
        throw err;
      }
    },

    async generateChapterSummary(req) {
      const service = new GenerateDomainService(getContext());
      try {
        const result = await service.generateChapterSummary(req.chapterId);
        return {
          title: result.title,
          order: result.order,
          summary: result.summary,
        };
      } catch (err) {
        if (err instanceof NotFoundError) {
          throw new ConnectError(err.message, Code.NotFound);
        }
        throw err;
      }
    },

    async generateSectionSummary(req) {
      const service = new GenerateDomainService(getContext());
      try {
        const result = await service.generateSectionSummary(req.sectionId);
        return {
          title: result.title,
          order: result.order,
          summary: result.summary,
        };
      } catch (err) {
        if (err instanceof NotFoundError) {
          throw new ConnectError(err.message, Code.NotFound);
        }
        throw err;
      }
    },

    async *generateSectionContent(req) {
      const service = new GenerateDomainService(getContext());
      try {
        for await (const chunk of service.generateSectionContent(req.sectionId)) {
          yield { chunk };
        }
      } catch (err) {
        if (err instanceof NotFoundError) {
          throw new ConnectError(err.message, Code.NotFound);
        }
        throw err;
      }
    },

    async extractEntities(req) {
      const service = new GenerateDomainService(getContext());
      try {
        return await service.extractEntities(req.sectionId);
      } catch (err) {
        if (err instanceof NotFoundError) {
          throw new ConnectError(err.message, Code.NotFound);
        }
        throw err;
      }
    },
  });
}
