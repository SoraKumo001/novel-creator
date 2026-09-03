import { useRef, useState } from "react";
import { useToast } from "@/hooks/useToast.js";
import { toErrorMessage } from "@/lib/errors.js";
import { proofreadSectionContent } from "@/lib/services/index.js";
import type { ProofreadResult } from "@/lib/types.js";

/** SectionEditor の校正モーダルブロック（routes 配下の局所フック） */
export function useSectionProofread(options: {
  sectionId: string;
  getBody: () => string;
  getModelConfigId: () => string | null;
  modal: {
    open: () => void;
    close: () => void;
    setResult: (result: ProofreadResult | null) => void;
  };
}) {
  const { sectionId, getBody, getModelConfigId, modal } = options;
  const [proofreading, setProofreading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const toast = useToast();
  const modalRef = useRef(modal);
  modalRef.current = modal;

  const handleOpenProofread = async () => {
    const body = getBody();
    if (!body.trim()) {
      toast.error("校正する本文がありません");
      return;
    }
    modalRef.current.open();
    setProofreading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await proofreadSectionContent(
        sectionId,
        body,
        getModelConfigId(),
        controller.signal
      );
      modalRef.current.setResult(res);
    } catch (e) {
      if ((e as Error)?.name === "AbortError" || controller.signal.aborted) {
        return;
      }
      toast.error(toErrorMessage(e));
      modalRef.current.close();
    } finally {
      setProofreading(false);
      abortRef.current = null;
    }
  };

  const handleCancelProofread = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setProofreading(false);
    modalRef.current.close();
  };

  return { proofreading, handleOpenProofread, handleCancelProofread };
}
