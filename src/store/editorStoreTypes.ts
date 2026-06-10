import type { StoreApi } from "zustand";
import type { BlockDefinition } from "@/types/blocks";
import type { DocumentModel, PreviewState, UploadMode } from "@/types/document";
import type { UploadedLatexProject, UploadedTemplate } from "@/types/latex";
import type { PdfCompileMode } from "@/features/preview/lib/pdfPreviewService";

export interface EditorStore {
  document: DocumentModel;
  uploadedTemplate?: UploadedTemplate;
  availableBlocks: BlockDefinition[];
  selectedBlockId?: string;
  pendingFocusBlockId?: string;
  preview: PreviewState;
  loadTemplate: (fileName: string, content: string, project?: UploadedLatexProject, mode?: UploadMode) => void;
  addBlock: (definitionId: string) => void;
  insertBlockAfter: (anchorBlockId: string, definitionId: string) => string | undefined;
  updateBlockData: (blockId: string, data: Record<string, string>) => void;
  attachImageToBlock: (blockId: string, file: File) => Promise<void>;
  duplicateBlock: (blockId: string) => void;
  removeBlock: (blockId: string) => void;
  reorderBlocks: (activeId: string, overId: string) => void;
  selectBlock: (blockId?: string) => void;
  clearPendingBlockFocus: (blockId: string) => void;
  selectBlockByPreviewText: (text: string) => void;
  refreshGeneratedTex: () => void;
  ensureGeneratedTex: () => string;
  markPreviewDirty: () => void;
  compilePreview: (mode?: PdfCompileMode) => Promise<void>;
  showImportedPdfPreview: () => void;
  setAutoCompile: (enabled: boolean) => void;
}

export type EditorStoreSet = StoreApi<EditorStore>["setState"];
export type EditorStoreGet = StoreApi<EditorStore>["getState"];
