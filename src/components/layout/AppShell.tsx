import {
  DndContext,
  type CollisionDetection,
  type DropAnimation,
  DragEndEvent,
  DragOverlay,
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
const dragDropAnimation: DropAnimation = {
  duration: 180,
  easing: "cubic-bezier(0.25, 0.8, 0.25, 1)",
};
const smoothEase = [0.25, 0.8, 0.25, 1] as const;
const sharedBlockTransition = {
  layout: {
    duration: 0.18,
    ease: smoothEase,
  },
};
const documentBlockCollisionDetection: CollisionDetection = (args) => {
  const collisions = closestCenter(args);

  if (args.active.data.current?.type !== "document-block") {
    return collisions;
  }

  const sortableCollisions = collisions.filter((collision) => collision.id !== "editor-dropzone");
  return sortableCollisions.length ? sortableCollisions : collisions;
};

export function AppShell() {
  const addBlock = useEditorStore((state) => state.addBlock);
  const reorderBlocks = useEditorStore((state) => state.reorderBlocks);
  const availableBlocks = useEditorStore((state) => state.availableBlocks);
  const documentBlocks = useEditorStore((state) => state.document.blocks);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [previewWidth, setPreviewWidth] = useState<number>();
  const [isPreviewResizing, setIsPreviewResizing] = useState(false);
  const [isPreviewResizeSnapped, setIsPreviewResizeSnapped] = useState(false);
  const [draggedLibraryBlockId, setDraggedLibraryBlockId] = useState<string>();
  const [draggedDocumentBlockId, setDraggedDocumentBlockId] = useState<string>();
  const draggedLibraryBlock = availableBlocks.find((block) => block.id === draggedLibraryBlockId);
  const draggedDocumentBlock = documentBlocks.find((block) => block.id === draggedDocumentBlockId);
  const draggedDocumentDefinition = availableBlocks.find((block) => block.id === draggedDocumentBlock?.definitionId);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || previewWidth !== undefined) {
      return;
    }

    setPreviewWidth(getDefaultPreviewWidth(shell));
  }, [previewWidth]);

  function handleDragStart(event: DragStartEvent) {
    if (event.active.data.current?.type === "library-block") {
      setDraggedLibraryBlockId(String(event.active.data.current.definitionId));
      setDraggedDocumentBlockId(undefined);
      return;
    }

    if (event.active.data.current?.type === "document-block") {
      setDraggedDocumentBlockId(String(event.active.id));
      setDraggedLibraryBlockId(undefined);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setDraggedLibraryBlockId(undefined);
    setDraggedDocumentBlockId(undefined);

    if (!over) {
      return;
    }

    const activeType = active.data.current?.type;
    if (activeType === "library-block") {
      addBlock(String(active.data.current?.definitionId));
      return;
    }

    if (active.id !== over.id && over.id !== "editor-dropzone") {
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
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setDraggedLibraryBlockId(undefined);
        setDraggedDocumentBlockId(undefined);
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

          <EditorCanvas />
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
        <DragOverlay dropAnimation={draggedDocumentBlock ? null : dragDropAnimation} zIndex={1000}>
          {draggedLibraryBlock ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.18, ease: smoothEase }}
              className="flex min-h-11 w-64 items-center gap-2.5 rounded-xl border border-[#60A5FA]/45 bg-[#2563EB]/90 px-3 py-2 text-left text-sm font-semibold leading-none text-white shadow-[0_22px_58px_rgba(37,99,235,0.38)] backdrop-blur-2xl"
            >
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-white/15 text-xs">::</span>
              <span className="min-w-0 flex-1 truncate">{draggedLibraryBlock.name}</span>
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-[#FF4D9D]/35 bg-[#FF4D9D]/75 px-2 text-xs font-semibold leading-none text-white">
                {draggedLibraryBlock.fields.length}
              </span>
            </motion.div>
          ) : draggedDocumentBlock ? (
            <motion.div
              layoutId={`document-block-${draggedDocumentBlock.id}`}
              layout="position"
              initial={{ opacity: 0.85 }}
              animate={{ opacity: 1 }}
              transition={sharedBlockTransition}
              className="flex min-h-12 w-[min(520px,calc(100vw-48px))] items-center gap-3 rounded-2xl border border-[#22D3EE]/45 bg-[#111936]/92 px-3 py-2.5 text-left text-sm font-semibold leading-none text-white shadow-[0_22px_58px_rgba(34,211,238,0.22)] backdrop-blur-2xl"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#22D3EE]/15 text-[#22D3EE]">
                ::
              </span>
              <span className="min-w-0 flex-1 truncate">
                {draggedDocumentDefinition?.name ?? draggedDocumentBlock.variableName}
              </span>
              <span className="shrink-0 rounded-full border border-white/12 bg-white/[0.07] px-2 py-1 text-xs font-semibold leading-none text-[#D1D5DB]">
                {draggedDocumentDefinition?.fields.length ?? 0}
              </span>
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
