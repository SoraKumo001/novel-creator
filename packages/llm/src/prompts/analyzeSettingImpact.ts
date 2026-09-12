import { renderPromptTemplate } from "../templateEngine.js";
import { getPromptTemplate } from "./loader.js";

export interface AnalyzeSettingImpactContext {
  afterValue: string;
  beforeValue: string;
  changeTarget: "character" | "setting";
  chapters?: Array<{
    title: string;
    sections: Array<{
      title: string;
      summary?: string | null;
      contentSnippet?: string;
    }>;
  }>;
  foreshadowings?: Array<{
    title: string;
    description?: string | null;
  }>;
  novelTitle?: string;
  plots?: string;
  targetName: string;
  timelines?: Array<{
    title: string;
    era?: string | null;
    description?: string | null;
  }>;
}

export function analyzeSettingImpactPrompt(
  context: AnalyzeSettingImpactContext
): string {
  let impactContextSections = "";

  if (context.plots) {
    impactContextSections += `■ 全体プロット:\n${context.plots}\n\n`;
  }

  if (context.chapters && context.chapters.length > 0) {
    impactContextSections += "■ 章・節一覧と概要:\n";
    for (const ch of context.chapters) {
      impactContextSections += `### ${ch.title}\n`;
      for (const sec of ch.sections) {
        impactContextSections += `- **${sec.title}**: ${sec.summary || "概要なし"}\n`;
        if (sec.contentSnippet) {
          impactContextSections += `  (本文抜粋: ${sec.contentSnippet})\n`;
        }
      }
    }
    impactContextSections += "\n";
  }

  if (context.timelines && context.timelines.length > 0) {
    impactContextSections += "■ 年表・時系列:\n";
    for (const tl of context.timelines) {
      impactContextSections += `- [${tl.era || "時期不明"}] ${tl.title}: ${tl.description || ""}\n`;
    }
    impactContextSections += "\n";
  }

  if (context.foreshadowings && context.foreshadowings.length > 0) {
    impactContextSections += "■ 伏線一覧:\n";
    for (const fs of context.foreshadowings) {
      impactContextSections += `- ${fs.title}: ${fs.description || ""}\n`;
    }
    impactContextSections += "\n";
  }

  const template = getPromptTemplate("analyzeSettingImpact");
  return renderPromptTemplate(template.body, {
    afterValue: context.afterValue,
    beforeValue: context.beforeValue,
    changeTargetLabel:
      context.changeTarget === "character" ? "登場人物" : "世界観設定",
    impactContextSections,
    novelTitle: context.novelTitle ?? "未設定",
    targetName: context.targetName,
  });
}
