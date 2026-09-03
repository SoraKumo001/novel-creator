import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useContext, useState } from "react";
import { ChatUIContext } from "@/context/ChatContext.js";
import { useToast } from "@/hooks/useToast.js";
import { applyProposal } from "./proposalApply.js";
import { buildProposalDiff } from "./proposalDiff.js";
import {
  canShowProposalDiff,
  type ProposalDiffData,
  type ProposalPayload,
  resolveCleanSummary,
  resolveSafeSectionName,
  resolveTargetNovelId,
  toRouteTab,
} from "./proposalTypes.js";

export type ProposalStatus = "pending" | "applied" | "dismissed";

interface UseProposalApplyResult {
  canShowDiff: boolean;
  cleanSummary: string;
  diffData: ProposalDiffData | null;
  diffLoading: boolean;
  diffModalOpen: boolean;
  handleApply: () => Promise<void>;
  handleOpenDiff: () => Promise<void>;
  handleOpenInEditor: (targetTabOverride?: string) => void;
  isApplying: boolean;
  safeSectionName: string;
  setDiffModalOpen: (open: boolean) => void;
  setStatus: (s: ProposalStatus) => void;
  status: ProposalStatus;
  targetNovelId: string;
}

/**
 * 提案カードの状態遷移（反映・差分・モーダル）を担う hook。
 * API 呼び出し本体は proposalApply.ts に寄せ、ここでは toast / query / navigate の配線のみ行う。
 */
export function useProposalApply(
  proposal: ProposalPayload
): UseProposalApplyResult {
  const queryClient = useQueryClient();
  const toast = useToast();
  const chatUI = useContext(ChatUIContext);
  const navigate = useNavigate();

  const [status, setStatus] = useState<ProposalStatus>("pending");
  const [isApplying, setIsApplying] = useState(false);
  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffData, setDiffData] = useState<ProposalDiffData | null>(null);

  const targetNovelId = resolveTargetNovelId(proposal, chatUI?.selectedNovelId);
  const safeSectionName = resolveSafeSectionName(proposal);
  const cleanSummary = resolveCleanSummary(proposal, safeSectionName);
  const canShowDiff = canShowProposalDiff(proposal);

  const handleApply = useCallback(async () => {
    if (!targetNovelId) {
      toast.error(
        "反映対象の小説が未選択です。上部の「対象」セレクターから小説を選択してください。"
      );
      return;
    }
    setIsApplying(true);
    try {
      await applyProposal(targetNovelId, proposal, queryClient);
      setStatus("applied");
      setDiffModalOpen(false);
      toast.success(`${cleanSummary}を小説データに反映しました`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "反映に失敗しました";
      toast.error(msg);
    } finally {
      setIsApplying(false);
    }
  }, [targetNovelId, proposal, queryClient, cleanSummary, toast]);

  const handleOpenDiff = useCallback(async () => {
    if (!targetNovelId) {
      toast.error(
        "反映対象の小説が未選択です。上部の「対象」セレクターから小説を選択してください。"
      );
      return;
    }
    setDiffLoading(true);
    try {
      const diff = await buildProposalDiff(targetNovelId, proposal);
      if (diff) {
        setDiffData(diff);
        setDiffModalOpen(true);
      } else {
        toast.error("差分プレビュー可能な項目がありません");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "差分データの取得に失敗しました"
      );
    } finally {
      setDiffLoading(false);
    }
  }, [targetNovelId, proposal, toast]);

  const handleOpenInEditor = useCallback(
    (targetTabOverride?: string) => {
      if (!diffData || !targetNovelId) {
        return;
      }
      setDiffModalOpen(false);

      // タブ指定があれば一致するアイテムから詳細情報を取得
      const targetItem = diffData.diffItems?.find(
        (item) => item.targetTab === targetTabOverride
      );
      const resolvedTab = targetTabOverride || diffData.targetTab;
      const resolvedEntityType = targetItem?.entityType || diffData.entityType;
      const resolvedMarkdown =
        targetItem?.updatedMarkdown || diffData.updatedMarkdown;
      const resolvedTitle = targetItem?.title || diffData.title;

      // 該当タブに遷移
      navigate({
        to: "/novels/$novelId",
        params: { novelId: targetNovelId },
        search: { tab: toRouteTab(resolvedTab) },
      });

      // 遷移後のエディタに提案適用後Markdownを渡すイベントを発火
      setTimeout(() => {
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("novel-creator:markdown-preview-apply", {
              detail: {
                novelId: targetNovelId,
                entityType: resolvedEntityType,
                markdown: resolvedMarkdown,
                appliedTitle: resolvedTitle,
              },
            })
          );
        }
      }, 150);
    },
    [diffData, targetNovelId, navigate]
  );

  return {
    canShowDiff,
    cleanSummary,
    diffData,
    diffLoading,
    diffModalOpen,
    handleApply,
    handleOpenDiff,
    handleOpenInEditor,
    isApplying,
    safeSectionName,
    setDiffModalOpen,
    setStatus,
    status,
    targetNovelId,
  };
}
