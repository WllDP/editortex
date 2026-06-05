import { generateLatexDocument } from "@/domain/latex/latexGenerator";
import { compileLatexPreview, getBundledPdfPreviewUrl } from "@/features/preview/lib/pdfPreviewService";
import type { EditorStore, EditorStoreGet, EditorStoreSet } from "@/store/editorStoreTypes";

type PreviewSlice = Pick<
  EditorStore,
  | "refreshGeneratedTex"
  | "ensureGeneratedTex"
  | "markPreviewDirty"
  | "compilePreview"
  | "showImportedPdfPreview"
  | "setAutoCompile"
>;

export function createPreviewSlice(set: EditorStoreSet, get: EditorStoreGet): PreviewSlice {
  return {
    refreshGeneratedTex: () => {
      get().ensureGeneratedTex();
    },
    ensureGeneratedTex: () => {
      const startedAt = performance.now();
      const state = get();

      const isRendering = state.preview.status === "rendering";
      const generatedTex = generateLatexDocument(
        state.document,
        state.availableBlocks,
        state.uploadedTemplate?.parsedTemplate,
      );
      const texGenerationMs = performance.now() - startedAt;
      console.info(
        `[EditorTex perf] gerar TEX: ${texGenerationMs.toFixed(1)}ms | blocos=${state.document.blocks.length} | bytes=${generatedTex.length}`,
      );

      set({
        preview: {
          ...state.preview,
          status: isRendering ? "rendering" : "queued",
          mode: state.preview.mode,
          generatedTex,
          texDirty: false,
          isStale: Boolean(state.preview.pdfUrl),
          diagnostics: isRendering ? state.preview.diagnostics : [],
          error: isRendering ? state.preview.error : undefined,
          updatedAt: new Date().toISOString(),
        },
      });
      return generatedTex;
    },
    compilePreview: async (mode = "preview") => {
      const frontendStartedAt = performance.now();
      const tex = get().ensureGeneratedTex();
      const state = get();
      const revisionBeingCompiled = state.preview.documentRevision;

      if (!tex.trim()) {
        set((current) => ({
          preview: {
            ...current.preview,
            status: "error",
            error: "Nao ha TEX gerado para compilar.",
            diagnostics: ["Carregue um template e adicione blocos antes de compilar."],
            updatedAt: new Date().toISOString(),
          },
        }));
        return;
      }

      set((current) => ({
        preview: {
          ...current.preview,
          status: "rendering",
          isStale: Boolean(current.preview.pdfUrl),
          diagnostics: [`Compilando revisao ${revisionBeingCompiled} do documento...`],
          error: undefined,
          updatedAt: new Date().toISOString(),
        },
      }));

      const result = await compileLatexPreview(tex, state.uploadedTemplate?.project, mode, revisionBeingCompiled);
      const frontendCompileMs = performance.now() - frontendStartedAt;
      console.info(
        `[EditorTex perf] frontend carregar preview PDF: ${frontendCompileMs.toFixed(1)}ms | revisao=${revisionBeingCompiled} | modo=${mode}`,
      );
      const latestRevision = get().preview.documentRevision;
      const pdfUrl = result.pdfUrl;
      const visiblePdfUrl = pdfUrl ?? get().preview.pdfUrl;
      const diagnostics = result.diagnostics;

      if (latestRevision !== revisionBeingCompiled) {
        set((current) => ({
          preview: {
            ...current.preview,
            status: "queued",
            isStale: true,
            diagnostics: [`Revisao ${revisionBeingCompiled} descartada; preparando revisao ${latestRevision}.`],
            error: undefined,
            updatedAt: new Date().toISOString(),
          },
        }));
        return;
      }

      set((current) => ({
        preview: {
          ...current.preview,
          status: pdfUrl ? "ready" : "error",
          mode: pdfUrl ? "latex" : current.preview.mode,
          pdfUrl: visiblePdfUrl,
          isStale: !pdfUrl && Boolean(visiblePdfUrl),
          compiledRevision: pdfUrl ? revisionBeingCompiled : current.preview.compiledRevision,
          diagnostics,
          error: pdfUrl ? undefined : (diagnostics[0] ?? "Falha ao compilar PDF."),
          updatedAt: new Date().toISOString(),
        },
      }));
    },
    showImportedPdfPreview: () => {
      const state = get();
      const bundledPdfUrl = getBundledPdfPreviewUrl(state.uploadedTemplate?.project.files ?? []);

      if (!bundledPdfUrl) {
        set((current) => ({
          preview: {
            ...current.preview,
            status: "error",
            error: "O upload nao contem um PDF importado para exibir.",
            diagnostics: ["Envie um ZIP do Overleaf que contenha main.pdf ou outro arquivo PDF."],
            updatedAt: new Date().toISOString(),
          },
        }));
        return;
      }

      set((current) => ({
        preview: {
          ...current.preview,
          status: "ready",
          mode: "imported",
          pdfUrl: bundledPdfUrl,
          isStale: true,
          diagnostics: [
            "Exibindo o PDF importado do ZIP como referencia.",
            "Esse PDF nao reflete edicoes feitas nos blocos. Para atualizar o conteudo, execute o app desktop Tauri e compile.",
          ],
          error: undefined,
          updatedAt: new Date().toISOString(),
        },
      }));
    },
    setAutoCompile: (enabled) =>
      set((state) => ({
        preview: {
          ...state.preview,
          autoCompile: enabled,
          updatedAt: new Date().toISOString(),
        },
      })),
    markPreviewDirty: () => {
      set((state) => {
        const nextRevision = state.preview.documentRevision + 1;
        const isRendering = state.preview.status === "rendering";
        return {
          preview: {
            ...state.preview,
            status: isRendering ? "rendering" : "queued",
            texDirty: true,
            documentRevision: nextRevision,
            isStale: Boolean(state.preview.pdfUrl),
            diagnostics: isRendering ? state.preview.diagnostics : [],
            error: isRendering ? state.preview.error : undefined,
            updatedAt: new Date().toISOString(),
          },
        };
      });
    },
  };
}
