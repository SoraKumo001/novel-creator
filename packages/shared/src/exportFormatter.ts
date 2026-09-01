export type ExportFormat = "markdown" | "plain" | "narou" | "kakuyomu";

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
  format: ExportFormat
): string {
  switch (format) {
    case "markdown":
      return formatAsMarkdown(data);
    case "plain":
      return formatAsPlain(data);
    case "narou":
      return formatAsNarou(data);
    case "kakuyomu":
      return formatAsKakuyomu(data);
    default:
      return formatAsPlain(data);
  }
}

function formatAsMarkdown(data: NovelExportData): string {
  const lines: string[] = [];

  lines.push(`# ${data.title}`);
  lines.push("");

  if (data.description) {
    lines.push(data.description.trim());
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
        lines.push(section.content.trim());
        lines.push("");
      }
    }
  }

  return lines.join("\n");
}

function formatAsPlain(data: NovelExportData): string {
  const lines: string[] = [];

  lines.push(`■ ${data.title}`);
  lines.push("");

  if (data.description) {
    lines.push(data.description.trim());
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
        lines.push(section.content.trim());
        lines.push("");
      }
    }
  }

  return lines.join("\n");
}

function formatAsNarou(data: NovelExportData): string {
  const lines: string[] = [];

  lines.push(data.title);
  lines.push("");

  if (data.description) {
    lines.push(data.description.trim());
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
        lines.push(section.content.trim());
        lines.push("");
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

function formatAsKakuyomu(data: NovelExportData): string {
  const lines: string[] = [];

  lines.push(data.title);
  lines.push("");

  if (data.description) {
    lines.push(data.description.trim());
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
        lines.push(section.content.trim());
        lines.push("");
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}
