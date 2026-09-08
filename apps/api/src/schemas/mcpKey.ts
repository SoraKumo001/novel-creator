import { z } from "zod";

// ---- MCP API キー発行 ----
export const createMcpKeySchema = z.object({
  expiresAt: z.iso.datetime({ offset: true }).optional().nullable(),
  name: z.string().min(1),
  novelId: z.string().uuid().optional().nullable(),
});
