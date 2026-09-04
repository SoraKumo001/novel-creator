import { useCallback, useState } from "react";
import {
  type ChatDrawerWidth,
  type ChatLayoutMode,
  loadChatDrawerWidth,
  loadChatLayoutMode,
  saveChatDrawerWidth,
  saveChatLayoutMode,
} from "@/lib/chat-storage.js";

export interface UseChatDrawerLayoutReturn {
  drawerWidth: ChatDrawerWidth;
  handleLayoutModeChange: (mode: ChatLayoutMode) => void;
  handleWidthChange: (width: ChatDrawerWidth) => void;
  isDialog: boolean;
  layoutMode: ChatLayoutMode;
}

/**
 * ドロワー表示設定責務の切り出し（幅・配置モード・ダイアログ判定）。
 * 実体は `@/lib/chat-storage`。`ChatDrawerWidth` / `ChatLayoutMode` は
 * ファサード側の `DrawerWidth` / `ChatLayoutMode` と同一 union のため
 * そのまま代入できる。既定値・永続化タイミングは変更しない。
 */
export function useChatDrawerLayout(): UseChatDrawerLayoutReturn {
  const [drawerWidth, setDrawerWidth] =
    useState<ChatDrawerWidth>(loadChatDrawerWidth);
  const [layoutMode, setLayoutMode] =
    useState<ChatLayoutMode>(loadChatLayoutMode);

  const isDialog = layoutMode === "overlay" || drawerWidth === "full";

  const handleWidthChange = useCallback((width: ChatDrawerWidth) => {
    setDrawerWidth(width);
    saveChatDrawerWidth(width);
  }, []);

  const handleLayoutModeChange = useCallback((mode: ChatLayoutMode) => {
    setLayoutMode(mode);
    saveChatLayoutMode(mode);
  }, []);

  return {
    drawerWidth,
    handleLayoutModeChange,
    handleWidthChange,
    isDialog,
    layoutMode,
  };
}
