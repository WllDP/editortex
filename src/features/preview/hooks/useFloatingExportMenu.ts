import { useEffect, type RefObject } from "react";

export function useFloatingExportMenu({
  buttonRef,
  isOpen,
  menuRef,
  setIsOpen,
  setPosition,
}: {
  buttonRef: RefObject<HTMLButtonElement>;
  isOpen: boolean;
  menuRef: RefObject<HTMLDivElement>;
  setIsOpen: (isOpen: boolean) => void;
  setPosition: (position: { top: number; right: number }) => void;
}) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    updatePosition();

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) {
        setIsOpen(false);
      }
    }

    function updatePosition() {
      const button = buttonRef.current;
      if (!button) {
        return;
      }

      const rect = button.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        right: Math.max(window.innerWidth - rect.right, 12),
      });
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [buttonRef, isOpen, menuRef, setIsOpen, setPosition]);
}
