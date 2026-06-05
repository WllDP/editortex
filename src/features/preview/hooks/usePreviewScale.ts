import { useEffect, useMemo, useState, type RefObject } from "react";
import { PAGE_WIDTH } from "@/features/preview/components/htmlPreviewModel";

const PREVIEW_PADDING_X = 48;
const MIN_PREVIEW_SCALE = 0.52;

export function usePreviewScale(viewportRef: RefObject<HTMLElement>, enabled: boolean) {
  const [viewportWidth, setViewportWidth] = useState(0);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !enabled) {
      return;
    }

    const updateWidth = () => setViewportWidth(viewport.clientWidth);
    updateWidth();
    const animationFrameId = window.requestAnimationFrame(updateWidth);

    const observer = new ResizeObserver(updateWidth);
    observer.observe(viewport);
    return () => {
      window.cancelAnimationFrame(animationFrameId);
      observer.disconnect();
    };
  }, [enabled, viewportRef]);

  return useMemo(() => {
    if (!viewportWidth) {
      return 1;
    }

    const availableWidth = Math.max(viewportWidth - PREVIEW_PADDING_X, 0);
    return Math.min(1, Math.max(MIN_PREVIEW_SCALE, availableWidth / PAGE_WIDTH));
  }, [viewportWidth]);
}
