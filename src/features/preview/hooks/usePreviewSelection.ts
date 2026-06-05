import { useEffect, useRef, type RefObject } from "react";

export function usePreviewSelection(
  viewportRef: RefObject<HTMLElement>,
  selectedBlockId: string | undefined,
  pageScale: number,
) {
  const blockRefs = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    if (!selectedBlockId) {
      return;
    }

    const viewport = viewportRef.current;
    const selectedElement = blockRefs.current.get(selectedBlockId);
    if (!viewport || !selectedElement) {
      return;
    }

    const viewportRect = viewport.getBoundingClientRect();
    const elementRect = selectedElement.getBoundingClientRect();
    const nextTop =
      viewport.scrollTop + (elementRect.top - viewportRect.top) - viewport.clientHeight / 2 + elementRect.height / 2;

    viewport.scrollTo({
      top: Math.max(nextTop, 0),
      behavior: "smooth",
    });
  }, [selectedBlockId, pageScale, viewportRef]);

  return (blockId: string) => (node: HTMLElement | null) => {
    if (node) {
      blockRefs.current.set(blockId, node);
    } else {
      blockRefs.current.delete(blockId);
    }
  };
}
