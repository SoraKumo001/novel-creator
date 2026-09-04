import { useEffect, useState } from "react";

const NAV_COLLAPSED_STORAGE_KEY = "novel-creator:nav-collapsed";

/**
 * サイドバーの折りたたみ状態（localStorage 永続化）。
 * 既存のキー・既定値・トグル挙動は維持する。
 */
export function useNavCollapsed(): {
  isCollapsed: boolean;
  toggleCollapsed: () => void;
} {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(
    () => localStorage.getItem(NAV_COLLAPSED_STORAGE_KEY) === "true"
  );

  const toggleCollapsed = (): void => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(NAV_COLLAPSED_STORAGE_KEY, String(next));
      return next;
    });
  };

  return { isCollapsed, toggleCollapsed };
}

/**
 * モバイル用ドロワーの開閉状態。
 * Escape で閉じる・body スクロール固定の発火条件（isMobileOpen）は維持する。
 */
export function useMobileNav(): {
  isMobileOpen: boolean;
  openMobileNav: () => void;
  closeMobileNav: () => void;
} {
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);

  const openMobileNav = (): void => {
    setIsMobileOpen(true);
  };

  const closeMobileNav = (): void => {
    setIsMobileOpen(false);
  };

  useEffect(() => {
    if (!isMobileOpen) {
      return;
    }
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        setIsMobileOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileOpen]);

  return { isMobileOpen, openMobileNav, closeMobileNav };
}
