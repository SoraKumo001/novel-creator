import type { LlmInstruction } from "@/lib/types.js";

interface PromptHistoryListProps {
  instructions: LlmInstruction[];
  onApply: (text: string) => void;
  onRequestDelete: (id: string) => void;
}

export function PromptHistoryList({
  instructions,
  onApply,
  onRequestDelete,
}: PromptHistoryListProps) {
  if (instructions.length === 0) {
    return null;
  }

  return (
    <div className="border-border border-t pt-2">
      <h4 className="mb-2 font-bold text-muted-foreground text-xs uppercase tracking-wider">
        過去のプロンプト履歴
      </h4>
      <ul className="max-h-60 space-y-2 overflow-y-auto pr-1">
        {instructions.map((item) => (
          <li
            key={item.id}
            className="group flex items-start justify-between gap-2 rounded-lg border border-border bg-surface-raised/50 p-2.5 transition hover:border-primary/50 hover:bg-surface-raised"
          >
            <button
              type="button"
              onClick={() => onApply(item.instruction)}
              className="flex-1 text-left text-foreground text-xs leading-relaxed transition group-hover:text-primary"
              title="この指示を入力欄に適用"
            >
              {item.instruction}
            </button>
            <button
              type="button"
              onClick={() => onRequestDelete(item.id)}
              title="履歴から削除"
              className="shrink-0 rounded p-1 text-muted-foreground opacity-60 transition hover:bg-destructive/10 hover:text-destructive hover:opacity-100"
            >
              <TrashIcon />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="h-4 w-4"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
      />
    </svg>
  );
}
