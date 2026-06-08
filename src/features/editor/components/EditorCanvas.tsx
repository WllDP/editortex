import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { LayoutTemplate, PlusCircle, SquareStack } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { SortableBlockCard } from "@/features/editor/components/SortableBlockCard";
import { ModuleList } from "@/components/sidebar/ModuleList";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/store/editorStore";
import { cn } from "@/utils/cn";

export function EditorCanvas() {
  const document = useEditorStore((state) => state.document);
  const selectedBlockId = useEditorStore((state) => state.selectedBlockId);
  const orderedBlocks = useMemo(() => [...document.blocks].sort((a, b) => a.order - b.order), [document.blocks]);
  const { isOver, setNodeRef } = useDroppable({ id: "editor-dropzone" });
  const [isDynamicEditorMode, setIsDynamicEditorMode] = useState(false);
  const [isBlockLibraryOpen, setIsBlockLibraryOpen] = useState(false);
  const [suggestionAnchorBlockId, setSuggestionAnchorBlockId] = useState<string>();
  const lastBlockId = orderedBlocks.at(-1)?.id;
  const visibleSuggestionBlockId = isDynamicEditorMode ? (suggestionAnchorBlockId ?? lastBlockId) : undefined;

  useEffect(() => {
    if (!isDynamicEditorMode || !selectedBlockId) {
      return;
    }

    const selectedBlockExists = orderedBlocks.some((block) => block.id === selectedBlockId);
    if (selectedBlockExists) {
      setSuggestionAnchorBlockId(selectedBlockId);
    }
  }, [isDynamicEditorMode, orderedBlocks, selectedBlockId]);

  useEffect(() => {
    if (!isDynamicEditorMode || !suggestionAnchorBlockId) {
      return;
    }

    const anchorExists = orderedBlocks.some((block) => block.id === suggestionAnchorBlockId);
    if (!anchorExists) {
      setSuggestionAnchorBlockId(lastBlockId);
    }
  }, [isDynamicEditorMode, lastBlockId, orderedBlocks, suggestionAnchorBlockId]);

  function handleSuggestionInserted(blockId: string) {
    setSuggestionAnchorBlockId(blockId);
  }

  return (
    <main className="app-panel relative z-10 flex min-h-0 flex-col overflow-hidden rounded-l-2xl rounded-r-none border-r-0">
      <div className="h-[104px] shrink-0 overflow-hidden border-b border-white/14 bg-white/[0.055] py-4 pl-4 pr-6 backdrop-blur-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1 pl-16">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="h-3 w-3 shrink-0 rounded-full bg-[#22D3EE] shadow-[0_0_18px_rgba(34,211,238,0.72)]" />
                <TruncatedDocumentTitle title={document.title} />
              </div>

              <div className="inline-flex shrink-0 items-center gap-1 overflow-hidden rounded-2xl border border-white/14 bg-white/[0.07] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className={cn("px-3.5", isDynamicEditorMode && "dynamic-editor-toggle-active")}
                  aria-pressed={isDynamicEditorMode}
                  onClick={() => {
                    setIsDynamicEditorMode((current) => {
                      const next = !current;
                      if (!next) {
                        setSuggestionAnchorBlockId(undefined);
                      }
                      return next;
                    });
                    setIsBlockLibraryOpen(false);
                  }}
                >
                  <LayoutTemplate className="h-4 w-4" />
                  Editor Dinâmico
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={isBlockLibraryOpen ? "default" : "ghost"}
                  className="px-3.5"
                  onClick={() => {
                    setIsDynamicEditorMode(false);
                    setSuggestionAnchorBlockId(undefined);
                    setIsBlockLibraryOpen((current) => !current);
                  }}
                >
                  <SquareStack className="h-4 w-4" />
                  Blocos
                </Button>
              </div>
            </div>

            <p className="mt-1 text-xs font-medium text-[#94A3B8]">{orderedBlocks.length} blocos no documento</p>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1">
          <div
            ref={setNodeRef}
            className={cn("min-h-0 flex-1 overflow-y-auto bg-transparent py-6 pl-6 pr-8", isOver && "bg-[#22D3EE]/12")}
          >
            <div className="mx-auto max-w-3xl">
              {orderedBlocks.length === 0 ? (
                <div
                  className={cn(
                    "metro-card flex min-h-80 flex-col items-center justify-center rounded-3xl border-dashed text-center",
                    isOver && "bg-[#22D3EE]/12",
                  )}
                >
                  <PlusCircle className="mb-3 h-10 w-10 text-[#22D3EE]" />
                  <p className="text-lg font-semibold text-white">Arraste modulos para comecar</p>
                  <p className="mt-1 text-xs font-medium text-[#94A3B8]">
                    Os blocos serao gerados a partir do preambulo do template.
                  </p>
                </div>
              ) : (
                <SortableContext items={orderedBlocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-3">
                    {orderedBlocks.map((block) => (
                      <SortableBlockCard
                        key={block.id}
                        block={block}
                        showSuggestions={visibleSuggestionBlockId === block.id}
                        onSuggestionInserted={handleSuggestionInserted}
                      />
                    ))}
                  </div>
                </SortableContext>
              )}
            </div>
          </div>

          <aside
            className={cn(
              "min-h-0 overflow-hidden border-l border-white/14 bg-white/[0.045] backdrop-blur-xl transition-[width,opacity] duration-300",
              isBlockLibraryOpen ? "w-[280px] opacity-100" : "w-0 opacity-0",
            )}
            aria-hidden={!isBlockLibraryOpen}
          >
            <div className="flex h-full w-[280px] flex-col">
              <div className="border-b border-white/12 px-4 py-3">
                <div className="flex items-center gap-2">
                  <SquareStack className="h-4 w-4 text-[#22D3EE]" />
                  <h3 className="text-sm font-semibold text-white">Blocos</h3>
                </div>
                <p className="mt-1 text-xs font-medium text-[#94A3B8]">Arraste para adicionar ao editor.</p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <ModuleList />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function TruncatedDocumentTitle({ title }: { title: string }) {
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useLayoutEffect(() => {
    const titleElement = titleRef.current;
    if (!titleElement) {
      return;
    }

    const updateTruncation = () => {
      setIsTruncated(titleElement.scrollWidth > titleElement.clientWidth + 1);
    };

    updateTruncation();
    const observer = new ResizeObserver(updateTruncation);
    observer.observe(titleElement);
    return () => observer.disconnect();
  }, [title]);

  return (
    <div className="group/title relative min-w-0 flex-1">
      <h2 ref={titleRef} className="truncate text-xl font-semibold text-white">
        {title}
      </h2>
      {isTruncated ? (
        <div className="pointer-events-none absolute left-0 top-[calc(100%+8px)] z-50 max-w-[min(520px,calc(100vw-48px))] rounded-xl border border-white/12 bg-[#111936]/95 px-3 py-2 text-xs font-semibold leading-snug text-white opacity-0 shadow-[0_18px_48px_rgba(0,0,0,0.36)] backdrop-blur-2xl transition-opacity duration-150 group-hover/title:opacity-100">
          {title}
        </div>
      ) : null}
    </div>
  );
}
