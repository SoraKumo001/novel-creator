/** 先頭優先切り詰め。 */
export function truncateHead(text: string, limit: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= limit) {
    return trimmed;
  }
  return `${trimmed.slice(0, limit)}…`;
}

/** 末尾優先切り詰め。接続部（末尾）を残す。 */
export function truncateTailShared(text: string, limit: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= limit) {
    return trimmed;
  }
  return `…${trimmed.slice(-limit)}`;
}
