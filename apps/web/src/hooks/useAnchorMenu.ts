import { type RefObject, useLayoutEffect, useRef, useState } from "react";

export interface AnchorMenuPosition {
  bottom?: number;
  right: number;
  top?: number;
}

/**
 * ツールバー dropdown を body ポータル＋fixed 配置で出すための位置決めフック。
 * メニューを in-flow の absolute のままにすると、祖先の overflow-hidden での切り取りや、
 * Monaco 内部レイヤーとのペイント順負けでエディタ面の裏に隠れるのを回避する。
 */
export function useAnchorMenu(
  open: boolean,
  triggerRef: RefObject<HTMLDivElement | null>
) {
  const menuRef = useRef<HTMLDivElement>(null);
  const syncRect =
    open && typeof window !== "undefined"
      ? (triggerRef.current?.getBoundingClientRect() ?? null)
      : null;
  const syncPosition: AnchorMenuPosition = {
    right: syncRect ? Math.max(8, window.innerWidth - syncRect.right) : 0,
    top: syncRect ? syncRect.bottom + 4 : 0,
  };
  // マウント後に実測した位置（flip 済み）。null の間は非表示のままにする。
  const [measuredPosition, setMeasuredPosition] =
    useState<AnchorMenuPosition | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setMeasuredPosition(null);
      return;
    }
    const decide = () => {
      const trigger = triggerRef.current;
      if (!trigger || typeof window === "undefined") {
        return;
      }
      const rect = trigger.getBoundingClientRect();
      const gap = 4;
      const right = Math.max(8, window.innerWidth - rect.right);
      const menuHeight = menuRef.current?.offsetHeight ?? 0;
      if (
        menuHeight > 0 &&
        rect.bottom + gap + menuHeight > window.innerHeight &&
        rect.top - gap - menuHeight > 0
      ) {
        setMeasuredPosition({
          bottom: window.innerHeight - rect.top + gap,
          right,
        });
      } else {
        setMeasuredPosition({ top: rect.bottom + gap, right });
      }
    };
    decide();
    window.addEventListener("resize", decide);
    window.addEventListener("scroll", decide, true);
    return () => {
      window.removeEventListener("resize", decide);
      window.removeEventListener("scroll", decide, true);
    };
  }, [open, triggerRef]);

  return {
    menuRef,
    position: measuredPosition ?? syncPosition,
    ready: measuredPosition !== null,
  };
}
