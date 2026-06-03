import type { BlockDefinition, BlockInstance } from "@/types/blocks";
import type { UploadedTemplate } from "@/types/latex";

export type UploadMode = "import-document" | "template-only";

export interface DocumentModel {
  id: string;
  title: string;
  uploadedTemplate?: string;
  blocks: BlockInstance[];
  metadata: Record<string, unknown>;
  updatedAt: string;
}

export interface PreviewState {
  status: "idle" | "queued" | "rendering" | "ready" | "error";
  pdfUrl?: string;
  mode: "none" | "html" | "latex" | "browser-draft" | "imported";
  generatedTex: string;
  texDirty: boolean;
  autoCompile: boolean;
  isStale: boolean;
  documentRevision: number;
  compiledRevision?: number;
  diagnostics: string[];
  error?: string;
  updatedAt?: string;
}

export interface EditorState {
  document: DocumentModel;
  uploadedTemplate?: UploadedTemplate;
  availableBlocks: BlockDefinition[];
  selectedBlockId?: string;
  preview: PreviewState;
  history: DocumentModel[];
}

export interface ExportPayload {
  document: DocumentModel;
  tex: string;
  exportedAt: string;
}
