import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { DomainServices } from "../core/services.js";
import { NotFoundError, type ServiceContext } from "../core/types.js";
import { assertNovelScope } from "./scope-guard.js";
import { assertSectionBelongsToNovel } from "./section-guard.js";

/**
 * 一覧取得の失敗時は空配列にフォールバックし、プロンプト全体を落とさない。
 */
async function listSafely<T>(task: Promise<T[]>): Promise<T[]> {
  try {
    return await task;
  } catch {
    return [];
  }
}

/**
 * MCP プロンプト群を McpServer インスタンスへ登録する。
 * novelId を受け取る入口では先にスコープガードを適用する。
 */
export function registerMcpPrompts(
  server: McpServer,
  services: DomainServices,
  ctx: ServiceContext
): void {
  const auth = ctx.mcpAuth; // 節本文の執筆プロンプト
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
      assertNovelScope(auth, novelId);
      const [novelDetail, sectionData, characters, settings] =
        await Promise.all([
          services.novel.getNovelDetail(novelId),
          assertSectionBelongsToNovel(services, novelId, sectionId),
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
      assertNovelScope(auth, novelId);
      const [novelDetail, sectionData, characters, settings, foreshadowings] =
        await Promise.all([
          services.novel.getNovelDetail(novelId),
          assertSectionBelongsToNovel(services, novelId, sectionId),
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
      assertNovelScope(auth, novelId);
      const [
        novelDetail,
        outlineMarkdown,
        unresolvedForeshadowings,
        characters,
        timelines,
      ] = await Promise.all([
        services.novel.getNovelDetail(novelId),
        services.chapter.getMarkdown(novelId),
        services.foreshadowing
          .getForeshadowingsByNovel(novelId)
          .then((list) => list.filter((f) => f.status === "unresolved")),
        listSafely(services.character.listCharacters(novelId)),
        listSafely(services.timeline.listTimelines(novelId)),
      ]);

      const charSummary = characters
        .map((c) => `- ${c.name} (${c.category}): ${c.description || ""}`)
        .join("\n");
      const timelineSummary = timelines
        .map((t) => `- ${t.timestamp || "時期不明"}: ${t.event}`)
        .join("\n");

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
【登場人物】
${charSummary || "登録なし"}

【作中時系列】
${timelineSummary || "登録なし"}

【提案内容】
- 読者を惹きつける展開の候補（2〜3案）
- 未回収の伏線を活かした意外な真相や回収タイミングの提案
- 次の章や節に追加すべきシーンのアイデア
次の進め方（ガイド付きフロー）: 発散（brainstorm_plot/twist_ideas/what_if_brainstorm/draw_story_seeds）→保存（create_idea）→評価（evaluate_ideas）→採用（set_idea_status adopted）→反映（idea_to_outline→create_chapter等）。`,
              type: "text",
            },
            role: "user",
          },
        ],
      };
    }
  );

  // どんでん返し発想プロンプト
  server.prompt(
    "twist_ideas",
    "未回収伏線と人物の秘密を起点に、読者を驚かせるどんでん返し案を2〜3案発想するプロンプト。",
    {
      focusTopic: z
        .string()
        .optional()
        .describe("特に掘り下げたい論点・人物・課題"),
      novelId: z.string().describe("小説ID (UUID)"),
    },
    async ({ novelId, focusTopic }) => {
      assertNovelScope(auth, novelId);
      const [novelDetail, foreshadowings, characters, timelines] =
        await Promise.all([
          services.novel.getNovelDetail(novelId),
          services.foreshadowing
            .getForeshadowingsByNovel(novelId)
            .then((list) => list.filter((f) => f.status === "unresolved")),
          listSafely(services.character.listCharacters(novelId)),
          listSafely(services.timeline.listTimelines(novelId)),
        ]);

      return {
        messages: [
          {
            content: {
              text: `あなたは大どんでん返しを得意とするミステリ作家です。以下の未回収伏線と人物の秘密を起点に、読者の予想を裏切る真相・正体の案を2〜3案ひねり出してください。

【作品タイトル】: ${novelDetail.novel.title}
【作品あらすじ】: ${novelDetail.novel.storyOutline || novelDetail.novel.description || "なし"}

【未回収の伏線】
${foreshadowings.map((f) => `- ${f.title}: ${f.description || ""}`).join("\n") || "未回収の伏線はありません"}

【登場人物と秘密の種】
${characters.map((c) => `- ${c.name} (${c.category}): ${c.description || ""} / 特徴: ${(c.traits || []).join("、") || "なし"}`).join("\n") || "登録なし"}

【作中時系列】
${timelines.map((t) => `- ${t.timestamp || "時期不明"}: ${t.event}`).join("\n") || "登録なし"}

${focusTopic ? `【注力したい論点】: ${focusTopic}\n` : ""}
【提案内容】
- どんでん返し案2〜3案（各案: 仕掛け・真相・読者へのミスリードの種明かし）
- 各案がどの伏線・人物の秘密と結びつくか
- 最も衝撃が大きい推し案1件
次の進め方（ガイド付きフロー）: 発散（brainstorm_plot/twist_ideas/what_if_brainstorm/draw_story_seeds）→保存（create_idea）→評価（evaluate_ideas）→採用（set_idea_status adopted）→反映（idea_to_outline→create_chapter等）。`,
              type: "text",
            },
            role: "user",
          },
        ],
      };
    }
  );

  // 「もしも」分岐発想プロンプト
  server.prompt(
    "what_if_brainstorm",
    "「もしも」の前提から物語の展開分岐を3案発想するプロンプト。",
    {
      novelId: z.string().describe("小説ID (UUID)"),
      premise: z
        .string()
        .describe("「もしも」の前提（例: もしも主人公が裏切ったら）"),
    },
    async ({ novelId, premise }) => {
      assertNovelScope(auth, novelId);
      const [novelDetail, outlineMarkdown, characters] = await Promise.all([
        services.novel.getNovelDetail(novelId),
        services.chapter.getMarkdown(novelId),
        listSafely(services.character.listCharacters(novelId)),
      ]);

      return {
        messages: [
          {
            content: {
              text: `あなたは分岐物語の名手です。以下の作品世界に「もしも」の前提を投入し、そこから分かれる展開を3案提案してください。

【作品タイトル】: ${novelDetail.novel.title}
【作品あらすじ】: ${novelDetail.novel.storyOutline || novelDetail.novel.description || "なし"}

【現在のプロット構成】
${outlineMarkdown}

【登場人物】
${characters.map((c) => `- ${c.name} (${c.category}): ${c.description || ""}`).join("\n") || "登録なし"}

【もしもの前提】
${premise}

【提案内容】
- 前提から分岐する展開3案（各案: きっかけ・中盤の山場・結末の方向性）
- 各案で輝く人物と必要な新設定・新伏線
- 最も物語が加速する推し案1件
次の進め方（ガイド付きフロー）: 発散（brainstorm_plot/twist_ideas/what_if_brainstorm/draw_story_seeds）→保存（create_idea）→評価（evaluate_ideas）→採用（set_idea_status adopted）→反映（idea_to_outline→create_chapter等）。`,
              type: "text",
            },
            role: "user",
          },
        ],
      };
    }
  );

  // 人物駆動プロット発想プロンプト
  server.prompt(
    "character_driven_plot",
    "人物の欲求と秘密を起点に、その人物らしい行動連鎖から生まれる展開案を発想するプロンプト。",
    {
      characterId: z
        .string()
        .optional()
        .describe("起点にする登場人物ID (UUID、省略時は主要人物から選択)"),
      novelId: z.string().describe("小説ID (UUID)"),
    },
    async ({ novelId, characterId }) => {
      assertNovelScope(auth, novelId);
      const focus = characterId
        ? await services.character.getCharacter(characterId)
        : null;
      if (focus) {
        assertNovelScope(auth, focus.novelId);
      }
      const [novelDetail, characters, timelines] = await Promise.all([
        services.novel.getNovelDetail(novelId),
        listSafely(services.character.listCharacters(novelId)),
        listSafely(services.timeline.listTimelines(novelId)),
      ]);

      return {
        messages: [
          {
            content: {
              text: `あなたは人物造形の達人です。以下の人物の欲求と秘密を起点に、その人物にしかできない選択と行動の連鎖から生まれる展開案を提案してください。

【作品タイトル】: ${novelDetail.novel.title}

${focus ? `【起点人物】: ${focus.name} (${focus.category})\n欲求・背景: ${focus.description || "なし"}\n特徴: ${(focus.traits || []).join("、") || "なし"}\n` : "【起点人物】: 指定なし（主要人物の中から最も物語を動かせる人物を選んでください）\n"}
【登場人物一覧】
${characters.map((c) => `- ${c.name} (${c.category}): ${c.description || ""}`).join("\n") || "登録なし"}

【作中時系列】
${timelines.map((t) => `- ${t.timestamp || "時期不明"}: ${t.event}`).join("\n") || "登録なし"}

【提案内容】
- 人物の欲求・秘密が引き起こす行動連鎖案（発端・葛藤・決断の3連鎖）
- 周囲の人物を巻き込む波紋と対立構造
- その人物の魅力が最も輝く推し案1件
次の進め方（ガイド付きフロー）: 発散（brainstorm_plot/twist_ideas/what_if_brainstorm/draw_story_seeds）→保存（create_idea）→評価（evaluate_ideas）→採用（set_idea_status adopted）→反映（idea_to_outline→create_chapter等）。`,
              type: "text",
            },
            role: "user",
          },
        ],
      };
    }
  );

  // アイデア評価プロンプト
  server.prompt(
    "evaluate_ideas",
    "渡された案を新規性・伏線整合・キャラ一貫性・執筆コストの4軸で採点し、推し案を1件選ぶプロンプト。",
    {
      ideas: z.string().describe("評価したい案のテキスト"),
      novelId: z.string().describe("小説ID (UUID)"),
    },
    async ({ novelId, ideas }) => {
      assertNovelScope(auth, novelId);
      const [novelDetail, foreshadowings, characters] = await Promise.all([
        services.novel.getNovelDetail(novelId),
        services.foreshadowing.getForeshadowingsByNovel(novelId),
        listSafely(services.character.listCharacters(novelId)),
      ]);

      return {
        messages: [
          {
            content: {
              text: `あなたは厳格な編集者兼プロデューサーです。以下の案を作品文脈に照らして採点し、推し案を1件選んでください。

【作品タイトル】: ${novelDetail.novel.title}
【作品あらすじ】: ${novelDetail.novel.storyOutline || novelDetail.novel.description || "なし"}

【伏線一覧（回収状態つき）】
${foreshadowings.map((f) => `- ${f.title} (${f.status}): ${f.description || ""}`).join("\n") || "登録なし"}

【登場人物】
${characters.map((c) => `- ${c.name} (${c.category}): ${c.description || ""}`).join("\n") || "登録なし"}

【評価対象の案】
${ideas}

【採点軸（各10点満点）】
1. 新規性: 読者を驚かせられるか、既視感はないか
2. 伏線整合: 既存の伏線と矛盾せず、回収に活かせるか
3. キャラ一貫性: 人物の言動・口調・動機とブレがないか
4. 執筆コスト: 現実的な分量・工数で書けるか

【出力】
- 各案の4軸スコア表と合計点
- 減点理由の具体的な指摘
- 推し案1件と、その採用プラン（追加すべき章・節・伏線）
推し案が決まったら、MCPツール \`create_chapter\` や \`create_section\` で作品に反映してください。`,
              type: "text",
            },
            role: "user",
          },
        ],
      };
    }
  );

  // 伏線回収計画プロンプト
  server.prompt(
    "plan_foreshadowing_payoff",
    "未回収伏線と人物・設定・時系列を組み合わせた回収計画表を作るプロンプト。",
    {
      novelId: z.string().describe("小説ID (UUID)"),
    },
    async ({ novelId }) => {
      assertNovelScope(auth, novelId);
      const [novelDetail, foreshadowings, characters, settings, timelines] =
        await Promise.all([
          services.novel.getNovelDetail(novelId),
          services.foreshadowing
            .getForeshadowingsByNovel(novelId)
            .then((list) => list.filter((f) => f.status === "unresolved")),
          listSafely(services.character.listCharacters(novelId)),
          listSafely(services.setting.listSettings(novelId)),
          listSafely(services.timeline.listTimelines(novelId)),
        ]);

      return {
        messages: [
          {
            content: {
              text: `あなたは伏線回収の職人です。以下の未回収伏線を人物・設定・時系列と組み合わせ、回収計画表を作ってください。

【作品タイトル】: ${novelDetail.novel.title}

【未回収の伏線】
${foreshadowings.map((f) => `- ${f.title}: ${f.description || ""}`).join("\n") || "未回収の伏線はありません"}

【登場人物】
${characters.map((c) => `- ${c.name} (${c.category}): ${c.description || ""}`).join("\n") || "登録なし"}

【世界観・設定】
${settings.map((s) => `- ${s.name} [${s.category}]: ${s.description || ""}`).join("\n") || "登録なし"}

【作中時系列】
${timelines.map((t) => `- ${t.timestamp || "時期不明"}: ${t.event}`).join("\n") || "登録なし"}

【出力：回収計画表】
| 伏線 | 回収を担う人物 | 使う設定・ルール | 回収タイミング（時系列上の位置） | 回収シーン案 |
各行を埋め、回収順のおすすめ（伏線の束ね方）と、回収後に残る新伏線の種も1件添えてください。
次の進め方（ガイド付きフロー）: 発散（brainstorm_plot/twist_ideas/what_if_brainstorm/draw_story_seeds）→保存（create_idea）→評価（evaluate_ideas）→採用（set_idea_status adopted）→反映（idea_to_outline→create_chapter等）。`,
              type: "text",
            },
            role: "user",
          },
        ],
      };
    }
  );

  // 人物視点独白プロンプト
  server.prompt(
    "character_monologue",
    "指定人物の一人称で独白し、その人物起点のアイデア3案を発想するプロンプト。",
    {
      characterId: z.string().describe("独白させる登場人物ID (UUID)"),
      novelId: z.string().describe("小説ID (UUID)"),
      situation: z
        .string()
        .optional()
        .describe("独白の状況・場面（例: 決戦前夜、別れの直後）"),
    },
    async ({ novelId, characterId, situation }) => {
      assertNovelScope(auth, novelId);
      const character = await services.character.getCharacter(characterId);
      if (character.novelId !== novelId) {
        throw new NotFoundError("Character", characterId);
      }
      const novelDetail = await services.novel.getNovelDetail(novelId);

      return {
        messages: [
          {
            content: {
              text: `あなたは「${character.name}」本人です。一人称で、心の声を独白として語ってください。

【作品タイトル】: ${novelDetail.novel.title}

【人物設定】: ${character.name} (${character.category})
背景・性格: ${character.description || "なし"}
特徴・口調の種: ${(character.traits || []).join("、") || "なし"}

${situation ? `【独白の状況】: ${situation}\n` : ""}【独白の指示】
- その人物の口調・語彙・価値観を保った一人称で300〜500字程度
- 秘密・欲求・恐れのいずれかをにじませ、言い切らずに余韻を残すこと

【独白のあとの発想】
- この人物起点のアイデア3案（各案: その人物が次に起こす行動・巻き起こる波紋・必要な新設定）
- 最もその人物らしい推し案1件

なお、この独白文はreview_consistencyによる口調ブレ検証の基準文面にそのまま転用できます。

次の進め方（ガイド付きフロー）: 発散（brainstorm_plot/twist_ideas/what_if_brainstorm/draw_story_seeds）→保存（create_idea）→評価（evaluate_ideas）→採用（set_idea_status adopted）→反映（idea_to_outline→create_chapter等）。`,
              type: "text",
            },
            role: "user",
          },
        ],
      };
    }
  );

  // アイデア落とし込みプロンプト
  server.prompt(
    "idea_to_outline",
    "採用済みアイデアを章・節・伏線への落とし込み手順に展開するプロンプト。",
    {
      ideaId: z.string().describe("落とし込むアイデアID (UUID)"),
      novelId: z.string().describe("小説ID (UUID)"),
    },
    async ({ novelId, ideaId }) => {
      assertNovelScope(auth, novelId);
      const idea = await services.idea.getIdea(ideaId);
      if (idea.novelId !== novelId) {
        throw new NotFoundError("Idea", ideaId);
      }
      if (idea.status !== "adopted") {
        return {
          messages: [
            {
              content: {
                text: `このアイデア「${idea.title}」はまだ「${idea.status}」状態です。章・節への落とし込みの前に、先にset_idea_statusでadopt（採用）してください。採用後にidea_to_outlineを呼び出すと落とし込み手順を提示します。`,
                type: "text",
              },
              role: "user",
            },
          ],
        };
      }
      const [novelDetail, outlineMarkdown, foreshadowings] = await Promise.all([
        services.novel.getNovelDetail(novelId),
        services.chapter.getMarkdown(novelId),
        listSafely(services.foreshadowing.getForeshadowingsByNovel(novelId)),
      ]);

      return {
        messages: [
          {
            content: {
              text: `あなたはストーリー構成のプロフェッショナルです。以下の採用済みアイデアを、章・節・伏線への具体的な落とし込み手順に展開してください。

【作品タイトル】: ${novelDetail.novel.title}

【採用済みアイデア】: ${idea.title} (${idea.status})
詳細: ${idea.body || "なし"}

【現在のプロット構成】
${outlineMarkdown}

【未回収の伏線】
${
  foreshadowings
    .filter((f) => f.status === "unresolved")
    .map((f) => `- ${f.title}: ${f.description || ""}`)
    .join("\n") || "未回収の伏線はありません"
}

【出力：落とし込み手順】
1. 章への配置： 追加・改稿すべき章とその位置づけ
2. 節への分割： 各節のタイトル・出来事・想定分量
3. 伏線の扱い： 新設すべき伏線と、回収に使う既存伏線
4. 反映手順： idea_to_outlineの次に呼ぶツール（create_chapter/create_section等）とその順序`,
              type: "text",
            },
            role: "user",
          },
        ],
      };
    }
  );
}
