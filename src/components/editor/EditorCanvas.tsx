import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Code2, LayoutTemplate, PlusCircle, SquareStack } from "lucide-react";
import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { SortableBlockCard } from "@/components/editor/SortableBlockCard";
import { ModuleList } from "@/components/sidebar/ModuleList";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/store/editorStore";
import { cn } from "@/utils/cn";

type EditorTab = "blocks" | "tex";

const TexSourcePanel = lazy(() =>
  import("@/components/editor/TexSourcePanel").then((module) => ({ default: module.TexSourcePanel })),
);

export function EditorCanvas() {
  const document = useEditorStore((state) => state.document);
  const orderedBlocks = [...document.blocks].sort((a, b) => a.order - b.order);
  const { isOver, setNodeRef } = useDroppable({ id: "editor-dropzone" });
  const [activeTab, setActiveTab] = useState<EditorTab>("blocks");
  const [isBlockLibraryOpen, setIsBlockLibraryOpen] = useState(false);

  useEffect(() => {
    if (activeTab === "tex") {
      setIsBlockLibraryOpen(false);
    }
  }, [activeTab]);

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

              <div className="inline-flex shrink-0 items-center gap-1.5 overflow-hidden rounded-2xl border border-white/14 bg-white/[0.07] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl">
                <div
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-xl border transition-[background-color,border-color,padding] duration-300 ease-out",
                    activeTab === "blocks"
                      ? "border-white/[0.07] bg-white/[0.035] p-1"
                      : "border-transparent bg-transparent p-0",
                  )}
                >
                  <Button
                    type="button"
                    size="sm"
                    variant={activeTab === "blocks" ? "default" : "ghost"}
                    className="px-3.5"
                    onClick={() => setActiveTab("blocks")}
                  >
                    <LayoutTemplate className="h-4 w-4" />
                    Editor
                  </Button>
                  <div
                    className={cn(
                      "grid overflow-hidden transition-[grid-template-columns,opacity] duration-300 ease-out",
                      activeTab === "blocks" ? "grid-cols-[1fr] opacity-100" : "grid-cols-[0fr] opacity-0",
                    )}
                    aria-hidden={activeTab !== "blocks"}
                  >
                    <div className="min-w-0 overflow-hidden">
                      <Button
                        type="button"
                        size="sm"
                        variant={isBlockLibraryOpen ? "default" : "ghost"}
                        className="px-3.5"
                        onClick={() => setIsBlockLibraryOpen((current) => !current)}
                        tabIndex={activeTab === "blocks" ? 0 : -1}
                      >
                        <SquareStack className="h-4 w-4" />
                        Blocos
                      </Button>
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={activeTab === "tex" ? "default" : "ghost"}
                  className="px-3.5"
                  onClick={() => setActiveTab("tex")}
                >
                  <Code2 className="h-4 w-4" />
                  Tex
                </Button>
              </div>
            </div>

            <p className="mt-1 text-xs font-medium text-[#94A3B8]">
              {orderedBlocks.length} blocos no documento
            </p>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {activeTab === "blocks" ? (
          <div className="flex min-h-0 flex-1">
            <div
              ref={setNodeRef}
              className={cn(
                "min-h-0 flex-1 overflow-y-auto bg-transparent py-6 pl-6 pr-8",
                isOver && "bg-[#22D3EE]/12",
              )}
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
                        <SortableBlockCard key={block.id} block={block} />
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
        ) : (
          <Suspense
            fallback={
              <div className="flex flex-1 items-center justify-center bg-transparent text-xs font-semibold text-[#D1D5DB]">
                Carregando editor TEX...
              </div>
            }
          >
            <TexSourcePanel />
          </Suspense>
        )}
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
