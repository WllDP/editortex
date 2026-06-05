import type { DocumentModel, PreviewState } from "@/types/document";

export const initialDocument: DocumentModel = {
  id: crypto.randomUUID(),
  title: "Documento sem titulo",
  blocks: [],
  metadata: {},
  updatedAt: new Date().toISOString(),
};

export const initialPreview: PreviewState = {
  status: "idle",
  mode: "none",
  generatedTex: "",
  texDirty: true,
  autoCompile: false,
  isStale: false,
  documentRevision: 0,
  diagnostics: [],
};
