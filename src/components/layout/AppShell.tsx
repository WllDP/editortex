import {
  DndContext,
  type CollisionDetection,
  DragEndEvent,
  DragOverlay,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { LayoutGroup, motion } from "framer-motion";
import { Menu } from "lucide-react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { EditorCanvas } from "@/features/editor/components/EditorCanvas";
import { PreviewPanel } from "@/features/preview/components/PreviewPanel";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/store/editorStore";
import { cn } from "@/utils/cn";

const RESIZER_WIDTH = 8;
const MIN_EDITOR_WIDTH = 320;
const SHELL_GAP_WIDTH = 0;
const SHELL_GAP_COUNT = 0;
const MAX_PANEL_RATIO = 1.5;
const CENTER_SNAP_THRESHOLD = 28;
const smoothEase = [0.25, 0.8, 0.25, 1] as const;
const documentBlockCollisionDetection: CollisionDetection = (args) => {
  const collisions = closestCenter(args);

  if (args.active.data.current?.type !== "document-block") {
    return collisions;
  }

  return collisions.filter((collision) => {
    const droppable = args.droppableContainers.find((container) => container.id === collision.id);
    return droppable?.data.current?.type === "document-block";
  });
};

export function AppShell() {
  const insertBlockAt = useEditorStore((state) => state.insertBlockAt);
  const reorderBlocks = useEditorStore((state) => state.reorderBlocks);
  const selectBlock = useEditorStore((state) => state.selectBlock);
  const availableBlocks = useEditorStore((state) => state.availableBlocks);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [previewWidth, setPreviewWidth] = useState<number>();
  const [isPreviewResizing, setIsPreviewResizing] = useState(false);
  const [isPreviewResizeSnapped, setIsPreviewResizeSnapped] = useState(false);
  const [draggedLibraryBlockId, setDraggedLibraryBlockId] = useState<string>();
  const [libraryInsertionIndex, setLibraryInsertionIndex] = useState<number>();
  const latestPointerPositionRef = useRef<{ x: number; y: number }>();
  const draggedLibraryBlock = availableBlocks.find((block) => block.id === draggedLibraryBlockId);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || previewWidth !== undefined) {
      return;
    }

    setPreviewWidth(getDefaultPreviewWidth(shell));
  }, [previewWidth]);

  useEffect(() => {
    function updatePointerPosition(event: PointerEvent) {
      latestPointerPositionRef.current = {
        x: event.clientX,
        y: event.clientY,
      };
    }

    function updateTouchPosition(event: TouchEvent) {
      const touch = event.touches[0] ?? event.changedTouches[0];
      if (!touch) {
        return;
      }

      latestPointerPositionRef.current = {
        x: touch.clientX,
        y: touch.clientY,
      };
    }

    window.addEventListener("pointermove", updatePointerPosition, { passive: true });
    window.addEventListener("touchmove", updateTouchPosition, { passive: true });
    window.addEventListener("touchend", updateTouchPosition, { passive: true });

    return () => {
      window.removeEventListener("pointermove", updatePointerPosition);
      window.removeEventListener("touchmove", updateTouchPosition);
      window.removeEventListener("touchend", updateTouchPosition);
    };
  }, []);

  function handleDragStart(event: DragStartEvent) {
    latestPointerPositionRef.current = getClientPosition(event.activatorEvent);

    if (event.active.data.current?.type === "library-block") {
      setDraggedLibraryBlockId(String(event.active.data.current.definitionId));
      setLibraryInsertionIndex(undefined);
      selectBlock(undefined);
      return;
    }

    if (event.active.data.current?.type === "document-block") {
      setDraggedLibraryBlockId(undefined);
      setLibraryInsertionIndex(undefined);
      selectBlock(undefined);
    }
  }

  function handleDragOver(event: DragOverEvent) {
    if (event.active.data.current?.type !== "library-block") {
      setLibraryInsertionIndex(undefined);
      return;
    }

    const pointerPosition = getDragPointerPosition(event, latestPointerPositionRef.current);
    if (!pointerPosition || !isPointInsideEditorPanel(pointerPosition)) {
      setLibraryInsertionIndex(undefined);
      return;
    }

    setLibraryInsertionIndex(getInsertionIndexFromPointerY(pointerPosition.y));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const latestPointerPosition = latestPointerPositionRef.current;
    setDraggedLibraryBlockId(undefined);
    setLibraryInsertionIndex(undefined);
    latestPointerPositionRef.current = undefined;

    const activeType = active.data.current?.type;
    if (activeType === "library-block") {
      const pointerPosition = getDragPointerPosition(event, latestPointerPosition);
      if (!pointerPosition || !isPointInsideEditorPanel(pointerPosition)) {
        return;
      }

      const definitionId = String(active.data.current?.definitionId);
      const insertionIndex = getInsertionIndexFromPointerY(pointerPosition.y);
      insertBlockAt(definitionId, insertionIndex);
      return;
    }

    if (!over) {
      return;
    }

    if (activeType === "document-block" && over.data.current?.type === "document-block" && active.id !== over.id) {
      reorderBlocks(String(active.id), String(over.id));
    }
  }

  function startPreviewResize(event: ReactPointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsPreviewResizing(true);
    const startX = event.clientX;
    const startWidth = previewWidth ?? getDefaultPreviewWidth(shellRef.current);

    function handlePointerMove(moveEvent: PointerEvent) {
      const nextWidth = startWidth - (moveEvent.clientX - startX);
      const bounds = getPreviewResizeBounds(shellRef.current);
      const snapped = snapPreviewWidthToCenter(nextWidth, bounds);
      setPreviewWidth(snapped.width);
      setIsPreviewResizeSnapped(snapped.snapped);
    }

    function handlePointerUp() {
      setIsPreviewResizing(false);
      setIsPreviewResizeSnapped(false);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={documentBlockCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setDraggedLibraryBlockId(undefined);
        setLibraryInsertionIndex(undefined);
        latestPointerPositionRef.current = undefined;
      }}
    >
      <LayoutGroup id="editor-block-drag">
        <div
          ref={shellRef}
          className="relative grid h-full min-h-0 gap-0 overflow-hidden p-3"
          style={{
            gridTemplateColumns: previewWidth
              ? `minmax(${MIN_EDITOR_WIDTH}px, 1fr) ${RESIZER_WIDTH}px ${previewWidth}px`
              : `minmax(${MIN_EDITOR_WIDTH}px, 1fr) ${RESIZER_WIDTH}px 1fr`,
          }}
        >
          <Button
            type="button"
            size="icon"
            variant="outline"
            className={cn(
              "fixed left-8 top-8 z-40 transition-opacity duration-200",
              isSidebarOpen && "pointer-events-none opacity-0",
            )}
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div
            className={cn(
              "fixed inset-y-0 left-0 z-[60] w-[326px] border-r border-white/15 bg-[#0A1028]/72 shadow-[24px_0_80px_rgba(0,0,0,0.42)] backdrop-blur-2xl transition-transform duration-300",
              isSidebarOpen ? "translate-x-0" : "-translate-x-full",
            )}
          >
            <Sidebar onClose={() => setIsSidebarOpen(false)} />
          </div>

          {isSidebarOpen ? (
            <button
              type="button"
              className="fixed inset-0 z-50 bg-[#050816]/60 backdrop-blur-sm"
              aria-label="Fechar menu lateral"
              onClick={() => setIsSidebarOpen(false)}
            />
          ) : null}

          <EditorCanvas libraryInsertionIndex={libraryInsertionIndex} />
          <div
            role="separator"
            aria-label="Redimensionar preview PDF"
            className={cn(
              "stable-composite stable-glass-divider group relative z-20 flex cursor-col-resize items-center justify-center border-y border-white/16 transition-[filter] duration-200 hover:brightness-110",
              isPreviewResizing && "brightness-110",
            )}
            onPointerDown={startPreviewResize}
          >
            <div
              className={cn(
                "h-28 w-1 rounded-full bg-[#22D3EE] shadow-[0_0_18px_rgba(34,211,238,0.72)] transition-[height,width,background-color,box-shadow] duration-300 ease-out",
                isPreviewResizing && "h-40",
                isPreviewResizeSnapped && "w-1.5 bg-white shadow-[0_0_24px_rgba(34,211,238,0.95)]",
              )}
            />
          </div>
          <PreviewPanel />
        </div>
        <DragOverlay dropAnimation={null} zIndex={1000}>
          {draggedLibraryBlock ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.18, ease: smoothEase }}
              className="relative grid aspect-square w-28 place-items-center rounded-xl border border-[#60A5FA]/45 bg-[#2563EB]/90 p-3 text-center text-sm font-semibold leading-tight text-white shadow-[0_22px_58px_rgba(37,99,235,0.38)] backdrop-blur-2xl"
            >
              <span className="absolute left-3 top-3 grid h-5 w-5 place-items-center rounded-md bg-white/15 text-[10px] text-white/80">
                ::
              </span>
              <span className="line-clamp-3 max-w-full text-balance break-words px-1">{draggedLibraryBlock.name}</span>
            </motion.div>
          ) : null}
        </DragOverlay>
      </LayoutGroup>
    </DndContext>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isPointInsideEditorPanel(point: { x: number; y: number }) {
  const dropzone = document.querySelector<HTMLElement>("[data-editor-dropzone]");
  if (!dropzone) {
    return false;
  }

  const dropzoneRect = dropzone.getBoundingClientRect();
  return (
    point.x >= dropzoneRect.left &&
    point.x <= dropzoneRect.right &&
    point.y >= dropzoneRect.top &&
    point.y <= dropzoneRect.bottom
  );
}

function getInsertionIndexFromPointerY(pointerY: number) {
  const blockCards = Array.from(document.querySelectorAll<HTMLElement>("[data-editor-block-card]"));
  const targetIndex = blockCards.findIndex((card) => {
    const rect = card.getBoundingClientRect();
    return pointerY < rect.top + rect.height / 2;
  });

  return targetIndex === -1 ? blockCards.length : targetIndex;
}

function getDragPointerPosition(event: DragEndEvent | DragOverEvent, latestPointerPosition?: { x: number; y: number }) {
  if (latestPointerPosition) {
    return latestPointerPosition;
  }

  const initialPosition = getClientPosition(event.activatorEvent);
  if (initialPosition) {
    return {
      x: initialPosition.x + event.delta.x,
      y: initialPosition.y + event.delta.y,
    };
  }

  const translatedRect = event.active.rect.current.translated;
  if (!translatedRect) {
    return undefined;
  }

  return {
    x: translatedRect.left + translatedRect.width / 2,
    y: translatedRect.top + translatedRect.height / 2,
  };
}

function getClientPosition(event: Event) {
  if (event instanceof MouseEvent) {
    return {
      x: event.clientX,
      y: event.clientY,
    };
  }

  if (typeof TouchEvent !== "undefined" && event instanceof TouchEvent && event.touches.length > 0) {
    return {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY,
    };
  }

  if (typeof TouchEvent !== "undefined" && event instanceof TouchEvent && event.changedTouches.length > 0) {
    return {
      x: event.changedTouches[0].clientX,
      y: event.changedTouches[0].clientY,
    };
  }

  return undefined;
}

function getDefaultPreviewWidth(shell: HTMLDivElement | null) {
  if (!shell) {
    return 420;
  }

  const bounds = getPreviewResizeBounds(shell);
  return clamp(bounds.availableWidth / 2, bounds.min, bounds.max);
}

function snapPreviewWidthToCenter(value: number, bounds: { availableWidth: number; min: number; max: number }) {
  const width = clamp(value, bounds.min, bounds.max);
  const centerWidth = bounds.availableWidth / 2;
  const snapped = Math.abs(width - centerWidth) <= CENTER_SNAP_THRESHOLD;

  return {
    width: snapped ? centerWidth : width,
    snapped,
  };
}

function getPreviewResizeBounds(shell: HTMLDivElement | null) {
  if (!shell) {
    return {
      availableWidth: 840,
      min: 336,
      max: 504,
    };
  }

  const unavailableWidth = RESIZER_WIDTH + SHELL_GAP_WIDTH * SHELL_GAP_COUNT;
  const availableWidth = Math.max(shell.getBoundingClientRect().width - unavailableWidth, MIN_EDITOR_WIDTH * 2);
  const ratioMin = availableWidth / (1 + MAX_PANEL_RATIO);
  const ratioMax = availableWidth - ratioMin;

  return {
    availableWidth,
    min: Math.max(ratioMin, MIN_EDITOR_WIDTH),
    max: Math.min(ratioMax, availableWidth - MIN_EDITOR_WIDTH),
  };
}
