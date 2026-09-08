import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { DomainServices } from "../core/services.js";
import type { ServiceContext } from "../core/types.js";

/**
 * MCP プロンプト群を McpServer インスタンスへ登録する。
 */
export function registerMcpPrompts(
  server: McpServer,
  services: DomainServices,
  _ctx: ServiceContext
): void {
  // 節本文の執筆プロンプト
  server.prompt(
    "draft_section",
    "指定された節（シーン）の本文を初稿執筆するためのプロンプト。プロット、前後の文脈、設定、人物情報を統合して執筆を促します。",
    {
      instructions: z
        .string()
        .optional()
        .describe(
          "追加の執筆指示（例: テンポよく会話中心で、戦闘の緊迫感を強調して、など）"
        ),
      novelId: z.string().describe("小説ID (UUID)"),
      sectionId: z.string().describe("執筆対象の節ID (UUID)"),
    },
    async ({ novelId, sectionId, instructions }) => {
      const [novelDetail, sectionData, characters, settings] =
        await Promise.all([
          services.novel.getNovelDetail(novelId),
          services.section.getSectionWithContent(sectionId),
          services.character.listCharacters(novelId),
          services.setting.listSettings(novelId),
        ]);

      const styleGuide = novelDetail.novel.styleGuide || "指定なし";
      const sectionSummary = sectionData.section.summary || "概要なし";
      const existingBody = sectionData.content?.body || "（未執筆）";

      const charSummary = characters
        .map((c) => `- ${c.name} (${c.category}): ${c.description || ""}`)
        .join("\n");
      const settingSummary = settings
        .map((s) => `- ${s.name} [${s.category}]: ${s.description || ""}`)
        .join("\n");

      return {
        messages: [
          {
            content: {
              text: `あなたはプロの小説家です。以下の作品設定およびシーン概要に基づいて、節本文を執筆してください。

【作品情報】
タイトル: ${novelDetail.novel.title}
執筆方針・文体ルール:
${styleGuide}

【執筆対象の節】
節タイトル: ${sectionData.section.title || `第${sectionData.section.order}節`}
節の出来事・あらすじ:
${sectionSummary}

【現在の本文】
${existingBody}

【登場人物】
${charSummary || "登録なし"}

【世界観・設定】
${settingSummary || "登録なし"}

${instructions ? `【追加執筆指示】\n${instructions}\n` : ""}
【指示】
上記の文脈を踏まえ、臨場感あふれる描写と魅力的な対話で本文を執筆してください。
執筆が完了したら、ツール \`save_section_content\` を呼び出して本文を保存してください。`,
              type: "text",
            },
            role: "user",
          },
        ],
      };
    }
  );

  // 整合性レビュー・校正プロンプト
  server.prompt(
    "review_consistency",
    "指定された節の本文について、設定・キャラクター設定・伏線との矛盾がないかレビュー・推敲案を提示するプロンプト。",
    {
      novelId: z.string().describe("小説ID (UUID)"),
      sectionId: z.string().describe("対象の節ID (UUID)"),
    },
    async ({ novelId, sectionId }) => {
      const [novelDetail, sectionData, characters, settings, foreshadowings] =
        await Promise.all([
          services.novel.getNovelDetail(novelId),
          services.section.getSectionWithContent(sectionId),
          services.character.listCharacters(novelId),
          services.setting.listSettings(novelId),
          services.foreshadowing.getForeshadowingsByNovel(novelId),
        ]);

      const body = sectionData.content?.body;
      if (!body) {
        return {
          messages: [
            {
              content: {
                text: `節 (ID: ${sectionId}) にはまだ本文が保存されていません。まずは執筆を行ってください。`,
                type: "text",
              },
              role: "user",
            },
          ],
        };
      }

      return {
        messages: [
          {
            content: {
              text: `あなたは敏腕編集者です。以下の本文を精読し、登録されている設定・キャラクター口調・伏線との整合性を徹底的に検証してください。

【作品タイトル】: ${novelDetail.novel.title}

【本文 (節: ${sectionData.section.title || sectionData.section.order})】
${body}

【登録キャラクター】
${characters.map((c) => `- ${c.name} (${c.category}): ${c.description || ""}`).join("\n")}

【世界観・設定ルール】
${settings.map((s) => `- ${s.name} [${s.category}]: ${s.description || ""}`).join("\n")}

【伏線一覧】
${foreshadowings.map((f) => `- ${f.title} (${f.status}): ${f.description || ""}`).join("\n")}

【検証項目】
1. キャラクターの言動・口調・性格に設定とのブレや崩壊がないか
2. 世界観ルールや魔法・地理などの設定に矛盾がないか
3. 伏線の設置または回収として適切に機能しているか
4. 表現の重複、表記揺れ、テンポ改善のアドバイス
5. 改善リライト案`,
              type: "text",
            },
            role: "user",
          },
        ],
      };
    }
  );

  // プロット展開ブレインストーミングプロンプト
  server.prompt(
    "brainstorm_plot",
    "未回収の伏線や既存の設定をもとに、今後の展開や新展開のアイデア出しを行うプロンプト。",
    {
      focusTopic: z
        .string()
        .optional()
        .describe("特に掘り下げたい論点・キャラクター・課題"),
      novelId: z.string().describe("小説ID (UUID)"),
    },
    async ({ novelId, focusTopic }) => {
      const [novelDetail, outlineMarkdown, unresolvedForeshadowings] =
        await Promise.all([
          services.novel.getNovelDetail(novelId),
          services.chapter.getMarkdown(novelId),
          services.foreshadowing
            .getForeshadowingsByNovel(novelId)
            .then((list) => list.filter((f) => f.status === "unresolved")),
        ]);

      return {
        messages: [
          {
            content: {
              text: `あなたはストーリー構成のプロフェッショナルです。以下の小説の現在のプロットと未回収の伏線をもとに、今後の魅力的な展開や驚きのあるクリフハンガーのアイデアを提案してください。

【作品タイトル】: ${novelDetail.novel.title}
【作品あらすじ】: ${novelDetail.novel.storyOutline || novelDetail.novel.description || "なし"}

【現在のプロット構成】
${outlineMarkdown}

【未回収の伏線】
${
  unresolvedForeshadowings
    .map((f) => `- ${f.title}: ${f.description || ""}`)
    .join("\n") || "未回収の伏線はありません"
}

${focusTopic ? `【注力したい論点】: ${focusTopic}\n` : ""}
【提案内容】
- 読者を惹きつける展開の候補（2〜3案）
- 未回収の伏線を活かした意外な真相や回収タイミングの提案
- 次の章や節に追加すべきシーンのアイデア
気に入った案があれば、MCPツール \`create_chapter\` や \`create_section\`、\`create_foreshadowing\` で即座に作品に反映できます。`,
              type: "text",
            },
            role: "user",
          },
        ],
      };
    }
  );
}
