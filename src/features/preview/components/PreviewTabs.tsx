import { Code2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";

export type PreviewTab = "visual" | "pdf" | "tex";

interface PreviewTabsProps {
  activeTab: PreviewTab;
  canUpdatePdf: boolean;
  isCompiling: boolean;
  onChange: (tab: PreviewTab) => void;
  onUpdatePdf: () => void;
}

export function PreviewTabs({ activeTab, canUpdatePdf, isCompiling, onChange, onUpdatePdf }: PreviewTabsProps) {
  return (
    <div className="inline-flex shrink-0 items-center gap-1.5 overflow-hidden rounded-2xl border border-white/14 bg-white/[0.07] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
      <button
        className={cn(
          "h-9 rounded-xl px-3.5 text-sm font-semibold leading-none transition-colors duration-200",
          activeTab === "visual"
            ? "bg-[#2563EB]/88 text-white shadow-none"
            : "text-[#D1D5DB] hover:bg-white/[0.08] hover:text-white",
        )}
        type="button"
        onClick={() => onChange("visual")}
      >
        Visual
      </button>
      <div
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-xl border transition-[background-color,border-color,padding] duration-300 ease-out",
          activeTab === "pdf" ? "border-white/[0.07] bg-white/[0.035] p-1" : "border-transparent bg-transparent p-0",
        )}
      >
        <button
          className={cn(
            "h-9 rounded-xl px-3.5 text-sm font-semibold leading-none transition-colors duration-200",
            activeTab === "pdf"
              ? "bg-[#2563EB]/88 text-white shadow-none"
              : "text-[#D1D5DB] hover:bg-white/[0.08] hover:text-white",
          )}
          type="button"
          onClick={() => onChange("pdf")}
        >
          PDF
        </button>
        <div
          className={cn(
            "grid overflow-hidden transition-[grid-template-columns,opacity] duration-300 ease-out",
            activeTab === "pdf" ? "grid-cols-[1fr] opacity-100" : "grid-cols-[0fr] opacity-0",
          )}
          aria-hidden={activeTab !== "pdf"}
        >
          <div className="min-w-0 overflow-hidden">
            <Button
              variant="ghost"
              size="icon"
              type="button"
              className="h-9 w-9 rounded-xl bg-transparent text-white shadow-none backdrop-blur-0 transition-colors duration-200 hover:bg-white/15 hover:text-white disabled:opacity-45"
              aria-label="Atualizar PDF"
              disabled={!canUpdatePdf}
              onClick={onUpdatePdf}
              tabIndex={activeTab === "pdf" ? 0 : -1}
            >
              {isCompiling ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
      <button
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold leading-none transition-colors duration-200",
          activeTab === "tex"
            ? "bg-[#2563EB]/88 text-white shadow-none"
            : "text-[#D1D5DB] hover:bg-white/[0.08] hover:text-white",
        )}
        type="button"
        onClick={() => onChange("tex")}
      >
        <Code2 className="h-4 w-4" />
        Tex
      </button>
    </div>
  );
}
