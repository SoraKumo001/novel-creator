import type { ChatFocusContext } from "@/context/ChatContext.js";

/** focus 情報から相談フォーカス用のプリフィルテキストを生成する（互換用・純関数） */
export function buildChatPrefill(focus: ChatFocusContext): string {
  if (focus.selectedText?.trim()) {
    const selected = focus.selectedText.trim();
    return `【選択中のテキスト（${focus.title}）】\n${selected}\n\nこの部分について相談したいです：\n`;
  }

  const header = `${focus.title}について相談したいです。`;
  const summary = focus.summary?.trim();
  if (!summary) {
    return `${header}\n\n`;
  }
  return `${header}\n\n--- 現在の内容 ---\n${summary}\n--- ここまで ---\n\n`;
}

/** focus 情報とユーザープロンプトを合成して送信メッセージを生成する（純関数・テスト可能） */
export function buildChatPromptWithFocus(
  userPrompt: string,
  focus?: ChatFocusContext | null
): string {
  const trimmed = userPrompt.trim();
  if (!focus) {
    return trimmed;
  }

  if (focus.selectedText?.trim()) {
    const selected = focus.selectedText.trim();
    return `【参照中のテキスト（${focus.title}）】\n${selected}\n\n${trimmed}`;
  }

  const summary = focus.summary?.trim();
  if (!summary) {
    return `【参照コンテキスト: ${focus.title}】\n\n${trimmed}`;
  }

  return `【参照コンテキスト: ${focus.title}】\n--- 現在の内容 ---\n${summary}\n--- ここまで ---\n\n${trimmed}`;
}

/** 相談実行時にメッセージ末尾へ付与する不可視コンテキストブロックを生成する（互換用・純関数） */
export function buildContextAppendedPrompt(
  userPrompt: string,
  focus: ChatFocusContext
): string {
  return buildChatPromptWithFocus(userPrompt, focus);
}
