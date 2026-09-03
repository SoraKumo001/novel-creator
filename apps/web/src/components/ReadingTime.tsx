import { formatReadingMinutes } from "@/lib/format.js";

interface ReadingTimeProps {
  chars: number;
  className?: string;
}

/**
 * 「読了目安: 約 X 分」表示。計算は Phase1 の `formatReadingMinutes` に委譲する。
 */
export function ReadingTime({ chars, className }: ReadingTimeProps) {
  return (
    <span className={className}>
      読了目安: 約 {formatReadingMinutes(chars)} 分
    </span>
  );
}
