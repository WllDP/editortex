# Project Manifest

Leia tambem [COMPILATION_PIPELINE.md](./COMPILATION_PIPELINE.md) e [CACHE_STRATEGY.md](./CACHE_STRATEGY.md).

## Localizacao

Estrutura persistente por projeto:

```txt
projects/{projectKey}/
  source/
    main.preview.tex
    main.final.tex
  assets/
  compile/
  output/
    preview.pdf
    final.pdf
  manifest.json
```

No Node/Vite, a raiz vem de `getPreviewCacheRoot()`. No Tauri, a raiz fica no cache da aplicacao.

## ProjectFileManifestItem

```ts
type ProjectFileManifestItem = {
  path: string;
  hash: string;
  size: number;
  kind: "tex" | "asset" | "style" | "class" | "bibliography" | "output" | "aux";
  mimeType?: string;
  lastSyncedAt: number;
};
```

## ProjectManifest

```ts
type ProjectManifest = {
  projectKey: string;
  revision: number;
  sourceHash?: string;
  files: ProjectFileManifestItem[];
  lastCompiledByMode?: Partial<
    Record<
      CompileMode,
      {
        sourceHash: string;
        pdfPath: string;
        compiledAt: number;
      }
    >
  >;
  lastCompiledRevision?: number;
  lastCompiledSourceHash?: string;
  lastPdfPath?: string;
  updatedAt: number;
};
```

`lastCompiledRevision`, `lastCompiledSourceHash` e `lastPdfPath` existem por compatibilidade. Novas decisoes de cache devem preferir `lastCompiledByMode`.

## CompileMetrics

```ts
type CompileMetrics = {
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
};
```

## CompileResult

```ts
type CompileResult = {
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
```

## Lifecycle dos Assets

1. Importacao cria metadados e, no Tauri, persiste arquivos imediatamente.
2. Frontend guarda path/hash/size/kind/mimeType/objectUrl quando necessario.
3. `assetManifest` e enviado em toda compilacao.
4. `assets` e enviado apenas para novos/alterados/nao sincronizados.
5. Backend atualiza `manifest.files`.
6. Backend retorna `syncedAssetHashes`.
7. Frontend marca assets como sincronizados e remove `binaryBase64` temporario.

No Vite/dev apos a Etapa 9:

1. `POST /api/import-project-zip` recebe o ZIP como `application/octet-stream`.
2. O backend dev extrai, valida paths, detecta `main.tex`, grava `assets/`, `compile/`, `source/imported-main.tex` e `manifest.json`.
3. O frontend recebe apenas metadados, `sourceHash` e `mainTexContent`.
4. Compilacoes seguintes podem enviar `usePersistedProject=true`, `assets: []` e `assetManifest: []`.
5. O backend le o TEX persistido e usa o manifest existente sem remover assets.

## Sincronizacao Incremental

`syncProjectFiles` compara hash por path. Arquivos sem payload e sem hash sincronizado sao pulados para evitar escrita incorreta. Arquivos removidos do manifest recebido sao apagados de `assets/` e `compile/`, exceto tipos preservados (`tex`, `output`, `aux`).
