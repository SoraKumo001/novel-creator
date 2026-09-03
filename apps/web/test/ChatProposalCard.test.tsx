import type { Novel } from "@novel-creator/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ChatProposalCard,
  type ProposalPayload,
} from "../src/components/chat/ChatProposalCard.js";
import * as services from "../src/lib/services/index.js";

vi.mock("../src/lib/services/index.js", () => ({
  fetchCharactersMarkdown: vi.fn(),
  saveCharactersMarkdown: vi.fn(),
  fetchSettingsMarkdown: vi.fn(),
  saveSettingsMarkdown: vi.fn(),
  fetchForeshadowingsMarkdown: vi.fn(),
  saveForeshadowingsMarkdown: vi.fn(),
  fetchTimelinesMarkdown: vi.fn(),
  saveTimelinesMarkdown: vi.fn(),
  fetchPlotMarkdown: vi.fn(),
  savePlotMarkdown: vi.fn(),
  fetchStoryOutline: vi.fn(),
  saveStoryOutline: vi.fn(),
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock("../src/hooks/useToast.js", () => ({
  useToast: () => ({
    success: mockToastSuccess,
    error: mockToastError,
  }),
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe("ChatProposalCard", () => {
  const NOVEL_ID = "test-novel-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("story_outline proposal", () => {
    const proposal: ProposalPayload = {
      type: "proposal",
      proposalType: "story_outline",
      novelId: NOVEL_ID,
      data: {
        sectionName: "結（結末・エンディング）",
        content: "主人公が古代魔導具を制御し、魔境の封印に成功する大団円。",
        mode: "replace",
        reason: "ハッピーエンドへの変更",
      },
      summary: "ストーリー構想「結（結末・エンディング）」の更新提案",
    };

    it("ストーリー構想の提案内容（セクション名、理由、本文）が表示されること", () => {
      renderWithClient(<ChatProposalCard proposal={proposal} />);

      expect(screen.getAllByText(/ストーリー構想/).length).toBeGreaterThan(0);
      expect(
        screen.getAllByText(/結（結末・エンディング）/).length
      ).toBeGreaterThan(0);
      expect(screen.getByText(/ハッピーエンドへの変更/)).toBeInTheDocument();
      expect(
        screen.getByText(
          /主人公が古代魔導具を制御し、魔境の封印に成功する大団円。/
        )
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /小説に反映する/ })
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /破棄/ })).toBeInTheDocument();
    });

    it("「反映する」をクリックすると既存構想が更新保存され、イベントが発火されること", async () => {
      const existingOutline = `# 作品コンセプト
## ログライン
テスト

# ストーリー構成
## 結（結末・エンディング）
バッドエンド。
`;
      vi.mocked(services.fetchStoryOutline).mockResolvedValue(existingOutline);
      vi.mocked(services.saveStoryOutline).mockResolvedValue({
        id: NOVEL_ID,
      } as unknown as Novel);

      const eventListener = vi.fn();
      window.addEventListener(
        "novel-creator:story-outline-updated",
        eventListener
      );

      renderWithClient(<ChatProposalCard proposal={proposal} />);

      const applyButton = screen.getByRole("button", {
        name: /小説に反映する/,
      });
      fireEvent.click(applyButton);

      await waitFor(() => {
        expect(services.fetchStoryOutline).toHaveBeenCalledWith(NOVEL_ID);
        expect(services.saveStoryOutline).toHaveBeenCalledWith(
          NOVEL_ID,
          expect.stringContaining(
            "主人公が古代魔導具を制御し、魔境の封印に成功する大団円。"
          )
        );
        expect(mockToastSuccess).toHaveBeenCalledWith(
          expect.stringContaining("小説データに反映しました")
        );
        expect(
          screen.getAllByText(/小説データに反映完了/).length
        ).toBeGreaterThan(0);
      });

      // 反映後もどのセクションの提案だったかがカード上に残っていること
      expect(
        screen.getAllByText(/結（結末・エンディング）/).length
      ).toBeGreaterThan(0);
      expect(
        screen.queryByRole("button", { name: /小説に反映する/ })
      ).not.toBeInTheDocument();

      expect(eventListener).toHaveBeenCalledTimes(1);
      const customEvent = eventListener.mock.calls[0][0] as CustomEvent;
      expect(customEvent.detail.novelId).toBe(NOVEL_ID);
      expect(customEvent.detail.markdown).toContain(
        "主人公が古代魔導具を制御し"
      );

      window.removeEventListener(
        "novel-creator:story-outline-updated",
        eventListener
      );
    });

    it("「破棄」をクリックするとスキップ状態になり、反映ボタンが非表示になること", () => {
      renderWithClient(<ChatProposalCard proposal={proposal} />);

      const dismissButton = screen.getByRole("button", { name: /破棄/ });
      fireEvent.click(dismissButton);

      expect(screen.getByText(/提案をスキップしました/)).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /小説に反映する/ })
      ).not.toBeInTheDocument();
    });

    it("content が空の場合は警告が表示され、反映ボタンが無効化されること", () => {
      const emptyProposal: ProposalPayload = {
        ...proposal,
        data: {
          ...proposal.data,
          content: "",
        },
      };

      renderWithClient(<ChatProposalCard proposal={emptyProposal} />);

      expect(screen.getByText(/反映する本文が空です/)).toBeInTheDocument();
      const applyBtn = screen.getByRole("button", { name: /小説に反映する/ });
      expect(applyBtn).toBeDisabled();
    });

    it("「差分を確認」ボタンをクリックすると既存マークダウンを取得して差分モーダルが開くこと", async () => {
      vi.mocked(services.fetchStoryOutline).mockResolvedValue(
        "# 原本マークダウン"
      );

      renderWithClient(<ChatProposalCard proposal={proposal} />);

      const diffButton = screen.getByRole("button", { name: /差分を確認/ });
      fireEvent.click(diffButton);

      await waitFor(() => {
        expect(services.fetchStoryOutline).toHaveBeenCalledWith(NOVEL_ID);
        expect(screen.getByText(/差分プレビュー/)).toBeInTheDocument();
      });
    });
  });

  describe("bulk proposal", () => {
    const bulkProposal: ProposalPayload = {
      type: "proposal",
      proposalType: "bulk",
      novelId: NOVEL_ID,
      data: {
        characters: [
          {
            name: "アレン",
            category: "主人公",
            description: "熱血な少年",
            traits: ["勇敢"],
          },
        ],
        settings: [
          {
            name: "帝国",
            category: "世界観",
            description: "巨大な軍事国家",
          },
        ],
        foreshadowings: [
          {
            title: "黒幕の正体",
            description: "実は王太子",
            status: "unresolved",
          },
        ],
        timelines: [
          {
            event: "王都陥落",
            timestamp: "10年前",
          },
        ],
      },
      summary: "設定の一括登録提案（合計4件）",
    };

    it("一括登録の各エンティティプレビューが表示されること", () => {
      renderWithClient(<ChatProposalCard proposal={bulkProposal} />);

      expect(screen.getAllByText(/一括登録/).length).toBeGreaterThan(0);
      expect(screen.getByText("アレン")).toBeInTheDocument();
      expect(screen.getByText("帝国")).toBeInTheDocument();
      expect(screen.getByText("黒幕の正体")).toBeInTheDocument();
      expect(screen.getByText("王都陥落")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /小説に反映する/ })
      ).toBeInTheDocument();
    });

    it("一括反映をクリックすると各マークダウン保存APIが呼び出されること", async () => {
      vi.mocked(services.fetchCharactersMarkdown).mockResolvedValue({
        markdown: "",
      });
      vi.mocked(services.saveCharactersMarkdown).mockResolvedValue({
        created: 1,
        updated: 0,
        deleted: 0,
      });
      vi.mocked(services.fetchSettingsMarkdown).mockResolvedValue({
        markdown: "",
      });
      vi.mocked(services.saveSettingsMarkdown).mockResolvedValue({
        created: 1,
        updated: 0,
        deleted: 0,
      });
      vi.mocked(services.fetchForeshadowingsMarkdown).mockResolvedValue("");
      vi.mocked(services.saveForeshadowingsMarkdown).mockResolvedValue({
        created: 1,
        updated: 0,
        deleted: 0,
      });
      vi.mocked(services.fetchTimelinesMarkdown).mockResolvedValue({
        markdown: "",
      });
      vi.mocked(services.saveTimelinesMarkdown).mockResolvedValue({
        created: 1,
        updated: 0,
        deleted: 0,
      });

      renderWithClient(<ChatProposalCard proposal={bulkProposal} />);

      const applyBtn = screen.getByRole("button", { name: /小説に反映する/ });
      fireEvent.click(applyBtn);

      await waitFor(() => {
        expect(services.saveCharactersMarkdown).toHaveBeenCalledWith(
          NOVEL_ID,
          expect.stringContaining("アレン")
        );
        expect(services.saveSettingsMarkdown).toHaveBeenCalledWith(
          NOVEL_ID,
          expect.stringContaining("帝国")
        );
        expect(services.saveForeshadowingsMarkdown).toHaveBeenCalledWith(
          NOVEL_ID,
          expect.stringContaining("黒幕の正体")
        );
        expect(services.saveTimelinesMarkdown).toHaveBeenCalledWith(
          NOVEL_ID,
          expect.stringContaining("王都陥落")
        );
        expect(mockToastSuccess).toHaveBeenCalledWith(
          expect.stringContaining("小説データに反映しました")
        );
        expect(
          screen.getAllByText(/小説データに反映完了/).length
        ).toBeGreaterThan(0);
      });
    });

    it("伏線にtitleがない場合（descriptionのみ等）でも「差分を確認」でエラーにならずモーダルが開くこと", async () => {
      const proposalWithMissingTitle: ProposalPayload = {
        type: "proposal",
        proposalType: "bulk",
        novelId: NOVEL_ID,
        data: {
          characters: [{ name: "アレン", category: "主人公" }],
          settings: [{ name: "帝国", category: "世界観" }],
          foreshadowings: [
            {
              // title が未定義で description のみあるケース
              description:
                "ライゼン家の血にはパラサイト型遺物への高い適性がある。",
            },
          ],
        },
        summary: "一括登録提案（伏線タイトル未定義）",
      };

      vi.mocked(services.fetchCharactersMarkdown).mockResolvedValue({
        markdown: "# キャラ\n",
      });
      vi.mocked(services.fetchSettingsMarkdown).mockResolvedValue({
        markdown: "# 設定\n",
      });
      vi.mocked(services.fetchForeshadowingsMarkdown).mockResolvedValue(
        "# 伏線\n"
      );

      renderWithClient(
        <ChatProposalCard proposal={proposalWithMissingTitle} />
      );

      const diffBtn = screen.getByRole("button", { name: /差分を確認/ });
      fireEvent.click(diffBtn);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /🎭 登場人物/ })
        ).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: /🌍 設定/ })
        ).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: /🔍 伏線/ })
        ).toBeInTheDocument();
      });

      // 伏線タブを開いてもエラーにならないことを確認
      fireEvent.click(screen.getByRole("button", { name: /🔍 伏線/ }));
      await waitFor(() => {
        expect(screen.getByText(/差分プレビュー: 伏線/)).toBeInTheDocument();
      });
    });
  });

  describe("setting proposal with replacement", () => {
    const replaceProposal: ProposalPayload = {
      type: "proposal",
      proposalType: "setting",
      novelId: NOVEL_ID,
      data: {
        category: "世界観",
        description: "新たな大国。",
        name: "神聖ルミナス皇国",
        oldSettingName: "ルミナス帝国",
      },
      summary:
        "世界観設定「神聖ルミナス皇国」(世界観)の登録提案（旧「ルミナス帝国」を削除して置換）",
    };

    it("置換元の旧設定名が表示されること", () => {
      renderWithClient(<ChatProposalCard proposal={replaceProposal} />);

      expect(screen.getByText("神聖ルミナス皇国")).toBeInTheDocument();
      expect(screen.getByText("ルミナス帝国")).toBeInTheDocument();
      expect(screen.getByText(/削除対象の旧設定/)).toBeInTheDocument();
    });

    it("反映時に旧設定を削除して新設定をマークダウン保存すること", async () => {
      vi.mocked(services.fetchSettingsMarkdown).mockResolvedValue({
        markdown: "# 世界観\n\n## ルミナス帝国\n\n古い帝国\n",
      });
      vi.mocked(services.saveSettingsMarkdown).mockResolvedValue({
        created: 1,
        updated: 0,
        deleted: 1,
      });

      renderWithClient(<ChatProposalCard proposal={replaceProposal} />);

      const applyBtn = screen.getByRole("button", { name: /小説に反映する/ });
      fireEvent.click(applyBtn);

      await waitFor(() => {
        expect(services.fetchSettingsMarkdown).toHaveBeenCalledWith(NOVEL_ID);
        expect(services.saveSettingsMarkdown).toHaveBeenCalledWith(
          NOVEL_ID,
          expect.stringContaining("神聖ルミナス皇国")
        );
      });
    });
  });

  describe("delete_setting proposal", () => {
    const deleteProposal: ProposalPayload = {
      type: "proposal",
      proposalType: "delete_setting",
      novelId: NOVEL_ID,
      data: {
        name: "旧設定A",
        reason: "世界観整理のため",
      },
      summary: "世界観設定「旧設定A」の削除提案（世界観整理のため）",
    };

    it("削除対象の設定名と理由が表示されること", () => {
      renderWithClient(<ChatProposalCard proposal={deleteProposal} />);

      expect(screen.getByText("旧設定A")).toBeInTheDocument();
      expect(screen.getAllByText(/世界観整理のため/).length).toBeGreaterThan(0);
      expect(screen.getByText(/設定削除の提案/)).toBeInTheDocument();
    });

    it("反映時に旧設定を削除マークダウン保存すること", async () => {
      vi.mocked(services.fetchSettingsMarkdown).mockResolvedValue({
        markdown: "# 世界観\n\n## 旧設定A\n\n不要な設定\n",
      });
      vi.mocked(services.saveSettingsMarkdown).mockResolvedValue({
        created: 0,
        updated: 0,
        deleted: 1,
      });

      renderWithClient(<ChatProposalCard proposal={deleteProposal} />);

      const applyBtn = screen.getByRole("button", { name: /小説に反映する/ });
      fireEvent.click(applyBtn);

      await waitFor(() => {
        expect(services.fetchSettingsMarkdown).toHaveBeenCalledWith(NOVEL_ID);
        expect(services.saveSettingsMarkdown).toHaveBeenCalledWith(
          NOVEL_ID,
          expect.not.stringContaining("旧設定A")
        );
      });
    });
  });
});
