import { useModalState } from "@/hooks/useModalResultState.js";
import type { Novel, UpdateNovelInput } from "@/lib/types.js";

interface UseStyleGuideModalOptions {
  novelId: string;
  onRefresh: () => Promise<void>;
  updateNovel: (id: string, input: UpdateNovelInput) => Promise<Novel>;
}

interface StyleGuideModalControls {
  close: () => void;
  isOpen: boolean;
  open: () => void;
}

interface UseStyleGuideModalReturn {
  handleSaveStyleGuide: (newStyleGuide: string) => Promise<void>;
  styleGuideModal: StyleGuideModalControls;
}

/**
 * StyleGuideモーダルの開閉と `updateNovel({ styleGuide })` 保存を集約するフック。
 * -OverviewTab / -SectionEditor の handleSaveStyleGuide 定型を置換できる。
 */
export function useStyleGuideModal({
  novelId,
  updateNovel,
  onRefresh,
}: UseStyleGuideModalOptions): UseStyleGuideModalReturn {
  const styleGuideModal = useModalState();

  const handleSaveStyleGuide = async (newStyleGuide: string): Promise<void> => {
    await updateNovel(novelId, { styleGuide: newStyleGuide });
    await onRefresh();
  };

  return { styleGuideModal, handleSaveStyleGuide };
}
