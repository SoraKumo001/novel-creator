import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { parseEnv } from "@novel-creator/shared/env";
import { parse } from "dotenv";
import { createContext } from "../context.js";
import { createNovelCreatorMcpServer } from "./server.js";

function loadEnvSilently(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      const parsed = parse(content);
      for (const [key, value] of Object.entries(parsed)) {
        if (process.env[key] === undefined) {
          process.env[key] = value;
        }
      }
    }
  } catch {
    // ベストエフォートで読み込む
  }
}

async function main(): Promise<void> {
  // stdout へのバナー出力を防ぐため、静かに .env をロードする
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  loadEnvSilently(path.resolve(currentDir, "../../../../.env"));
  loadEnvSilently(path.resolve(currentDir, "../../../.env"));
  loadEnvSilently(path.resolve(process.cwd(), ".env"));

  // MCP では stdout が JSON-RPC メッセージ専用チャネルとなるため、ログはすべて stderr に出力する
  const env = parseEnv();
  process.stderr.write("[novel-creator-mcp] Initializing service context...\n");

  const context = createContext(env);
  const server = createNovelCreatorMcpServer(context.services, context);

  const transport = new StdioServerTransport();
  process.stderr.write(
    "[novel-creator-mcp] Connecting via StdioServerTransport...\n"
  );

  await server.connect(transport);
  process.stderr.write(
    "[novel-creator-mcp] MCP Server is running and listening on stdio.\n"
  );
}

main().catch((error) => {
  process.stderr.write(
    `[novel-creator-mcp] Fatal error: ${error instanceof Error ? error.stack || error.message : String(error)}\n`
  );
  process.exit(1);
});
