import { Download, FileArchive, FileJson, FileText, Loader2, RefreshCw } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { HtmlBlockPreview } from "@/components/preview/HtmlBlockPreview";
import { useEditorStore } from "@/store/editorStore";
import { useNotificationStore } from "@/store/notificationStore";
import { exportDocumentJson, exportEditedProjectZip, exportTex } from "@/services/exportService";
import { isTauriRuntime } from "@/tauri/runtime";
import { cn } from "@/utils/cn";

const PdfRenderer = lazy(() =>
  import("@/preview/pdfRenderer").then((module) => ({ default: module.PdfRenderer })),
);

export function PreviewPanel() {
  const preview = useEditorStore((state) => state.preview);
  const document = useEditorStore((state) => state.document);
  const uploadedTemplate = useEditorStore((state) => state.uploadedTemplate);
  const availableBlocks = useEditorStore((state) => state.availableBlocks);
  const selectedBlockId = useEditorStore((state) => state.selectedBlockId);
  const compilePreview = useEditorStore((state) => state.compilePreview);
  const ensureGeneratedTex = useEditorStore((state) => state.ensureGeneratedTex);
  const setAutoCompile = useEditorStore((state) => state.setAutoCompile);
  const selectBlock = useEditorStore((state) => state.selectBlock);
  const selectBlockByPreviewText = useEditorStore((state) => state.selectBlockByPreviewText);
  const notify = useNotificationStore((state) => state.notify);
  const [activeTab, setActiveTab] = useState<"visual" | "pdf">("visual");
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [exportMenuPosition, setExportMenuPosition] = useState<{ top: number; right: number }>();
  const [isCompileMessageVisible, setIsCompileMessageVisible] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const exportMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const isDesktopRuntime = isTauriRuntime();
  const canCompilePreview = isDesktopRuntime || import.meta.env.DEV;
  const compileMessageKey = [preview.error, ...preview.diagnostics].filter(Boolean).join("\n");

  useEffect(() => {
    if (!canCompilePreview || !preview.autoCompile) {
      return;
    }

    const hasPendingRevision = preview.compiledRevision !== preview.documentRevision;
    if (preview.status !== "queued" && !(preview.status === "ready" && hasPendingRevision)) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void compilePreview("preview");
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [
    canCompilePreview,
    compilePreview,
    preview.autoCompile,
    preview.compiledRevision,
    preview.documentRevision,
    preview.status,
  ]);

  useEffect(() => {
    if (!isExportMenuOpen) {
      return;
    }

    updateExportMenuPosition();

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!exportMenuRef.current?.contains(target) && !exportMenuButtonRef.current?.contains(target)) {
        setIsExportMenuOpen(false);
      }
    }

    function handleWindowUpdate() {
      updateExportMenuPosition();
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", handleWindowUpdate);
    window.addEventListener("scroll", handleWindowUpdate, true);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", handleWindowUpdate);
      window.removeEventListener("scroll", handleWindowUpdate, true);
    };
  }, [isExportMenuOpen]);

  useEffect(() => {
    if (!compileMessageKey) {
      setIsCompileMessageVisible(false);
      return;
    }

    setIsCompileMessageVisible(true);
    const timeoutId = window.setTimeout(() => {
      setIsCompileMessageVisible(false);
    }, 10000);

    return () => window.clearTimeout(timeoutId);
  }, [compileMessageKey]);

  async function handleExportJson() {
    if (!validateExportReady("exportar JSON")) {
      return;
    }

    const tex = ensureGeneratedTex();
    await exportDocumentJson({
      document,
      tex,
      exportedAt: new Date().toISOString(),
    });
  }

  async function handleExportTex() {
    if (!validateExportReady("exportar TEX")) {
      return;
    }

    await exportTex(ensureGeneratedTex());
  }

  async function handleExportProjectZip() {
    if (!validateExportReady("exportar ZIP")) {
      return;
    }

    await exportEditedProjectZip(uploadedTemplate, ensureGeneratedTex());
  }

  function validateExportReady(actionLabel: string) {
    if (uploadedTemplate) {
      return true;
    }

    notify({
      kind: "warning",
      title: "Importe um arquivo primeiro",
      message: `Para ${actionLabel}, carregue um projeto .tex ou .zip na sidebar.`,
    });
    return false;
  }

  async function runExport(action: () => Promise<void>) {
    setIsExportMenuOpen(false);
    await action();
  }

  function updateExportMenuPosition() {
    const button = exportMenuButtonRef.current;
    if (!button) {
      return;
    }

    const rect = button.getBoundingClientRect();
    setExportMenuPosition({
      top: rect.bottom + 8,
      right: Math.max(window.innerWidth - rect.right, 12),
    });
  }

  function toggleExportMenu() {
    if (!isExportMenuOpen) {
      updateExportMenuPosition();
    }
    setIsExportMenuOpen((current) => !current);
  }

  function handleUpdatePdf() {
    if (!uploadedTemplate) {
      notify({
        kind: "warning",
        title: "Nenhum PDF para atualizar",
        message: "Importe um projeto .tex ou .zip antes de atualizar o preview em PDF.",
      });
      return;
    }

    setActiveTab("pdf");
    void compilePreview("preview");
  }

  const isCompiling = preview.status === "rendering";

  return (
    <>
    <aside className="app-panel relative z-10 flex min-h-0 flex-col overflow-hidden rounded-l-none rounded-r-2xl border-l-0">
      <div className="h-[104px] shrink-0 overflow-hidden border-b border-white/14 bg-white/[0.055] px-4 py-4 backdrop-blur-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-2">
                <span className={cn("h-3 w-3 rounded-full", getStatusColor(preview.status))} />
                <h2 className="text-xl font-semibold text-white">Preview</h2>
              </div>

              <div className="inline-flex shrink-0 items-center gap-1.5 overflow-hidden rounded-2xl border border-white/14 bg-white/[0.07] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                <button
                  className={cn(
                    "h-9 rounded-xl px-3.5 text-sm font-semibold leading-none transition-colors duration-200",
                    activeTab === "visual" ? "bg-[#2563EB]/88 text-white shadow-none" : "text-[#D1D5DB] hover:bg-white/[0.08] hover:text-white",
                  )}
                  type="button"
                  onClick={() => setActiveTab("visual")}
                >
                  Visual
                </button>
                <div
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-xl border transition-[background-color,border-color,padding] duration-300 ease-out",
                    activeTab === "pdf"
                      ? "border-white/[0.07] bg-white/[0.035] p-1"
                      : "border-transparent bg-transparent p-0",
                  )}
                >
                  <button
                    className={cn(
                      "h-9 rounded-xl px-3.5 text-sm font-semibold leading-none transition-colors duration-200",
                      activeTab === "pdf" ? "bg-[#2563EB]/88 text-white shadow-none" : "text-[#D1D5DB] hover:bg-white/[0.08] hover:text-white",
                    )}
                    type="button"
                    onClick={() => setActiveTab("pdf")}
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
                        className="h-9 w-9 text-[#22D3EE] backdrop-blur-0"
                        aria-label="Atualizar PDF"
                        onClick={handleUpdatePdf}
                        tabIndex={activeTab === "pdf" ? 0 : -1}
                      >
                        {isCompiling ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              {activeTab === "pdf" ? (
                <label className="flex items-center gap-2 text-xs font-medium text-[#94A3B8]">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border border-white/20 accent-[#FF4D9D]"
                    checked={preview.autoCompile}
                    disabled={!canCompilePreview}
                    onChange={(event) => setAutoCompile(event.target.checked)}
                  />
                  Atualizar automaticamente
                </label>
              ) : null}
              {preview.compiledRevision ? (
                <p className="text-xs font-medium text-[#94A3B8]">
                  Revisao compilada: {preview.compiledRevision}/{preview.documentRevision}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="relative shrink-0">
              <button
                ref={exportMenuButtonRef}
                type="button"
                className="grid h-11 w-11 place-items-center rounded-2xl border border-white/16 bg-white/[0.075] text-[#22D3EE] shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] transition-colors duration-200 hover:border-[#22D3EE]/45 hover:bg-white/[0.12] hover:text-white"
                aria-label="Abrir menu de download"
                aria-expanded={isExportMenuOpen}
                onClick={toggleExportMenu}
              >
                <Download className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {activeTab === "pdf" && preview.isStale && preview.pdfUrl ? (
        <p className="mx-4 mt-2 rounded-2xl border border-[#FF4D9D]/35 bg-[#FF4D9D]/72 px-3 py-2 text-xs font-semibold text-white shadow-[0_0_26px_rgba(255,77,157,0.18)]">
          PDF desatualizado. A aba Visual ja reflete as alteracoes recentes.
        </p>
      ) : null}

      {compileMessageKey ? (
        <div
          className={cn(
            "overflow-hidden px-4 transition-[max-height,opacity,margin] duration-300 ease-out",
            isCompileMessageVisible ? "mt-2 max-h-24 opacity-100" : "mt-0 max-h-0 opacity-0",
          )}
          aria-hidden={!isCompileMessageVisible}
        >
          <div className="max-h-24 overflow-auto rounded-2xl border border-white/14 bg-white/[0.075] px-3 py-2 text-xs font-medium text-[#D1D5DB] shadow-[0_12px_32px_rgba(0,0,0,0.22)] backdrop-blur-xl">
            {preview.error ? <p className="font-medium text-destructive">{preview.error}</p> : null}
            {preview.diagnostics.slice(0, 4).map((diagnostic, index) => (
              <p key={`${diagnostic}-${index}`} className="truncate">
                {diagnostic}
              </p>
            ))}
          </div>
        </div>
      ) : null}
      <div className="min-h-0 flex-1">
        {activeTab === "visual" ? (
          <HtmlBlockPreview
            blocks={document.blocks}
            definitions={availableBlocks}
            onSelectBlock={selectBlock}
            selectedBlockId={selectedBlockId}
            uploadedTemplate={uploadedTemplate}
          />
        ) : preview.pdfUrl ? (
          <Suspense fallback={<PreviewPlaceholder label="Carregando visualizador PDF..." />}>
            <PdfRenderer pdfUrl={preview.pdfUrl} onTextDoubleClick={selectBlockByPreviewText} />
          </Suspense>
        ) : (
          <PreviewPlaceholder
            label={
              uploadedTemplate
                ? "Clique em Atualizar PDF para visualizar o PDF compilado."
                : "Importe um arquivo .tex ou .zip para visualizar o documento."
            }
          />
        )}
      </div>
    </aside>
    {isExportMenuOpen && exportMenuPosition
      ? createPortal(
          <div
            ref={exportMenuRef}
            className="fixed z-[100] w-44 rounded-2xl border border-white/14 bg-[#111936]/92 p-1.5 shadow-[0_22px_58px_rgba(0,0,0,0.42)] backdrop-blur-2xl"
            style={{ top: exportMenuPosition.top, right: exportMenuPosition.right }}
          >
            <ExportMenuItem icon={FileText} label="Baixar TEX" onClick={() => void runExport(handleExportTex)} />
            <ExportMenuItem icon={FileJson} label="Baixar JSON" onClick={() => void runExport(handleExportJson)} />
            <ExportMenuItem icon={FileArchive} label="Baixar ZIP" onClick={() => void runExport(handleExportProjectZip)} />
          </div>,
          window.document.body,
        )
      : null}
    </>
  );
}

function ExportMenuItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof FileText;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex h-10 w-full items-center gap-2.5 rounded-xl px-3 text-left text-sm font-semibold leading-none text-[#E5E7EB] transition-colors duration-200 hover:bg-white/[0.1] hover:text-white"
      onClick={onClick}
    >
      <Icon className="h-4 w-4 text-[#22D3EE]" />
      {label}
    </button>
  );
}

function PreviewPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center bg-transparent px-8 text-center text-sm font-medium text-[#94A3B8]">
      {label}
    </div>
  );
}

function getStatusColor(status: "idle" | "queued" | "rendering" | "ready" | "error") {
  switch (status) {
    case "ready":
      return "bg-[#22C55E] shadow-[0_0_16px_rgba(34,197,94,0.65)]";
    case "rendering":
      return "bg-[#FACC15] shadow-[0_0_16px_rgba(250,204,21,0.65)]";
    case "error":
      return "bg-[#FF4D9D] shadow-[0_0_16px_rgba(255,77,157,0.65)]";
    default:
      return "bg-[#22D3EE] shadow-[0_0_16px_rgba(34,211,238,0.65)]";
  }
}
