import { useEffect, useState } from "react";
import { Button } from "@/components/Button.js";
import { Input } from "@/components/Input.js";
import { Modal } from "@/components/Modal.js";
import { Textarea } from "@/components/Textarea.js";
import type { Chapter, Section } from "@/lib/types.js";

export function ChapterSectionFormModal({
  mode,
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  title,
  defaultValues,
}: {
  mode: "chapter" | "section";
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: {
    title: string;
    order: number;
    summary: string;
  }) => Promise<void>;
  isLoading: boolean;
  title: string;
  defaultValues?: Chapter | Section;
}) {
  const [formTitle, setFormTitle] = useState(defaultValues?.title ?? "");
  const [order, setOrder] = useState(defaultValues?.order ?? 1);
  const [summary, setSummary] = useState(defaultValues?.summary ?? "");

  useEffect(() => {
    if (defaultValues) {
      setFormTitle(defaultValues.title ?? "");
      setOrder(defaultValues.order);
      setSummary(defaultValues.summary ?? "");
    } else {
      setFormTitle("");
      setOrder(1);
      setSummary("");
    }
  }, [defaultValues]);

  const isChapter = mode === "chapter";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button
            variant="primary"
            onClick={() => onSubmit({ title: formTitle, order, summary })}
            isLoading={isLoading}
            disabled={isChapter && !formTitle.trim()}
          >
            保存
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label={isChapter ? "章タイトル" : "節タイトル"}
          value={formTitle}
          onChange={(e) => setFormTitle(e.target.value)}
          placeholder={isChapter ? "第一章 冒険の始まり" : "第一節 出会い"}
        />
        <Input
          label="順序"
          type="number"
          value={String(order)}
          onChange={(e) => setOrder(Number.parseInt(e.target.value, 10) || 1)}
        />
        <Textarea
          label={isChapter ? "章の概要 / あらすじ" : "節の概要 / あらすじ"}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder={
            isChapter
              ? "この章で何が起きるか、主要な展開など"
              : "この節で描くシーンやキャラクターの行動など"
          }
          rows={4}
        />
      </div>
    </Modal>
  );
}
