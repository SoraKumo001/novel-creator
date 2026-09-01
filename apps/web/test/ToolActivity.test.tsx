import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  extractReasoning,
  extractToolInvocations,
  ToolActivity,
  toolLabel,
} from "../src/components/chat/ToolActivity.js";

describe("extractToolInvocations (AI SDK v7 パーツ形式)", () => {
  it("parts が空 / undefined / null のときは空配列を返す", () => {
    expect(extractToolInvocations([])).toEqual([]);
    expect(extractToolInvocations(undefined)).toEqual([]);
    expect(extractToolInvocations(null)).toEqual([]);
  });

  it("type が 'tool-<name>' のパーツをツール呼び出しとして抽出する", () => {
    const parts = [
      { type: "text", text: "少し確認しますね。" },
      {
        type: "tool-getCharacters",
        toolCallId: "call-1",
        state: "input-available",
        input: { name: "アリス" },
      },
    ];
    const extracted = extractToolInvocations(parts);
    expect(extracted).toHaveLength(1);
    expect(extracted[0].toolCallId).toBe("call-1");
    expect(extracted[0].toolName).toBe("getCharacters");
    expect(extracted[0].state).toBe("input-available");
    expect(extracted[0].input).toEqual({ name: "アリス" });
    expect(extracted[0].hasOutput).toBe(false);
  });

  it("text パーツや step-start などツール以外のパーツは無視する", () => {
    const parts = [
      { type: "step-start" },
      { type: "text", text: "こんにちは" },
      { type: "reasoning", text: "考え中..." },
      {
        type: "tool-getNovelInfo",
        toolCallId: "c1",
        state: "input-available",
        input: {},
      },
    ];
    expect(extractToolInvocations(parts)).toHaveLength(1);
  });

  it("toolCallId が無い / 型が不正なパーツはスキップする", () => {
    const parts = [
      { type: "tool-getCharacters" },
      { type: "tool-getCharacters", toolCallId: "" },
      { type: "tool-getCharacters", toolCallId: 123 },
      {
        type: "tool-getSettings",
        toolCallId: "ok-1",
        state: "input-available",
        input: {},
      },
    ];
    const extracted = extractToolInvocations(parts);
    expect(extracted).toHaveLength(1);
    expect(extracted[0].toolName).toBe("getSettings");
  });

  it("動的サフィックス付き type ('tool-xxx-hash') でもツール名が取れる", () => {
    const parts = [
      {
        type: "tool-searchNovelKnowledge-abc123",
        toolCallId: "call-9",
        state: "input-streaming",
        input: { query: "伏線" },
      },
    ];
    const extracted = extractToolInvocations(parts);
    expect(extracted).toHaveLength(1);
    expect(extracted[0].toolCallId).toBe("call-9");
    // getToolName は type の 'tool-' 以降をそのまま返すためサフィックス込みになる
    expect(extracted[0].toolName).toContain("searchNovelKnowledge");
  });

  it("dynamic-tool パーツから toolName を抽出する", () => {
    const parts = [
      {
        type: "dynamic-tool",
        toolName: "getTimelines",
        toolCallId: "call-7",
        state: "output-available",
        input: {},
        output: { count: 2 },
      },
    ];
    const extracted = extractToolInvocations(parts);
    expect(extracted).toHaveLength(1);
    expect(extracted[0].toolName).toBe("getTimelines");
    expect(extracted[0].hasOutput).toBe(true);
    expect(extracted[0].output).toEqual({ count: 2 });
  });

  it("state 分岐: output-available では output が乗り、hasOutput=true", () => {
    const parts = [
      {
        type: "tool-getSettings",
        toolCallId: "c1",
        state: "output-available",
        input: { category: "魔法" },
        output: { count: 3 },
      },
    ];
    const [item] = extractToolInvocations(parts);
    expect(item.state).toBe("output-available");
    expect(item.hasOutput).toBe(true);
    expect(item.output).toEqual({ count: 3 });
    expect(item.errorText).toBeUndefined();
  });

  it("state 分岐: output-error では errorText が乗り output は乗らない", () => {
    const parts = [
      {
        type: "tool-getSectionContent",
        toolCallId: "c1",
        state: "output-error",
        input: { sectionId: "x" },
        errorText: "見つかりません",
      },
    ];
    const [item] = extractToolInvocations(parts);
    expect(item.state).toBe("output-error");
    expect(item.hasOutput).toBe(false);
    expect(item.output).toBeUndefined();
    expect(item.errorText).toBe("見つかりません");
  });

  it("state 分岐: input-streaming では input が未定義でも抽出できる", () => {
    const parts = [
      {
        type: "tool-getPlotAndChapters",
        toolCallId: "c1",
        state: "input-streaming",
      },
    ];
    const [item] = extractToolInvocations(parts);
    expect(item.state).toBe("input-streaming");
    expect(item.input).toBeUndefined();
    expect(item.hasOutput).toBe(false);
  });

  it("複数ツールパーツを出現順に抽出する", () => {
    const parts = [
      {
        type: "tool-getNovelInfo",
        toolCallId: "c1",
        state: "input-available",
        input: {},
      },
      { type: "text", text: "確認しました" },
      {
        type: "tool-getForeshadowings",
        toolCallId: "c2",
        state: "output-available",
        input: {},
        output: { count: 1 },
      },
    ];
    const extracted = extractToolInvocations(parts);
    expect(extracted.map((i) => i.toolName)).toEqual([
      "getNovelInfo",
      "getForeshadowings",
    ]);
  });
});

describe("toolLabel", () => {
  it("既知ツールは日本語表示名を返す", () => {
    expect(toolLabel("getNovelInfo")).toBe("小説情報");
    expect(toolLabel("getCharacters")).toBe("人物取得");
    expect(toolLabel("getSettings")).toBe("設定取得");
    expect(toolLabel("getPlotAndChapters")).toBe("プロット・章構成取得");
    expect(toolLabel("getSectionContent")).toBe("本文取得");
    expect(toolLabel("getForeshadowings")).toBe("伏線取得");
    expect(toolLabel("getTimelines")).toBe("時系列取得");
    expect(toolLabel("searchNovelKnowledge")).toBe("知識検索");
  });

  it("未知のツール名はそのまま返す（フォールバック）", () => {
    expect(toolLabel("unknownTool")).toBe("unknownTool");
    expect(toolLabel("searchNovelKnowledge-abc123")).toBe(
      "searchNovelKnowledge-abc123"
    );
  });
});

describe("ToolActivity コンポーネント", () => {
  it("parts が空のときは何もレンダリングしない", () => {
    const { container } = render(<ToolActivity parts={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("日本語表示名と実行中ステータスを表示する（state: 'input-available'）", () => {
    const parts = [
      {
        type: "tool-getCharacters",
        toolCallId: "call-1",
        state: "input-available",
        input: { name: "アリス" },
      },
    ];
    render(<ToolActivity parts={parts} isStreaming={true} />);
    expect(screen.getByText("人物取得")).toBeInTheDocument();
    expect(screen.getByText("実行中...")).toBeInTheDocument();
  });

  it("input-streaming は「実行準備中...」を表示する", () => {
    const parts = [
      {
        type: "tool-getNovelInfo",
        toolCallId: "c1",
        state: "input-streaming",
        input: {},
      },
    ];
    render(<ToolActivity parts={parts} isStreaming={true} />);
    expect(screen.getByText("小説情報")).toBeInTheDocument();
    expect(screen.getByText("実行準備中...")).toBeInTheDocument();
  });

  it("完了（output-available）の結果サマリー表示とアコーディオン展開", () => {
    const parts = [
      {
        type: "tool-getCharacters",
        toolCallId: "call-1",
        state: "output-available",
        input: { name: "アリス" },
        output: { count: 3, characters: [] },
      },
    ];

    render(<ToolActivity parts={parts} />);
    expect(screen.getByText("人物取得")).toBeInTheDocument();
    expect(screen.getByText("3 件取得")).toBeInTheDocument();

    // 最初はアコーディオンが閉じている
    expect(screen.queryByText("入力パラメータ:")).not.toBeInTheDocument();

    // クリックで展開: input / output の JSON プレビューが見える
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("入力パラメータ:")).toBeInTheDocument();
    expect(screen.getByText("実行結果:")).toBeInTheDocument();
  });

  it("output-error のときエラーバッジを表示し、展開で errorText を見せる", () => {
    const parts = [
      {
        type: "tool-getSectionContent",
        toolCallId: "c1",
        state: "output-error",
        input: { sectionId: "x" },
        errorText: "DB接続に失敗しました",
      },
    ];
    render(<ToolActivity parts={parts} />);
    expect(screen.getByText("本文取得")).toBeInTheDocument();
    expect(screen.getByText("エラー")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("DB接続に失敗しました")).toBeInTheDocument();
  });

  it("未知のツール名はラベルをそのまま表示する", () => {
    const parts = [
      {
        type: "tool-mysteryTool",
        toolCallId: "c1",
        state: "input-available",
        input: {},
      },
    ];
    render(<ToolActivity parts={parts} />);
    expect(screen.getByText("mysteryTool")).toBeInTheDocument();
  });
});

describe("extractReasoning & ReasoningActivity", () => {
  it("parts から思考プロセス（reasoning）を抽出できること", () => {
    const parts = [
      { type: "step-start" },
      { type: "reasoning", text: "ユーザーの要望を分析中。" },
      { type: "reasoning", text: "結末案を3パターン検討する。" },
      { type: "text", text: "回答本文" },
    ];

    const reasoning = extractReasoning(parts);
    expect(reasoning).not.toBeNull();
    expect(reasoning?.text).toBe(
      "ユーザーの要望を分析中。結末案を3パターン検討する。"
    );
    expect(reasoning?.state).toBe("done");
  });

  it("reasoning パーツが存在しない場合は null を返すこと", () => {
    const parts = [{ type: "text", text: "こんにちは" }];
    expect(extractReasoning(parts)).toBeNull();
    expect(extractReasoning([])).toBeNull();
    expect(extractReasoning(null)).toBeNull();
  });

  it("ToolActivity で思考プロセスが存在する場合、思考パネルが表示されること", () => {
    const parts = [
      { type: "reasoning", text: "プロットの伏線との整合性を確認中..." },
      { type: "text", text: "以下が提案です。" },
    ];

    render(<ToolActivity parts={parts} />);
    expect(screen.getByText("思考プロセス")).toBeInTheDocument();

    // クリックで思考内容を展開
    fireEvent.click(screen.getByRole("button", { name: /思考プロセス/ }));
    expect(
      screen.getByText("プロットの伏線との整合性を確認中...")
    ).toBeInTheDocument();
  });

  it("ストリーミング中の思考プロセスは自動展開され推論中バッジが表示されること", () => {
    const parts = [
      {
        type: "reasoning",
        text: "リアルタイムに推論中...",
        state: "streaming",
      },
    ];

    render(<ToolActivity parts={parts} isStreaming={true} />);
    expect(screen.getByText("AIパートナーが思考中...")).toBeInTheDocument();
    expect(screen.getByText("推論中...")).toBeInTheDocument();
    expect(screen.getByText("リアルタイムに推論中...")).toBeInTheDocument();
  });
});
