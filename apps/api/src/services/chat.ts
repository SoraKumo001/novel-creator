import { Code, ConnectError, type ConnectRouter } from '@connectrpc/connect';
import type { chatSessions } from '@novel-creator/db';
import { ChatService } from '@novel-creator/proto';

import type { AppContext } from '../context.js';
import { ChatDomainService, NotFoundError } from '../core/index.js';

function formatChatSession(row: typeof chatSessions.$inferSelect) {
  return {
    id: row.id,
    novelId: row.novelId ?? undefined,
    title: row.title,
    createdAt: row.createdAt ? row.createdAt.toISOString() : undefined,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : undefined,
  };
}

export function registerChatService(
  router: ConnectRouter,
  getContext: () => AppContext['Variables'],
) {
  router.service(ChatService, {
    async listChatSessions(req) {
      const service = new ChatDomainService(getContext());
      const rows = await service.listChatSessions(req.novelId || undefined);
      return {
        sessions: rows.map(formatChatSession),
      };
    },

    async getChatSession(req) {
      const service = new ChatDomainService(getContext());
      try {
        const { session, messages } = await service.getChatSessionWithMessages(req.id);
        return {
          session: formatChatSession(session),
          messages: messages.map((m) => ({
            id: m.id,
            sessionId: m.sessionId,
            role: m.role,
            content: m.content,
            createdAt: m.createdAt ? m.createdAt.toISOString() : undefined,
          })),
        };
      } catch (err) {
        if (err instanceof NotFoundError) {
          throw new ConnectError(err.message, Code.NotFound);
        }
        throw err;
      }
    },

    async createChatSession(req) {
      const service = new ChatDomainService(getContext());
      const session = await service.createChatSession({
        novelId: req.novelId || null,
        title: req.title,
        messages: req.messages.map((m) => ({
          role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
          content: m.content,
        })),
      });
      return formatChatSession(session);
    },

    async updateChatSession(req) {
      const service = new ChatDomainService(getContext());
      try {
        const session = await service.updateChatSession(req.id, {
          title: req.title,
        });
        return formatChatSession(session);
      } catch (err) {
        if (err instanceof NotFoundError) {
          throw new ConnectError(err.message, Code.NotFound);
        }
        throw err;
      }
    },

    async deleteChatSession(req) {
      const service = new ChatDomainService(getContext());
      try {
        await service.deleteChatSession(req.id);
        return { success: true };
      } catch (err) {
        if (err instanceof NotFoundError) {
          throw new ConnectError(err.message, Code.NotFound);
        }
        throw err;
      }
    },

    async extractEntities(req) {
      const service = new ChatDomainService(getContext());
      return service.extractEntities(req.text);
    },
  });
}
