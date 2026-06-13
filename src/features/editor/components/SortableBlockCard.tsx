import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AnimatePresence, motion } from "framer-motion";
import { Copy, GripVertical, ImagePlus, Trash2 } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { SuggestionCarousel } from "@/features/block-suggestions/SuggestionCarousel";
import { useBlockSuggestions } from "@/features/block-suggestions/hooks/useBlockSuggestions";
import { LexicalTextEditor } from "@/features/editor/components/LexicalTextEditor";
import type { BlockInstance } from "@/types/blocks";
import { lexicalTextDataKey } from "@/types/editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useEditorStore } from "@/store/editorStore";
import { useNotificationStore } from "@/store/notificationStore";
import { cn } from "@/utils/cn";

export const SortableBlockCard = memo(function SortableBlockCard({
  block,
  showSuggestions,
  onSuggestionInserted,
}: {
  block: BlockInstance;
  showSuggestions: boolean;
  onSuggestionInserted: (blockId: string) => void;
}) {
  const articleRef = useRef<HTMLElement | null>(null);
  const collapseResetTimeoutRef = useRef<number>();
  const [isDragCollapseInstant, setIsDragCollapseInstant] = useState(false);
  const availableBlocks = useEditorStore((state) => state.availableBlocks);
  const documentBlocks = useEditorStore((state) => state.document.blocks);
  const definition = availableBlocks.find((candidate) => candidate.id === block.definitionId);
  const isSelected = useEditorStore((state) => state.selectedBlockId === block.id);
  const updateBlockData = useEditorStore((state) => state.updateBlockData);
  const attachImageToBlock = useEditorStore((state) => state.attachImageToBlock);
  const duplicateBlock = useEditorStore((state) => state.duplicateBlock);
  const insertBlockAfter = useEditorStore((state) => state.insertBlockAfter);
  const removeBlock = useEditorStore((state) => state.removeBlock);
  const selectBlock = useEditorStore((state) => state.selectBlock);
  const pendingFocusBlockId = useEditorStore((state) => state.pendingFocusBlockId);
  const clearPendingBlockFocus = useEditorStore((state) => state.clearPendingBlockFocus);
  const notify = useNotificationStore((state) => state.notify);
  const currentIndex = documentBlocks.findIndex((candidate) => candidate.id === block.id);
  const suggestions = useBlockSuggestions({
    currentBlock: block,
    availableBlocks,
    documentBlocks,
    currentIndex,
  });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    data: {
      type: "document-block",
      blockId: block.id,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const collapsedPreview = Object.entries(block.data)
    .filter(([key]) => key !== lexicalTextDataKey)
    .map(([, value]) => value.trim())
    .find(Boolean);

  useEffect(() => {
    if (!isSelected) {
      return;
    }

    articleRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [isSelected]);

  useEffect(() => {
    return () => {
      if (collapseResetTimeoutRef.current) {
        window.clearTimeout(collapseResetTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isSelected || pendingFocusBlockId !== block.id) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      const firstTextField = articleRef.current?.querySelector<HTMLElement>(
        'textarea:not([disabled]), input:not([type="hidden"]):not([disabled]), [contenteditable="true"]',
      );
      firstTextField?.focus();
      clearPendingBlockFocus(block.id);
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [block.id, clearPendingBlockFocus, isSelected, pendingFocusBlockId]);

  function handleSuggestionSelect(definitionId: string) {
    const insertedBlockId = insertBlockAfter(block.id, definitionId);
    if (insertedBlockId) {
      onSuggestionInserted(insertedBlockId);
    }
  }

  return (
    <div ref={setNodeRef} style={style} data-editor-block-card>
      <motion.article
        ref={(node) => {
          articleRef.current = node;
        }}
        initial={
          pendingFocusBlockId === block.id
            ? {
                opacity: 0.82,
                scaleX: 0.28,
                scaleY: 0.72,
                y: -18,
                borderRadius: 12,
                transformOrigin: "left center",
              }
            : false
        }
        animate={{
          opacity: isDragging ? 0.45 : 1,
          scaleX: 1,
          scaleY: 1,
          y: 0,
          borderRadius: 24,
          transformOrigin: "left center",
        }}
        layoutId={isDragging || isDragCollapseInstant ? undefined : `document-block-${block.id}`}
        layout={isDragCollapseInstant ? false : "position"}
        transition={{
          opacity: {
            duration: 0.18,
            ease: [0.25, 0.8, 0.25, 1] as const,
          },
          scaleX: {
            duration: 0.28,
            ease: [0.25, 0.8, 0.25, 1] as const,
          },
          scaleY: {
            duration: 0.28,
            ease: [0.25, 0.8, 0.25, 1] as const,
          },
          y: {
            duration: 0.24,
            ease: [0.25, 0.8, 0.25, 1] as const,
          },
          layout: {
            duration: 0.18,
            ease: [0.25, 0.8, 0.25, 1] as const,
          },
        }}
        data-editor-block-surface
        tabIndex={-1}
        className={cn(
          "metro-card overflow-hidden rounded-3xl transition-[opacity,background-color,border-color] duration-200 hover:bg-white/[0.1]",
          isSelected && "border-[#22D3EE]/45 bg-white/[0.12] shadow-[inset_0_0_0_1px_rgba(34,211,238,0.22)]",
          isDragging && "relative z-30 scale-[0.98]",
        )}
        onFocus={() => selectBlock(block.id)}
        onClick={() => selectBlock(block.id)}
        onDoubleClick={(event) => {
          event.stopPropagation();
          selectBlock(isSelected ? undefined : block.id);
        }}
      >
        <div
          className={cn(
            "flex items-center justify-between gap-3 bg-white/[0.055] px-3 py-2.5 transition-colors",
            isSelected && "border-b border-white/12",
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              className="touch-none cursor-grab rounded-xl border border-white/14 bg-white/[0.07] p-1 text-[#22D3EE] transition-colors hover:bg-white/[0.12] hover:text-white active:cursor-grabbing"
              {...attributes}
              {...listeners}
              onPointerDownCapture={() => {
                if (isSelected) {
                  flushSync(() => {
                    setIsDragCollapseInstant(true);
                    selectBlock(undefined);
                  });
                  if (collapseResetTimeoutRef.current) {
                    window.clearTimeout(collapseResetTimeoutRef.current);
                  }
                  collapseResetTimeoutRef.current = window.setTimeout(() => {
                    setIsDragCollapseInstant(false);
                  }, 180);
                }
              }}
              tabIndex={-1}
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-white">{definition?.name ?? block.variableName}</h3>
              <p className="truncate text-xs font-medium text-[#94A3B8]">
                {isSelected ? `\\${block.variableName}` : collapsedPreview || `\\${block.variableName}`}
              </p>
            </div>
          </div>
          {isSelected ? (
            <div className="flex items-center gap-1.5">
              <Button
                className="h-9 w-9"
                variant="ghost"
                size="icon"
                type="button"
                tabIndex={-1}
                onClick={(event) => {
                  event.stopPropagation();
                  duplicateBlock(block.id);
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                className="h-9 w-9"
                variant="ghost"
                size="icon"
                type="button"
                tabIndex={-1}
                onClick={(event) => {
                  event.stopPropagation();
                  removeBlock(block.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <span className="shrink-0 rounded-full border border-white/12 bg-white/[0.07] px-2 py-1 text-xs font-semibold leading-none text-[#D1D5DB]">
              {definition?.fields.length ?? 0}
            </span>
          )}
        </div>

        <div
          className={cn(
            "grid",
            isDragCollapseInstant ? "transition-none" : "transition-[grid-template-rows,opacity] duration-300 ease-out",
            isSelected ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="space-y-3 p-3">
              {definition?.fields.map((field) =>
                isPlainTextRichTextField(block, field.id) ? (
                  <div key={field.id} className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase text-[#D1D5DB]">{field.label}</span>
                    <LexicalTextEditor
                      value={block.data[field.id] ?? ""}
                      lexicalJson={block.data[lexicalTextDataKey]}
                      placeholder={field.placeholder}
                      onFocus={() => selectBlock(block.id)}
                      onChange={({ plainText, lexicalJson }) =>
                        updateBlockData(block.id, {
                          [field.id]: plainText,
                          [lexicalTextDataKey]: lexicalJson,
                        })
                      }
                    />
                  </div>
                ) : (
                  <label key={field.id} className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase text-[#D1D5DB]">{field.label}</span>
                    {isImageField(block, field.id) ? (
                      <div className="flex gap-2">
                        <Input
                          value={block.data[field.id] ?? ""}
                          placeholder={field.placeholder}
                          onFocus={() => selectBlock(block.id)}
                          onDoubleClick={(event) => event.stopPropagation()}
                          onChange={(event) => updateBlockData(block.id, { [field.id]: event.target.value })}
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          type="button"
                          aria-label="Anexar imagem"
                          tabIndex={-1}
                          onClick={(event) => {
                            event.stopPropagation();
                            document.getElementById(`image-upload-${block.id}-${field.id}`)?.click();
                          }}
                        >
                          <ImagePlus className="h-4 w-4" />
                        </Button>
                        <input
                          id={`image-upload-${block.id}-${field.id}`}
                          className="hidden"
                          type="file"
                          accept="image/*"
                          onFocus={() => selectBlock(block.id)}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => {
                            const [file] = Array.from(event.target.files ?? []);
                            if (file) {
                              void attachImageToBlock(block.id, file).catch((err: unknown) => {
                                notify({
                                  kind: "error",
                                  title: "Falha ao anexar imagem",
                                  message: err instanceof Error ? err.message : "Nao foi possivel carregar a imagem.",
                                });
                              });
                            }
                            event.target.value = "";
                          }}
                        />
                      </div>
                    ) : (
                      <Textarea
                        value={block.data[field.id] ?? ""}
                        placeholder={field.placeholder}
                        onFocus={() => selectBlock(block.id)}
                        onDoubleClick={(event) => event.stopPropagation()}
                        onChange={(event) => updateBlockData(block.id, { [field.id]: event.target.value })}
                      />
                    )}
                  </label>
                ),
              )}
            </div>
          </div>
        </div>
      </motion.article>
      <AnimatePresence initial={false}>
        {showSuggestions ? (
          <motion.div
            key="block-suggestions"
            className="overflow-hidden"
            initial={{ height: 0, opacity: 0, y: -8 }}
            animate={{ height: "auto", opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -6 }}
            transition={{ duration: 0.24, ease: [0.25, 0.8, 0.25, 1] }}
          >
            <SuggestionCarousel suggestions={suggestions} onSelect={handleSuggestionSelect} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
});

function isImageField(block: BlockInstance, fieldId: string) {
  return fieldId === "image" && (block.type === "attached-image" || block.type === "final-image");
}

function isPlainTextRichTextField(block: BlockInstance, fieldId: string) {
  return block.type === "plain-text" && fieldId === "text";
}
