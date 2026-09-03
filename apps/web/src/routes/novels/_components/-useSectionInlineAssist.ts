import { useState } from "react";
import { useToast } from "@/hooks/useToast.js";
import { toErrorMessage } from "@/lib/errors.js";
import type { InlineAssistAction } from "@/lib/types.js";

/** SectionEditor のインラインAI支援ブロック（routes 配下の局所フック） */
export function useSectionInlineAssist(options: {
  sectionId: string;
  localBody: string;
  setLocalBody: (value: string) => void;
  selectedModelConfigId: string | null;
  inlineAssist: (
    sectionId: string,
    input: {
      selectedText: string;
      action: InlineAssistAction;
      customInstruction?: string;
      customPromptId?: string | null;
      modelConfigId: string | null;
      variantCount: number;
    },
    onChunk: (chunk: string, variantIndex?: number) => void
  ) => Promise<void>;
  inlineAssisting: boolean;
  cancelGeneration: () => void;
}) {
  const {
    sectionId,
    localBody,
    setLocalBody,
    selectedModelConfigId,
    inlineAssist,
    cancelGeneration,
  } = options;
  const [selectedText, setSelectedText] = useState("");
  const [inlineVariants, setInlineVariants] = useState<string[]>([""]);
  const [activeVariantIndex, setActiveVariantIndex] = useState(0);
  const [isInlineActive, setIsInlineActive] = useState(false);
  const toast = useToast();

  const handleSelectionChange = (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length > 0) {
      setSelectedText(trimmed);
    }
  };

  const resetInline = () => {
    setIsInlineActive(false);
    setSelectedText("");
    setInlineVariants([""]);
    setActiveVariantIndex(0);
  };

  const handleExecuteInlineAssist = async (
    action: InlineAssistAction,
    customInstruction?: string,
    customPromptId?: string | null,
    variantCount: number = 1
  ) => {
    if (!selectedText) {
      return;
    }
    const count = Math.max(1, Math.min(3, variantCount));
    const initialVariants = Array.from({ length: count }, () => "");
    setInlineVariants(initialVariants);
    setActiveVariantIndex(0);
    const accVariants = [...initialVariants];
    try {
      await inlineAssist(
        sectionId,
        {
          selectedText,
          action,
          customInstruction,
          customPromptId,
          modelConfigId: selectedModelConfigId,
          variantCount: count,
        },
        (chunk, variantIndex) => {
          const idx =
            typeof variantIndex === "number" &&
            variantIndex >= 0 &&
            variantIndex < count
              ? variantIndex
              : 0;
          accVariants[idx] = (accVariants[idx] || "") + chunk;
          setInlineVariants([...accVariants]);
        }
      );
    } catch (e) {
      toast.error(toErrorMessage(e));
    }
  };

  const handleApplyInlineReplace = (generated: string) => {
    if (!selectedText || !generated) {
      return;
    }
    const newBody = localBody.replace(selectedText, generated);
    setLocalBody(newBody);
    resetInline();
    toast.success("選択範囲を書き換えました");
  };

  const handleApplyInlineInsertAfter = (generated: string) => {
    if (!selectedText || !generated) {
      return;
    }
    const idx = localBody.indexOf(selectedText);
    if (idx !== -1) {
      const insertPos = idx + selectedText.length;
      const newBody =
        localBody.slice(0, insertPos) +
        "\n" +
        generated +
        localBody.slice(insertPos);
      setLocalBody(newBody);
      resetInline();
      toast.success("直後にテキストを挿入しました");
    }
  };

  const handleCancelInline = (inlineAssisting: boolean) => {
    if (inlineAssisting) {
      cancelGeneration();
    }
    resetInline();
  };

  return {
    selectedText,
    inlineVariants,
    activeVariantIndex,
    setActiveVariantIndex,
    isInlineActive,
    setIsInlineActive,
    handleSelectionChange,
    handleExecuteInlineAssist,
    handleApplyInlineReplace,
    handleApplyInlineInsertAfter,
    handleCancelInline,
  };
}
