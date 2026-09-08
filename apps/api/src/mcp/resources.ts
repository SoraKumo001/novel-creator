import {
  type McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DomainServices } from "../core/services.js";
import type { ServiceContext } from "../core/types.js";

/**
 * MCP リソース群を McpServer インスタンスへ登録する。
 */
export function registerMcpResources(
  server: McpServer,
  services: DomainServices,
  _ctx: ServiceContext
): void {
  // 小説サマリリソース: novel://{novelId}
  server.resource(
    "novel-summary",
    new ResourceTemplate("novel://{novelId}", { list: undefined }),
    async (uri, { novelId }) => {
      const id = String(novelId);
      const detail = await services.novel.getNovelDetail(id);
      return {
        contents: [
          {
            mimeType: "application/json",
            text: JSON.stringify(detail, null, 2),
            uri: uri.href,
          },
        ],
      };
    }
  );

  // プロット・あらすじリソース: novel://{novelId}/outline
  server.resource(
    "novel-outline",
    new ResourceTemplate("novel://{novelId}/outline", { list: undefined }),
    async (uri, { novelId }) => {
      const id = String(novelId);
      const markdown = await services.chapter.getMarkdown(id);
      return {
        contents: [
          {
            mimeType: "text/markdown",
            text: markdown,
            uri: uri.href,
          },
        ],
      };
    }
  );

  // 登場人物リソース: novel://{novelId}/characters
  server.resource(
    "novel-characters",
    new ResourceTemplate("novel://{novelId}/characters", { list: undefined }),
    async (uri, { novelId }) => {
      const id = String(novelId);
      const characters = await services.character.listCharacters(id);
      return {
        contents: [
          {
            mimeType: "application/json",
            text: JSON.stringify(characters, null, 2),
            uri: uri.href,
          },
        ],
      };
    }
  );

  // 世界観・設定リソース: novel://{novelId}/settings
  server.resource(
    "novel-settings",
    new ResourceTemplate("novel://{novelId}/settings", { list: undefined }),
    async (uri, { novelId }) => {
      const id = String(novelId);
      const settings = await services.setting.listSettings(id);
      return {
        contents: [
          {
            mimeType: "application/json",
            text: JSON.stringify(settings, null, 2),
            uri: uri.href,
          },
        ],
      };
    }
  );

  // 節本文リソース: novel://{novelId}/section/{sectionId}
  server.resource(
    "section-content",
    new ResourceTemplate("novel://{novelId}/section/{sectionId}", {
      list: undefined,
    }),
    async (uri, { sectionId }) => {
      const sId = String(sectionId);
      const sectionWithContent =
        await services.section.getSectionWithContent(sId);
      return {
        contents: [
          {
            mimeType: "application/json",
            text: JSON.stringify(sectionWithContent, null, 2),
            uri: uri.href,
          },
        ],
      };
    }
  );
}
