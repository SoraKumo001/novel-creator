export { countWords as countChars } from "./sse.js";

export const DEFAULT_CHARS_PER_MINUTE = 400;

/** 文字数を「1,234 文字」形式で表示する。 */
export function formatCharCount(count: number): string {
  return `${count.toLocaleString()} 文字`;
}

/** 文字数から読了目安（分）を返す。約400文字/分を既定とする。 */
export function formatReadingMinutes(
  chars: number,
  charsPerMin: number = DEFAULT_CHARS_PER_MINUTE
): number {
  return Math.max(1, Math.ceil(chars / charsPerMin));
}

/** 日付のみを ja-JP で表示する。空値は「未設定」。 */
export function formatDateJa(value: string | null | undefined): string {
  if (!value) {
    return "未設定";
  }
  try {
    return new Date(value).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return value;
  }
}

/** 日時を ja-JP で表示する。options 指定で短縮表記にも対応する。 */
export function formatDateTimeJa(
  value: string,
  options?: Intl.DateTimeFormatOptions
): string {
  try {
    return options
      ? new Date(value).toLocaleString("ja-JP", options)
      : new Date(value).toLocaleString("ja-JP");
  } catch {
    return value;
  }
}
