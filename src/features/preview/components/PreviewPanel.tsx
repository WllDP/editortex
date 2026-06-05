import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { CompileStatus } from "@/features/preview/components/CompileStatus";
import { ExportMenu } from "@/features/preview/components/ExportMenu";
import { HtmlBlockPreview } from "@/features/preview/components/HtmlBlockPreview";
import { PreviewPlaceholder } from "@/features/preview/components/PreviewPlaceholder";
import { PreviewTabs, type PreviewTab } from "@/features/preview/components/PreviewTabs";
import { useAutoCompile } from "@/features/preview/hooks/useAutoCompile";
import { useFloatingExportMenu } from "@/features/preview/hooks/useFloatingExportMenu";
import { usePreviewExports } from "@/features/preview/hooks/usePreviewExports";
import { useEditorStore } from "@/store/editorStore";
import { useNotificationStore } from "@/store/notificationStore";
import { isTauriRuntime } from "@/infrastructure/tauri/runtime";
import { cn } from "@/utils/cn";

const PdfRenderer = lazy(() =>
  import("@/features/preview/lib/pdfRenderer").then((module) => ({ default: module.PdfRenderer })),
);
const TexSourcePanel = lazy(() =>
  import("@/features/editor/components/TexSourcePanel").then((module) => ({ default: module.TexSourcePanel })),
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
  const [activeTab, setActiveTab] = useState<PreviewTab>("visual");
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [exportMenuPosition, setExportMenuPosition] = useState<{ top: number; right: number }>();
  const [isCompileMessageVisible, setIsCompileMessageVisible] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const exportMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const isDesktopRuntime = isTauriRuntime();
  const canCompilePreview = isDesktopRuntime || import.meta.env.DEV;
  const compileMessageKey = [preview.error, ...preview.diagnostics].filter(Boolean).join("\n");
  const isCompiling = preview.status === "rendering";
  const pdfPlaceholderLabel = getPdfPlaceholderLabel(Boolean(uploadedTemplate), canCompilePreview);

  useAutoCompile({
    canCompilePreview,
    compilePreview,
    compiledRevision: preview.compiledRevision,
    documentRevision: preview.documentRevision,
    enabled: preview.autoCompile,
    status: preview.status,
  });

  useFloatingExportMenu({
    buttonRef: exportMenuButtonRef,
    isOpen: isExportMenuOpen,
    menuRef: exportMenuRef,
    setIsOpen: setIsExportMenuOpen,
    setPosition: setExportMenuPosition,
  });
  const previewExports = usePreviewExports({
    document,
    ensureGeneratedTex,
    notify,
    onExportStart: () => setIsExportMenuOpen(false),
    uploadedTemplate,
  });

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
    if (!canCompilePreview) {
      notify({
        kind: "warning",
        title: "Compilacao indisponivel no build web",
        message: "Use o app desktop Tauri para compilar PDF ou rode npm run dev no navegador.",
      });
      return;
    }

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

                <PreviewTabs
                  activeTab={activeTab}
                  canUpdatePdf={canCompilePreview}
                  isCompiling={isCompiling}
                  onChange={setActiveTab}
                  onUpdatePdf={handleUpdatePdf}
                />
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
                <ExportMenu
                  buttonRef={exportMenuButtonRef}
                  isOpen={isExportMenuOpen}
                  menuRef={exportMenuRef}
                  position={exportMenuPosition}
                  onExportJson={() => void previewExports.exportJson()}
                  onExportTex={() => void previewExports.exportTexFile()}
                  onExportZip={() => void previewExports.exportProjectZip()}
                  onToggle={toggleExportMenu}
                />
              </div>
            </div>
          </div>
        </div>

        {activeTab === "pdf" && preview.isStale && preview.pdfUrl ? (
          <p className="mx-4 mt-2 rounded-2xl border border-[#FF4D9D]/35 bg-[#FF4D9D]/72 px-3 py-2 text-xs font-semibold text-white shadow-[0_0_26px_rgba(255,77,157,0.18)]">
            PDF desatualizado. A aba Visual ja reflete as alteracoes recentes.
          </p>
        ) : null}

        <CompileStatus preview={preview} visible={isCompileMessageVisible} />
        <div className="flex min-h-0 flex-1 flex-col">
          {activeTab === "visual" ? (
            <HtmlBlockPreview
              blocks={document.blocks}
              definitions={availableBlocks}
              onSelectBlock={selectBlock}
              selectedBlockId={selectedBlockId}
              uploadedTemplate={uploadedTemplate}
            />
          ) : activeTab === "tex" ? (
            <Suspense fallback={<PreviewPlaceholder label="Carregando codigo TEX..." />}>
              <TexSourcePanel />
            </Suspense>
          ) : preview.pdfUrl ? (
            <Suspense fallback={<PreviewPlaceholder label="Carregando visualizador PDF..." />}>
              <PdfRenderer pdfUrl={preview.pdfUrl} onTextDoubleClick={selectBlockByPreviewText} />
            </Suspense>
          ) : (
            <PreviewPlaceholder label={pdfPlaceholderLabel} />
          )}
        </div>
      </aside>
    </>
  );
}

function getPdfPlaceholderLabel(hasUploadedTemplate: boolean, canCompilePreview: boolean) {
  if (!hasUploadedTemplate) {
    return "Importe um arquivo .tex ou .zip para visualizar o documento.";
  }

  if (!canCompilePreview) {
    return "Compilacao PDF disponivel no app desktop Tauri ou no navegador com npm run dev.";
  }

  return "Clique em Atualizar PDF para visualizar o PDF compilado.";
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
