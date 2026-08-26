import { Code, ConnectError, type ConnectRouter } from '@connectrpc/connect';
import { BackupService } from '@novel-creator/proto';

import type { AppContext } from '../context.js';
import {
  BackupDomainService,
  NotFoundError,
  ValidationError,
  type BackupBody,
} from '../core/index.js';

export function registerBackupService(
  router: ConnectRouter,
  getContext: () => AppContext['Variables'],
) {
  router.service(BackupService, {
    async exportNovel(req) {
      const service = new BackupDomainService(getContext());
      try {
        const exportData = await service.exportNovel(req.novelId);
        return {
          jsonData: JSON.stringify(exportData),
        };
      } catch (err) {
        if (err instanceof NotFoundError) {
          throw new ConnectError(err.message, Code.NotFound);
        }
        throw err;
      }
    },

    async importNovel(req) {
      const service = new BackupDomainService(getContext());
      let body: BackupBody;
      try {
        body = JSON.parse(req.jsonData) as BackupBody;
      } catch {
        throw new ConnectError('Invalid JSON data', Code.InvalidArgument);
      }

      try {
        const result = await service.importNovel(body);
        return {
          success: true,
          novelId: result.novelId,
        };
      } catch (err) {
        if (err instanceof ValidationError) {
          throw new ConnectError(err.message, Code.InvalidArgument);
        }
        throw err;
      }
    },
  });
}
