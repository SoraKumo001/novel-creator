import { useChatStreamingState, useChatUI } from "@/context/ChatContext.js";

export function ChatFloatingButton() {
  const { isOpen, toggleChat } = useChatUI();
  const { isStreaming } = useChatStreamingState();

  if (isOpen) {
    return null; // チャットパネル展開中はボタンを隠す（またはパネル側で閉じる操作を行う）
  }

  return (
    <button
      type="button"
      onClick={toggleChat}
      className="group fixed right-6 bottom-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-linear-to-tr from-indigo-600 to-violet-600 text-white shadow-indigo-500/25 shadow-xl transition-all duration-300 hover:scale-105 hover:shadow-indigo-500/40 focus:outline-none focus:ring-4 focus:ring-primary/40 active:scale-95"
      aria-label="創作相談チャットを開く"
      title="創作相談チャット"
    >
      {/* ストリーミング中のパルスリング */}
      {isStreaming && (
        <span className="absolute -top-1 -right-1 flex h-4 w-4">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-4 w-4 rounded-full bg-emerald-500" />
        </span>
      )}

      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="h-7 w-7 transition-transform group-hover:scale-110"
      >
        <path
          fillRule="evenodd"
          d="M4.848 2.771A49.144 49.144 0 0112 2.25c2.43 0 4.817.177 7.152.521 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 01-3.476.383.39.39 0 00-.297.17l-2.755 4.133a.75.75 0 01-1.248 0l-2.755-4.133a.39.39 0 00-.297-.17 48.9 48.9 0 01-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97zM6.75 8.25a.75.75 0 01.75-.75h9a.75.75 0 010 1.5h-9a.75.75 0 01-.75-.75zm.75 2.25a.75.75 0 000 1.5H12a.75.75 0 000-1.5H7.5z"
          clipRule="evenodd"
        />
      </svg>

      {/* ツールチップ */}
      <span className="pointer-events-none absolute top-1/2 right-16 -translate-y-1/2 whitespace-nowrap rounded-md bg-foreground px-2.5 py-1 font-medium text-background text-xs opacity-0 shadow-md transition-opacity duration-200 group-hover:opacity-100">
        AI創作相談
      </span>
    </button>
  );
}
