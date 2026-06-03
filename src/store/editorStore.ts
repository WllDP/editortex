import { create } from "zustand";
import type { BlockDefinition, BlockInstance } from "@/types/blocks";
import type { DocumentModel, PreviewState, UploadMode } from "@/types/document";
import type { UploadedLatexProject, UploadedTemplate } from "@/types/latex";
import { createBlockRegistry } from "@/blocks/blockRegistry";
import { generateLatexDocument } from "@/latex/latexGenerator";
import { importTemplateBodyAsBlocks } from "@/parser/documentBlockImporter";
import { parseLatexTemplate } from "@/parser/latexParser";
import { compileLatexPreview, getBundledPdfPreviewUrl, type PdfCompileMode } from "@/preview/pdfPreviewService";

interface EditorStore {
  document: DocumentModel;
  uploadedTemplate?: UploadedTemplate;
  availableBlocks: BlockDefinition[];
  selectedBlockId?: string;
  preview: PreviewState;
  loadTemplate: (fileName: string, content: string, project?: UploadedLatexProject, mode?: UploadMode) => void;
  addBlock: (definitionId: string) => void;
  updateBlockData: (blockId: string, data: Record<string, string>) => void;
  attachImageToBlock: (blockId: string, file: File) => Promise<void>;
  duplicateBlock: (blockId: string) => void;
  removeBlock: (blockId: string) => void;
  reorderBlocks: (activeId: string, overId: string) => void;
  selectBlock: (blockId?: string) => void;
  selectBlockByPreviewText: (text: string) => void;
  refreshGeneratedTex: () => void;
  ensureGeneratedTex: () => string;
  markPreviewDirty: () => void;
  compilePreview: (mode?: PdfCompileMode) => Promise<void>;
  showImportedPdfPreview: () => void;
  setAutoCompile: (enabled: boolean) => void;
}

const initialDocument: DocumentModel = {
  id: crypto.randomUUID(),
  title: "Documento sem titulo",
  blocks: [],
  metadata: {},
  updatedAt: new Date().toISOString(),
};

const initialPreview: PreviewState = {
  status: "idle",
  mode: "none",
  generatedTex: "",
  texDirty: true,
  autoCompile: false,
  isStale: false,
  documentRevision: 0,
  diagnostics: [],
};

export const useEditorStore = create<EditorStore>((set, get) => ({
  document: initialDocument,
  availableBlocks: [],
  preview: initialPreview,
  loadTemplate: (fileName, content, project, mode = "template-only") => {
    const parsedTemplate = parseLatexTemplate(content, fileName);
    const uploadedProject =
      project ??
      ({
        sourceType: "tex-file",
        mainTexPath: fileName,
        files: [
          {
            path: fileName,
            name: fileName,
            extension: "tex",
            kind: "tex",
            size: content.length,
            content,
          },
        ],
        assets: [],
      } satisfies UploadedLatexProject);
    const uploadedTemplate: UploadedTemplate = {
      id: crypto.randomUUID(),
      name: fileName.replace(/\.tex$/i, ""),
      fileName,
      content,
      sourceType: uploadedProject.sourceType,
      project: uploadedProject,
      parsedTemplate,
      createdAt: new Date().toISOString(),
    };
    const registry = createBlockRegistry(parsedTemplate);
    const importedBlocks =
      mode === "import-document" ? importTemplateBodyAsBlocks(parsedTemplate, registry.definitions) : [];

    set((state) => ({
      uploadedTemplate,
      availableBlocks: registry.definitions,
      selectedBlockId: importedBlocks[0]?.id,
      preview: {
        ...initialPreview,
        autoCompile: state.preview.autoCompile,
        status: "queued",
        documentRevision: state.preview.documentRevision + 1,
        updatedAt: new Date().toISOString(),
      },
      document: {
        ...state.document,
        title: mode === "import-document" ? uploadedTemplate.name : "Novo documento",
        uploadedTemplate: uploadedTemplate.id,
        blocks: importedBlocks,
        metadata: {
          ...state.document.metadata,
          uploadMode: mode,
          mainTexPath: uploadedProject.mainTexPath,
          sourceType: uploadedProject.sourceType,
          projectFileCount: uploadedProject.files.length,
          assetCount: uploadedProject.assets.length,
        },
        updatedAt: new Date().toISOString(),
      },
    }));
  },
  addBlock: (definitionId) => {
    const definition = get().availableBlocks.find((block) => block.id === definitionId);
    if (!definition) {
      return;
    }

    const data = definition.fields.reduce<Record<string, string>>((values, field) => {
      values[field.id] = field.defaultValue ?? "";
      return values;
    }, {});

    const instance: BlockInstance = {
      id: crypto.randomUUID(),
      definitionId: definition.id,
      type: definition.type,
      variableName: definition.variableName,
      order: get().document.blocks.length,
      data,
      metadata: {},
    };

    set((state) => ({
      selectedBlockId: instance.id,
      document: normalizeDocumentOrder({
        ...state.document,
        blocks: [...state.document.blocks, instance],
        updatedAt: new Date().toISOString(),
      }),
    }));
    get().markPreviewDirty();
  },
  updateBlockData: (blockId, data) => {
    set((state) => ({
      document: {
        ...state.document,
        blocks: state.document.blocks.map((block) =>
          block.id === blockId ? { ...block, data: { ...block.data, ...data } } : block,
        ),
        updatedAt: new Date().toISOString(),
      },
    }));
    get().markPreviewDirty();
  },
  attachImageToBlock: async (blockId, file) => {
    if (!file.type.startsWith("image/")) {
      return;
    }

    const state = get();
    const template = state.uploadedTemplate;
    const binaryBase64 = await readFileAsBase64(file);
    const extension = getFileExtension(file.name);
    const imagePath = createProjectAssetPath(template?.project.rootPath, file.name, template?.project.files ?? []);
    const objectUrl = URL.createObjectURL(file);
    const asset = {
      path: imagePath,
      name: getBaseName(imagePath),
      extension,
      kind: "image" as const,
      size: file.size,
      binaryBase64,
      objectUrl,
      mimeType: file.type || getImageMimeType(extension),
    };

    set((current) => {
      const currentTemplate = current.uploadedTemplate;
      const nextBlocks = current.document.blocks.map((block) =>
        block.id === blockId ? { ...block, data: { ...block.data, image: asset.name } } : block,
      );

      if (!currentTemplate) {
        return {
          document: {
            ...current.document,
            blocks: nextBlocks,
            updatedAt: new Date().toISOString(),
          },
        };
      }

      const nextProject = {
        ...currentTemplate.project,
        files: [...currentTemplate.project.files, asset],
        assets: [...currentTemplate.project.assets, asset],
      };

      return {
        uploadedTemplate: {
          ...currentTemplate,
          project: nextProject,
        },
        document: {
          ...current.document,
          blocks: nextBlocks,
          metadata: {
            ...current.document.metadata,
            assetCount: nextProject.assets.length,
            projectFileCount: nextProject.files.length,
          },
          updatedAt: new Date().toISOString(),
        },
      };
    });
    get().markPreviewDirty();
  },
  duplicateBlock: (blockId) => {
    const source = get().document.blocks.find((block) => block.id === blockId);
    if (!source) {
      return;
    }

    const duplicate: BlockInstance = {
      ...source,
      id: crypto.randomUUID(),
      order: get().document.blocks.length,
      data: { ...source.data },
      metadata: { ...source.metadata },
    };

    set((state) => ({
      selectedBlockId: duplicate.id,
      document: normalizeDocumentOrder({
        ...state.document,
        blocks: [...state.document.blocks, duplicate],
        updatedAt: new Date().toISOString(),
      }),
    }));
    get().markPreviewDirty();
  },
  removeBlock: (blockId) => {
    set((state) => {
      const remainingBlocks = state.document.blocks.filter((block) => block.id !== blockId);
      const nextSelectedBlockId =
        state.selectedBlockId === blockId
          ? [...remainingBlocks].sort((a, b) => a.order - b.order).at(-1)?.id
          : state.selectedBlockId;

      return {
        selectedBlockId: nextSelectedBlockId,
        document: normalizeDocumentOrder({
        ...state.document,
        blocks: remainingBlocks,
        updatedAt: new Date().toISOString(),
        }),
      };
    });
    get().markPreviewDirty();
  },
  reorderBlocks: (activeId, overId) => {
    if (activeId === overId) {
      return;
    }

    set((state) => {
      const blocks = [...state.document.blocks].sort((a, b) => a.order - b.order);
      const activeIndex = blocks.findIndex((block) => block.id === activeId);
      const overIndex = blocks.findIndex((block) => block.id === overId);

      if (activeIndex === -1 || overIndex === -1) {
        return state;
      }

      const [activeBlock] = blocks.splice(activeIndex, 1);
      blocks.splice(overIndex, 0, activeBlock);

      return {
        document: normalizeDocumentOrder({
          ...state.document,
          blocks,
          updatedAt: new Date().toISOString(),
        }),
      };
    });
    get().markPreviewDirty();
  },
  selectBlock: (blockId) => set({ selectedBlockId: blockId }),
  selectBlockByPreviewText: (text) => {
    const query = normalizeSearchText(text);
    if (query.length < 3) {
      return;
    }

    const blocks = [...get().document.blocks].sort((a, b) => a.order - b.order);
    const scoredBlocks = blocks
      .map((block) => ({
        block,
        score: scoreBlockPreviewMatch(query, block.data),
      }))
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score);

    const [best] = scoredBlocks;
    if (best) {
      set({ selectedBlockId: best.block.id });
    }
  },
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
          error: "Não há TEX gerado para compilar.",
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
        diagnostics: [`Compilando revisão ${revisionBeingCompiled} do documento...`],
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
        error: pdfUrl ? undefined : diagnostics[0] ?? "Falha ao compilar PDF.",
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
          error: "O upload não contém um PDF importado para exibir.",
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
          "Exibindo o PDF importado do ZIP como referência.",
          "Esse PDF não reflete edições feitas nos blocos. Para atualizar o conteúdo, execute o app desktop Tauri e compile.",
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
}));

function normalizeDocumentOrder(document: DocumentModel): DocumentModel {
  return {
    ...document,
    blocks: [...document.blocks]
      .sort((a, b) => a.order - b.order)
      .map((block, index) => ({ ...block, order: index })),
  };
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\\[a-zA-Z@][\w@]*/g, " ")
    .replace(/[{}\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function scoreBlockPreviewMatch(query: string, data: Record<string, string>) {
  const fieldValues = Object.values(data).map(normalizeSearchText).filter(Boolean);
  const fullValue = normalizeSearchText(fieldValues.join(" "));
  const queryWords = query.split(/\s+/).filter((word) => word.length >= 4);
  let score = 0;

  for (const value of fieldValues) {
    if (value === query) {
      score = Math.max(score, 1000);
    }
    if (value.startsWith(query)) {
      score = Math.max(score, 700);
    }
    if (value.includes(query)) {
      score = Math.max(score, 420 + Math.min(query.length, 80));
    }
    if (query.includes(value) && value.length >= 4) {
      score = Math.max(score, 360 + Math.min(value.length, 80));
    }
  }

  if (fullValue.includes(query)) {
    score = Math.max(score, 260 + Math.min(query.length, 80));
  }

  const matchedWords = queryWords.filter((word) => fullValue.includes(word));
  if (matchedWords.length > 0) {
    score = Math.max(score, matchedWords.length * 60);
  }

  if (fieldValues.length > 0 && fieldValues[0] === query) {
    score += 300;
  }

  return score;
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler imagem."));
    reader.readAsDataURL(file);
  });
}

function createProjectAssetPath(rootPath: string | undefined, fileName: string, files: Array<{ path: string }>) {
  const safeName = sanitizeAssetFileName(fileName);
  const prefix = rootPath ? `${rootPath.replace(/\/+$/g, "")}/` : "";
  const existingPaths = new Set(files.map((file) => file.path));
  let candidate = `${prefix}${safeName}`;
  let suffix = 2;

  while (existingPaths.has(candidate)) {
    const extension = getFileExtension(safeName);
    const stem = extension ? safeName.slice(0, -extension.length - 1) : safeName;
    candidate = `${prefix}${stem}-${suffix}${extension ? `.${extension}` : ""}`;
    suffix += 1;
  }

  return candidate;
}

function sanitizeAssetFileName(value: string) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").trim() || `imagem-${Date.now()}.png`;
}

function getFileExtension(value: string) {
  return value.toLowerCase().match(/\.([^.\\/]+)$/)?.[1] ?? "png";
}

function getBaseName(value: string) {
  return value.replace(/\\/g, "/").split("/").at(-1) ?? value;
}

function getImageMimeType(extension: string) {
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "svg") return "image/svg+xml";
  if (extension === "webp") return "image/webp";
  return "image/png";
}
