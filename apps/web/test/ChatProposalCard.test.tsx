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
  createCharacter: vi.fn(),
  createSetting: vi.fn(),
  createForeshadowing: vi.fn(),
  createTimeline: vi.fn(),
  createChapter: vi.fn(),
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

      expect(screen.getByText(/ストーリー構想/)).toBeInTheDocument();
      expect(screen.getByText(/結（結末・エンディング）/)).toBeInTheDocument();
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
      });

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

    it("「破棄」をクリックするとスキップ状態になり非表示になること", () => {
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

      expect(screen.getByText(/一括登録/)).toBeInTheDocument();
      expect(screen.getByText("アレン")).toBeInTheDocument();
      expect(screen.getByText("帝国")).toBeInTheDocument();
      expect(screen.getByText("黒幕の正体")).toBeInTheDocument();
      expect(screen.getByText("王都陥落")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /小説に反映する/ })
      ).toBeInTheDocument();
    });

    it("一括反映をクリックすると全サービスAPIが呼び出されること", async () => {
      renderWithClient(<ChatProposalCard proposal={bulkProposal} />);

      const applyBtn = screen.getByRole("button", { name: /小説に反映する/ });
      fireEvent.click(applyBtn);

      await waitFor(() => {
        expect(services.createCharacter).toHaveBeenCalledWith(
          NOVEL_ID,
          expect.objectContaining({ name: "アレン" })
        );
        expect(services.createSetting).toHaveBeenCalledWith(
          NOVEL_ID,
          expect.objectContaining({ name: "帝国" })
        );
        expect(services.createForeshadowing).toHaveBeenCalledWith(
          NOVEL_ID,
          expect.objectContaining({ title: "黒幕の正体" })
        );
        expect(services.createTimeline).toHaveBeenCalledWith(
          NOVEL_ID,
          expect.objectContaining({ event: "王都陥落" })
        );
        expect(mockToastSuccess).toHaveBeenCalledWith(
          expect.stringContaining("小説データに反映しました")
        );
      });
    });
  });
});
