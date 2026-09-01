import type { Meta, StoryObj } from "@storybook/react-vite";
import { MarkdownText } from "./MarkdownText";

const meta = {
  component: MarkdownText,
  tags: ["autodocs"],
} satisfies Meta<typeof MarkdownText>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleMarkdown = [
  "# 章タイトル",
  "",
  "本文の冒頭です。**太字**や*斜体*、`インラインコード` が使えます。",
  "",
  "## 節の見出し",
  "",
  "- リスト項目1",
  "- リスト項目2",
  "  - ネストした項目",
  "",
  "> 引用文の例です。",
  "",
  "1. 順序付きリスト1",
  "2. 順序付きリスト2",
  "",
  "| 列1 | 列2 |",
  "| --- | --- |",
  "| A | B |",
  "| C | D |",
  "",
  "通常の[リンク](https://example.com)もあります。",
].join("\n");

export const Default: Story = {
  args: {
    content: sampleMarkdown,
  },
};

export const Empty: Story = {
  args: {
    content: "",
  },
};

export const LongContent: Story = {
  args: {
    content: Array.from(
      { length: 20 },
      (_, i) => `## セクション ${i + 1}\n\n段落 ${i + 1} の本文です。`
    ).join("\n\n"),
  },
};

const mermaidFlowchart = [
  "```mermaid",
  "graph TD",
  "    A[章の概要生成] --> B[節の概要生成]",
  "    B --> C[本文生成]",
  "    C --> D[整合性更新]",
  "    D -->|設定更新| E[(VectorDB)]",
  "    D -->|時系列更新| F[(RDB)]",
  "```",
].join("\n");

export const MermaidFlowchart: Story = {
  args: {
    content: `## 自動フロー\n\n${mermaidFlowchart}\n\n図の後に続く本文です。`,
  },
};

const mermaidSequence = [
  "```mermaid",
  "sequenceDiagram",
  "    participant U as ユーザー",
  "    participant W as Web",
  "    participant A as API",
  "    participant L as LLM",
  "    U->>W: 生成ボタンクリック",
  "    W->>A: POST /generate",
  "    A->>L: プロンプト送信",
  "    L-->>A: SSE ストリーミング",
  "    A-->>W: SSE 転送",
  "    W-->>U: 本文表示",
  "```",
].join("\n");

export const MermaidSequence: Story = {
  args: {
    content: mermaidSequence,
  },
};

const mermaidClass = [
  "```mermaid",
  "classDiagram",
  "    class Novel {",
  "        +string title",
  "        +string description",
  "    }",
  "    class Chapter {",
  "        +string title",
  "        +int order",
  "    }",
  "    class Section {",
  "        +string title",
  "        +int order",
  "    }",
  '    Novel "1" *-- "many" Chapter',
  '    Chapter "1" *-- "many" Section',
  "```",
].join("\n");

export const MermaidClass: Story = {
  args: {
    content: mermaidClass,
  },
};

const mermaidState = [
  "```mermaid",
  "stateDiagram-v2",
  "    [*] --> 下書き",
  "    下書き --> 生成中: 本文生成",
  "    生成中 --> 確認中: 生成完了",
  "    確認中 --> 下書き: 編集",
  "    確認中 --> [*]: 保存",
  "```",
].join("\n");

export const MermaidState: Story = {
  args: {
    content: mermaidState,
  },
};

const mermaidInvalid = [
  "```mermaid",
  "this is not valid mermaid syntax",
  "```",
].join("\n");

export const MermaidError: Story = {
  args: {
    content: mermaidInvalid,
  },
};
