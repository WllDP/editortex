export type CompileMode = "html-preview" | "pdf-preview" | "pdf-final";
export type PdfPreviewQuality = "fast" | "faithful";

export type ProjectFileKind = "tex" | "asset" | "style" | "class" | "bibliography" | "output" | "aux";

export type AssetManifestItem = {
  path: string;
  hash: string;
  size: number;
  kind?: string;
  mimeType?: string;
  alreadySynced?: boolean;
};

export type ImportProjectResult = {
  projectKey: string;
  mainTexPath?: string;
  templateName?: string;
  files: Array<{
    path: string;
    hash: string;
    size: number;
    kind: ProjectFileKind;
    mimeType?: string;
  }>;
  assets: Array<{
    path: string;
    hash: string;
    size: number;
    kind: ProjectFileKind;
    mimeType?: string;
    alreadySynced?: boolean;
    objectUrl?: string;
  }>;
  mainTexContent?: string;
  sourceHash?: string;
  metrics?: CompileMetrics;
};

export type CompileAssetPayload = {
  path: string;
  hash: string;
  size: number;
  mimeType?: string;
  content?: string;
  binaryBase64?: string;
};

export type CompileRequest = {
  projectKey: string;
  mode: CompileMode;
  previewQuality?: PdfPreviewQuality;
  revision: number;
  sourceHash: string;
  tex?: string;
  assetManifest?: AssetManifestItem[];
  assets?: CompileAssetPayload[];
  usePersistedProject?: boolean;
};

export type CompileMetrics = {
  zipReadMs?: number;
  zipExtractMs?: number;
  zipClassifyMs?: number;
  mainTexDetectionMs?: number;
  manifestLoadMs?: number;
  manifestSaveMs?: number;
  assetHashMs?: number;
  assetSyncMs?: number;
  texGenerationMs?: number;
  syncMs?: number;
  writeFilesMs?: number;
  latexMs?: number;
  pdfReadMs?: number;
  pdfServeMs?: number;
  totalMs?: number;
  pdfSizeMb?: number;
  pageCount?: number;
  requestSerializeMs?: number;
  requestRoundTripMs?: number;
  requestSizeMb?: number;
  importMs?: number;
  importZipReadMs?: number;
  importZipExtractMs?: number;
  importManifestSaveMs?: number;
  importRequestBytes?: number;
  importRequestRoundTripMs?: number;
  compileRequestBytes?: number;
  usedPersistedProject?: boolean;
  cacheHit?: boolean;
  compiler?: string;
  mode: CompileMode;
  filesWritten?: number;
  filesSkipped?: number;
  filesRemoved?: number;
  assetsPayloadCount?: number;
  manifestLoaded?: boolean;
  fastPreview?: boolean;
  previewQuality?: PdfPreviewQuality;
};

export type LatexDiagnostic = {
  file?: string;
  line?: number;
  severity: "error" | "warning";
  message: string;
  raw?: string;
};

export type CompileResult = {
  success: boolean;
  pdfUrl?: string;
  pdfPath?: string;
  revision: number;
  sourceHash: string;
  metrics?: CompileMetrics;
  diagnostics?: LatexDiagnostic[];
  latexDiagnostics?: LatexDiagnostic[];
  log?: string;
  syncedAssetHashes?: Record<string, string>;
};
