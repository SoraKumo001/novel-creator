import { parseRubyToHtml, stripRuby } from "./ruby.js";

export type ExportFormat = "markdown" | "plain" | "narou" | "kakuyomu";

export type ExportRubyMode = "keep" | "strip" | "html";

export interface ExportFormatOptions {
  ruby?: ExportRubyMode;
}

export interface NovelExportSection {
  content: string | null;
  order: number;
  title: string | null;
}

export interface NovelExportChapter {
  order: number;
  sections: NovelExportSection[];
  title: string;
}

export interface NovelExportData {
  chapters: NovelExportChapter[];
  description: string | null;
  title: string;
}

/**
 * 小説データを指定のフォーマットのテキストに整形する
 */
export function formatNovelText(
  data: NovelExportData,
  format: ExportFormat,
  options: ExportFormatOptions = {}
): string {
  const ruby: ExportRubyMode = options.ruby ?? "keep";
  switch (format) {
    case "markdown":
      return formatAsMarkdown(data, ruby);
    case "plain":
      return formatAsPlain(data, ruby);
    case "narou":
      return formatAsNarou(data, ruby);
    case "kakuyomu":
      return formatAsKakuyomu(data, ruby);
    default:
      return formatAsPlain(data, ruby);
  }
}

function processBodyText(content: string, ruby: ExportRubyMode): string {
  const trimmed = content.trim();
  if (ruby === "strip") {
    return stripRuby(trimmed);
  }
  if (ruby === "html") {
    return parseRubyToHtml(trimmed);
  }
  return trimmed;
}

function normalizeBlankLines(text: string): string {
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

function formatAsMarkdown(data: NovelExportData, ruby: ExportRubyMode): string {
  const lines: string[] = [];

  lines.push(`# ${data.title}`);
  lines.push("");

  if (data.description) {
    lines.push(processBodyText(data.description, ruby));
    lines.push("");
  }

  lines.push("---");
  lines.push("");

  const sortedChapters = [...data.chapters].sort((a, b) => a.order - b.order);

  for (const chapter of sortedChapters) {
    lines.push(`## ${chapter.title}`);
    lines.push("");

    const sortedSections = [...chapter.sections].sort(
      (a, b) => a.order - b.order
    );
    for (const section of sortedSections) {
      if (section.title) {
        lines.push(`### ${section.title}`);
        lines.push("");
      }
      if (section.content) {
        lines.push(processBodyText(section.content, ruby));
        lines.push("");
      }
    }
  }

  return lines.join("\n");
}

function formatAsPlain(data: NovelExportData, ruby: ExportRubyMode): string {
  const lines: string[] = [];

  lines.push(`■ ${data.title}`);
  lines.push("");

  if (data.description) {
    lines.push(processBodyText(data.description, ruby));
    lines.push("");
  }

  lines.push("================================");
  lines.push("");

  const sortedChapters = [...data.chapters].sort((a, b) => a.order - b.order);

  for (const chapter of sortedChapters) {
    lines.push(`【${chapter.title}】`);
    lines.push("");

    const sortedSections = [...chapter.sections].sort(
      (a, b) => a.order - b.order
    );
    for (const section of sortedSections) {
      if (section.title) {
        lines.push(`[${section.title}]`);
        lines.push("");
      }
      if (section.content) {
        lines.push(processBodyText(section.content, ruby));
        lines.push("");
      }
    }
  }

  return lines.join("\n");
}

function formatAsNarou(data: NovelExportData, ruby: ExportRubyMode): string {
  const lines: string[] = [];

  lines.push(data.title);
  lines.push("");

  if (data.description) {
    lines.push(processBodyText(data.description, ruby));
    lines.push("----------------");
    lines.push("");
  }

  const sortedChapters = [...data.chapters].sort((a, b) => a.order - b.order);

  for (const chapter of sortedChapters) {
    lines.push(`第${chapter.order}章\\u3000${chapter.title}`);
    lines.push("");

    const sortedSections = [...chapter.sections].sort(
      (a, b) => a.order - b.order
    );
    for (const section of sortedSections) {
      if (section.title) {
        lines.push(`${section.title}`);
        lines.push("");
      }
      if (section.content) {
        lines.push(processBodyText(section.content, ruby));
        lines.push("");
      }
      lines.push("");
    }
  }

  return normalizeBlankLines(lines.join("\n"));
}

function formatAsKakuyomu(data: NovelExportData, ruby: ExportRubyMode): string {
  const lines: string[] = [];

  lines.push(data.title);
  lines.push("");

  if (data.description) {
    lines.push(processBodyText(data.description, ruby));
    lines.push("");
    lines.push("================");
    lines.push("");
  }

  const sortedChapters = [...data.chapters].sort((a, b) => a.order - b.order);

  for (const chapter of sortedChapters) {
    lines.push(`【${chapter.title}】`);
    lines.push("");

    const sortedSections = [...chapter.sections].sort(
      (a, b) => a.order - b.order
    );
    for (const section of sortedSections) {
      if (section.title) {
        lines.push(`${section.title}`);
        lines.push("");
      }
      if (section.content) {
        lines.push(processBodyText(section.content, ruby));
        lines.push("");
      }
      lines.push("");
    }
  }

  return normalizeBlankLines(lines.join("\n"));
}
