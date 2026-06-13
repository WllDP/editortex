/* global Buffer, console, process, setTimeout */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { pathToFileURL } from "node:url";

type CompileMode = "pdf-preview" | "pdf-final";

type AssetManifestItem = {
  path: string;
  hash: string;
  size: number;
  kind?: string;
  mimeType?: string;
};

type CompileAssetPayload = {
  path: string;
  hash: string;
  size: number;
  mimeType?: string;
  content?: string;
  binaryBase64?: string;
};

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
  mode: CompileMode;
  filesWritten?: number;
  filesSkipped?: number;
  filesRemoved?: number;
  assetsPayloadCount?: number;
  manifestLoaded?: boolean;
  fastPreview?: boolean;
};

type CompileRequest = {
  projectKey: string;
  mode: CompileMode;
  revision: number;
  sourceHash: string;
  tex?: string;
  assetManifest?: AssetManifestItem[];
  assets?: CompileAssetPayload[];
  usePersistedProject?: boolean;
  mainTexPath?: string;
  compileMode: "preview" | "final";
};

type ImportProjectResult = {
  projectKey: string;
  mainTexPath?: string;
  templateName?: string;
  files: Array<{
    path: string;
    hash: string;
    size: number;
    kind: string;
    mimeType?: string;
  }>;
  assets: Array<{
    path: string;
    hash: string;
    size: number;
    kind: string;
    mimeType?: string;
    alreadySynced?: boolean;
  }>;
  mainTexContent?: string;
  sourceHash?: string;
  metrics?: Partial<CompileMetrics>;
};

type CompileResult = {
  success?: boolean;
  pdfPath?: string;
  pdfUrl?: string;
  sourceHash?: string;
  metrics?: CompileMetrics;
  diagnostics?: string[];
  log?: string;
};

type BenchmarkRun = {
  label: string;
  scenario: string;
  mode: CompileMode;
  success: boolean;
  cacheHit: boolean;
  metrics: Partial<CompileMetrics>;
  bottlenecks: Record<string, number>;
  timeline: Record<string, number>;
  warnings: string[];
  diagnostics: string[];
};

type BenchmarkReport = {
  generatedAt: string;
  project: string;
  zipPath: string;
  status: "ok" | "failed";
  healthCheck: {
    cacheWorking: boolean;
    manifestWorking: boolean;
    fastPreviewWorking: boolean;
    largestBottleneck: string;
    timeoutCause: string;
  };
  projectMetrics?: Partial<CompileMetrics> & {
    fileCount?: number;
    assetCount?: number;
    texCount?: number;
    zipSizeMb?: number;
  };
  runs: BenchmarkRun[];
  warnings: string[];
  errors: string[];
};

const defaultZip = String.raw`c:\Users\Testing Company\Downloads\overleaf-main.zip`;
const outputDir = "benchmark-results";
const jsonOutputPath = path.join(outputDir, "editorlatex-benchmark.json");
const markdownOutputPath = path.join(outputDir, "editorlatex-benchmark.md");
const devServerCandidates = process.env.EDITORLATEX_BENCHMARK_URL
  ? [process.env.EDITORLATEX_BENCHMARK_URL]
  : ["http://localhost:1420", "http://127.0.0.1:1420"];
let activeDevServerUrl = devServerCandidates[0];

async function main() {
  const zipPath = process.argv[2] ?? process.env.EDITORLATEX_BENCHMARK_ZIP ?? defaultZip;
  await fs.mkdir(outputDir, { recursive: true });

  let server: ChildProcessWithoutNullStreams | undefined;
  const errors: string[] = [];

  try {
    const project = await loadZipProject(zipPath);
    server = (await ensureDevServer()) ?? undefined;
    const runs: BenchmarkRun[] = [];
    const projectKey = `benchmark-${project.hash.slice(0, 12)}-${process.pid}`;
    const importedProject = await importProjectSafely(project, projectKey);
    const projectMetrics = {
      ...project.metrics,
      ...importedProject.metrics,
      fileCount: importedProject.files.length,
      assetCount: importedProject.assets.length,
      texCount: importedProject.files.filter((file) => file.kind === "tex").length,
    };
    runs.push(createImportRun(projectMetrics));

    const firstRun = await runCompileSafely("Preview rapido", "first_compile", "pdf-preview", importedProject, {}, 1);
    runs.push(firstRun);
    if (firstRun.success) {
      runs.push(await runCompileSafely("Preview rapido 2a vez", "cache_hit", "pdf-preview", importedProject, {}, 1));
      runs.push(await runCompileSafely("Preview final", "first_compile", "pdf-final", importedProject, {}, 2));
      runs.push(await runCompileSafely("Preview final 2a vez", "cache_hit", "pdf-final", importedProject, {}, 2));
    } else {
      runs.push(createSkippedRun("Preview rapido 2a vez", "cache_hit", "pdf-preview", firstRun));
      runs.push(createSkippedRun("Preview final", "first_compile", "pdf-final", firstRun));
      runs.push(createSkippedRun("Preview final 2a vez", "cache_hit", "pdf-final", firstRun));
    }

    const report = createReport(project.name, zipPath, runs, errors, projectMetrics);
    await writeReports(report);
    printSummary(report);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    const report = createReport(path.basename(zipPath), zipPath, [], errors);
    await writeReports(report);
    printSummary(report);
  } finally {
    await stopDevServer(server);
  }
}

async function loadZipProject(zipPath: string) {
  const zipReadStartedAt = performance.now();
  const zipBytes = await fs.readFile(zipPath);
  const zipReadMs = performance.now() - zipReadStartedAt;

  return {
    name: path.basename(zipPath),
    hash: hashBuffer(zipBytes),
    zipBytes,
    metrics: {
      zipReadMs,
      zipSizeMb: Number((zipBytes.byteLength / 1024 / 1024).toFixed(3)),
    },
  };
}

async function importProjectSafely(
  project: Awaited<ReturnType<typeof loadZipProject>>,
  projectKey: string,
): Promise<ImportProjectResult> {
  const startedAt = performance.now();
  const response = await fetch(
    `${activeDevServerUrl}/api/import-project-zip?projectKey=${encodeURIComponent(projectKey)}&archiveName=${encodeURIComponent(project.name)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: project.zipBytes,
      signal: AbortSignal.timeout(Number(process.env.EDITORLATEX_BENCHMARK_IMPORT_TIMEOUT_MS ?? 180000)),
    },
  );
  const importRequestRoundTripMs = performance.now() - startedAt;
  const result = (await response.json()) as ImportProjectResult & { diagnostics?: string[] };

  if (!response.ok || !result.projectKey) {
    throw new Error(
      result.diagnostics?.join("\n") ?? `Falha ao importar projeto pelo backend Vite (${response.status}).`,
    );
  }

  return {
    ...result,
    metrics: {
      ...result.metrics,
      importRequestBytes: project.zipBytes.byteLength,
      importRequestRoundTripMs,
    },
  };
}

function createImportRun(projectMetrics: BenchmarkReport["projectMetrics"]): BenchmarkRun {
  const metrics: Partial<CompileMetrics> = {
    mode: "pdf-preview",
    cacheHit: false,
    zipReadMs: projectMetrics?.zipReadMs,
    zipExtractMs: projectMetrics?.zipExtractMs,
    zipClassifyMs: projectMetrics?.zipClassifyMs,
    mainTexDetectionMs: projectMetrics?.mainTexDetectionMs,
    assetHashMs: projectMetrics?.assetHashMs,
    writeFilesMs: projectMetrics?.writeFilesMs,
    manifestSaveMs: projectMetrics?.manifestSaveMs ?? projectMetrics?.importManifestSaveMs,
    totalMs: projectMetrics?.importMs,
    requestRoundTripMs: projectMetrics?.importRequestRoundTripMs,
    requestSizeMb: bytesToMb(projectMetrics?.importRequestBytes),
    importMs: projectMetrics?.importMs,
    importRequestBytes: projectMetrics?.importRequestBytes,
    importRequestRoundTripMs: projectMetrics?.importRequestRoundTripMs,
    usedPersistedProject: true,
    fastPreview: false,
  };

  return {
    label: "Importacao ZIP persistente",
    scenario: "import_project_zip",
    mode: "pdf-preview",
    success: Boolean(projectMetrics?.importRequestBytes),
    cacheHit: false,
    metrics,
    bottlenecks: calculateBottlenecks(metrics),
    timeline: createTimeline(metrics),
    warnings: createWarnings(metrics),
    diagnostics: ["ZIP importado no backend Vite via application/octet-stream; resposta contem apenas metadados."],
  };
}

async function runCompile(
  label: string,
  scenario: string,
  mode: CompileMode,
  project: ImportProjectResult,
  projectMetrics: BenchmarkReport["projectMetrics"],
  revision: number,
): Promise<BenchmarkRun> {
  const request = createCompileRequest(project, mode, revision);
  const serializeStartedAt = performance.now();
  const body = JSON.stringify(request);
  const requestSerializeMs = performance.now() - serializeStartedAt;
  const requestSizeMb = Number((Buffer.byteLength(body, "utf8") / 1024 / 1024).toFixed(3));
  const compileRequestBytes = Buffer.byteLength(body, "utf8");
  const roundTripStartedAt = performance.now();
  let response: Response;
  let requestRoundTripMs: number;
  try {
    response = await fetch(`${activeDevServerUrl}/api/compile-preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(Number(process.env.EDITORLATEX_BENCHMARK_RUN_TIMEOUT_MS ?? 20000)),
    });
    requestRoundTripMs = performance.now() - roundTripStartedAt;
  } catch (error) {
    requestRoundTripMs = performance.now() - roundTripStartedAt;
    const metrics = mergeRunMetrics(
      projectMetrics,
      { mode, totalMs: requestRoundTripMs, cacheHit: false, fastPreview: mode === "pdf-preview" },
      {
        requestSerializeMs,
        requestRoundTripMs,
        requestSizeMb,
        compileRequestBytes,
      },
    );
    return {
      label,
      scenario,
      mode,
      success: false,
      cacheHit: false,
      metrics,
      bottlenecks: calculateBottlenecks(metrics),
      timeline: createTimeline(metrics),
      warnings: createWarnings(metrics),
      diagnostics: [error instanceof Error ? error.message : String(error)],
    };
  }

  const result = (await response.json()) as CompileResult;
  const metrics = mergeRunMetrics(projectMetrics, result.metrics ?? { mode }, {
    requestSerializeMs,
    requestRoundTripMs,
    requestSizeMb,
    compileRequestBytes,
  });
  return {
    label,
    scenario,
    mode,
    success: Boolean(result.success),
    cacheHit: Boolean(metrics.cacheHit),
    metrics,
    bottlenecks: calculateBottlenecks(metrics),
    timeline: createTimeline(metrics),
    warnings: createWarnings(metrics),
    diagnostics: normalizeDiagnostics(result),
  };
}

async function runCompileSafely(
  label: string,
  scenario: string,
  mode: CompileMode,
  project: ImportProjectResult,
  projectMetrics: BenchmarkReport["projectMetrics"],
  revision: number,
): Promise<BenchmarkRun> {
  try {
    return await runCompile(label, scenario, mode, project, projectMetrics, revision);
  } catch (error) {
    const metrics = mergeRunMetrics(projectMetrics, {
      mode,
      totalMs: 0,
      cacheHit: false,
      fastPreview: mode === "pdf-preview",
    });
    return {
      label,
      scenario,
      mode,
      success: false,
      cacheHit: false,
      metrics,
      bottlenecks: calculateBottlenecks(metrics),
      timeline: createTimeline(metrics),
      warnings: createWarnings(metrics),
      diagnostics: [error instanceof Error ? error.message : String(error)],
    };
  }
}

function createCompileRequest(project: ImportProjectResult, mode: CompileMode, revision: number): CompileRequest {
  return {
    projectKey: project.projectKey,
    mode,
    revision,
    sourceHash:
      project.sourceHash ?? hashString(JSON.stringify(project.files.map((file) => [file.path, file.hash, file.size]))),
    usePersistedProject: true,
    mainTexPath: project.mainTexPath,
    assetManifest: [],
    assets: [],
    compileMode: mode === "pdf-final" ? "final" : "preview",
  };
}

function createSkippedRun(label: string, scenario: string, mode: CompileMode, failedRun: BenchmarkRun): BenchmarkRun {
  const metrics = { mode, totalMs: 0, cacheHit: false, fastPreview: mode === "pdf-preview" };
  return {
    label,
    scenario,
    mode,
    success: false,
    cacheHit: false,
    metrics,
    bottlenecks: calculateBottlenecks(metrics),
    timeline: createTimeline(metrics),
    warnings: createWarnings(metrics),
    diagnostics: [`Skipped because initial benchmark compile failed: ${failedRun.diagnostics[0] ?? "unknown"}`],
  };
}

function calculateBottlenecks(metrics: Partial<CompileMetrics>) {
  const timeline = createTimeline(metrics);
  const stageTimeline = createStageTimeline(timeline);
  const measuredTotal = Object.values(stageTimeline).reduce((sum, value) => sum + value, 0);
  const total = Math.max(metrics.totalMs ?? measuredTotal, measuredTotal, 1);
  const bottlenecks = Object.fromEntries(
    Object.entries(stageTimeline).map(([name, value]) => [name, percent(value, total)]),
  );
  const known = Object.values(stageTimeline).reduce((sum, value) => sum + value, 0);
  return {
    ...bottlenecks,
    other: percent(Math.max(0, total - known), total),
  };
}

function createTimeline(metrics: Partial<CompileMetrics>) {
  return removeEmptyMetrics({
    zip_read: metrics.zipReadMs,
    zip_extract: metrics.zipExtractMs,
    zip_classify: metrics.zipClassifyMs,
    main_tex_detection: metrics.mainTexDetectionMs,
    asset_hash: metrics.assetHashMs,
    request_serialize: metrics.requestSerializeMs,
    request_round_trip: metrics.requestRoundTripMs,
    manifest_load: metrics.manifestLoadMs,
    manifest_save: metrics.manifestSaveMs,
    asset_sync: metrics.assetSyncMs ?? metrics.syncMs,
    write_files: metrics.writeFilesMs,
    latex: metrics.latexMs,
    pdf_read: metrics.pdfReadMs,
    pdf_serve: metrics.pdfServeMs,
  });
}

function createStageTimeline(timeline: Record<string, number>) {
  const internalStages = Object.fromEntries(
    Object.entries(timeline).filter(([name]) => name !== "request_round_trip" && name !== "request_serialize"),
  );
  return Object.keys(internalStages).length ? internalStages : timeline;
}

function mergeRunMetrics(
  projectMetrics: Partial<CompileMetrics> | undefined,
  compileMetrics: Partial<CompileMetrics>,
  requestMetrics: Partial<CompileMetrics> = {},
): Partial<CompileMetrics> {
  return {
    ...projectMetrics,
    ...compileMetrics,
    ...requestMetrics,
  };
}

function removeEmptyMetrics(metrics: Record<string, number | undefined>): Record<string, number> {
  const entries: Array<[string, number]> = [];
  for (const [name, value] of Object.entries(metrics)) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      entries.push([name, value]);
    }
  }
  return Object.fromEntries(entries);
}

function createWarnings(metrics: Partial<CompileMetrics>) {
  const bottlenecks = calculateBottlenecks(metrics);
  return Object.entries(bottlenecks)
    .filter(([name, value]) => name !== "other" && value >= 50)
    .map(([name, value]) => `WARNING: ${name} consumes ${value}% of measured pipeline time.`);
}

function createReport(
  project: string,
  zipPath: string,
  runs: BenchmarkRun[],
  errors: string[],
  projectMetrics?: BenchmarkReport["projectMetrics"],
): BenchmarkReport {
  const largest = findLargestBottleneck(runs);
  const warnings = [...new Set(runs.flatMap((run) => run.warnings))];
  return {
    generatedAt: new Date().toISOString(),
    project,
    zipPath,
    status: errors.length || runs.some((run) => !run.success) ? "failed" : "ok",
    healthCheck: {
      cacheWorking: runs.some((run) => run.scenario === "cache_hit" && run.cacheHit),
      manifestWorking: runs.some((run) => (run.metrics.manifestLoaded ?? false) || (run.metrics.filesSkipped ?? 0) > 0),
      fastPreviewWorking: runs.some((run) => run.mode === "pdf-preview" && run.metrics.fastPreview === true),
      largestBottleneck: largest,
      timeoutCause: detectTimeoutCause(runs),
    },
    projectMetrics,
    runs,
    warnings,
    errors,
  };
}

function generateMarkdown(report: BenchmarkReport) {
  const rows = report.runs
    .map(
      (run) =>
        `| ${run.label} | ${run.success ? "Sim" : "Nao"} | ${run.cacheHit ? "Sim" : "Nao"} | ${formatNumber(run.metrics.requestSizeMb)} | ${formatBytes(run.metrics.importRequestBytes)} | ${formatBytes(run.metrics.compileRequestBytes)} | ${formatNumber(run.metrics.zipReadMs)} | ${formatNumber(run.metrics.zipExtractMs)} | ${formatNumber(run.metrics.assetHashMs)} | ${formatNumber(run.metrics.requestSerializeMs)} | ${formatNumber(run.metrics.requestRoundTripMs)} | ${formatNumber(run.metrics.manifestLoadMs)} | ${formatNumber(run.metrics.assetSyncMs ?? run.metrics.syncMs)} | ${formatNumber(run.metrics.latexMs)} | ${formatNumber(run.metrics.pdfReadMs)} | ${formatNumber(run.metrics.totalMs)} |`,
    )
    .join("\n");

  const bottlenecks = report.runs
    .map((run) => {
      const entries = Object.entries(run.bottlenecks)
        .map(([name, value]) => `${name} ${bar(value)} ${value}%`)
        .join("; ");
      return `- ${run.label}: ${entries}`;
    })
    .join("\n");

  const conclusions = createConclusions(report)
    .map((item) => `- ${item}`)
    .join("\n");

  const timeline = report.runs
    .map((run) => {
      const entries = Object.entries(run.timeline)
        .map(([name, value]) => `${name.padEnd(22, ".")}${formatNumber(value)}ms`)
        .join("\n");
      return [`### ${run.label}`, "", entries || "Sem timeline disponivel."].join("\n");
    })
    .join("\n\n");
  const warnings = report.warnings.map((warning) => `- ${warning}`).join("\n");

  return [
    "# EditorLatex Benchmark",
    "",
    `Projeto: ${report.project}`,
    `Status: ${report.status}`,
    `Gerado em: ${report.generatedAt}`,
    "",
    "## Tabela",
    "",
    "| Modo | Sucesso | Cache | Request MB | Import bytes | Compile bytes | ZIP read | ZIP extract | Asset hash | Serialize | Request | Manifest | Asset sync | LaTeX | PDF read | Total |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    rows || "| Sem runs | Nao | Nao | - | - | - | - | - | - | - | - | - | - | - | - | - |",
    "",
    "## Compile Timeline",
    "",
    timeline || "Sem timeline disponivel.",
    "",
    "## Grafico Textual",
    "",
    bottlenecks || "- Sem dados de gargalo.",
    "",
    "## Health Check",
    "",
    `- Cache funcionando: ${report.healthCheck.cacheWorking ? "sim" : "nao"}`,
    `- Manifest funcionando: ${report.healthCheck.manifestWorking ? "sim" : "nao"}`,
    `- FastPreview funcionando: ${report.healthCheck.fastPreviewWorking ? "sim" : "nao"}`,
    `- Maior gargalo: ${report.healthCheck.largestBottleneck}`,
    `- Causa do timeout: ${report.healthCheck.timeoutCause}`,
    "",
    "## Warnings",
    "",
    warnings || "- Nenhum warning automatico.",
    "",
    "## Conclusoes Automaticas",
    "",
    conclusions || "- Benchmark sem dados suficientes.",
    "",
    report.errors.length ? "## Erros\n\n" + report.errors.map((error) => `- ${error}`).join("\n") : "",
    "",
  ].join("\n");
}

async function writeReports(report: BenchmarkReport) {
  await fs.writeFile(jsonOutputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await fs.writeFile(markdownOutputPath, generateMarkdown(report), "utf8");
}

async function ensureDevServer() {
  const readyUrl = await findReadyDevServerUrl();
  if (readyUrl) {
    activeDevServerUrl = readyUrl;
    return undefined;
  }

  const isWindows = /^win/.test(process.platform);
  const child = spawn(isWindows ? "npm.cmd" : "npm", ["run", "dev"], {
    cwd: process.cwd(),
    env: { ...process.env },
    shell: isWindows,
    windowsHide: true,
  });
  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));

  for (let attempt = 0; attempt < 45; attempt += 1) {
    const nextReadyUrl = await findReadyDevServerUrl();
    if (nextReadyUrl) {
      activeDevServerUrl = nextReadyUrl;
      return child;
    }
    await delay(1000);
  }

  child.kill();
  throw new Error(`Servidor Vite nao respondeu em ${devServerCandidates.join(" ou ")}.`);
}

async function findReadyDevServerUrl() {
  for (const url of devServerCandidates) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return url;
      }
    } catch {
      // Try the next local URL candidate.
    }
  }

  return undefined;
}

function normalizeDiagnostics(result: CompileResult) {
  const diagnostics = result.diagnostics ?? [];
  return diagnostics.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).slice(0, 8);
}

function createConclusions(report: BenchmarkReport) {
  const conclusions: string[] = [];
  const previewFirst = report.runs.find((run) => run.label === "Preview rapido");
  const previewSecond = report.runs.find((run) => run.label === "Preview rapido 2a vez");
  if (previewFirst?.metrics.totalMs && previewSecond?.metrics.totalMs) {
    const gain = 100 - percent(previewSecond.metrics.totalMs, previewFirst.metrics.totalMs);
    conclusions.push(`Cache hit reduziu o tempo do preview rapido em aproximadamente ${Math.max(0, gain)}%.`);
  }
  conclusions.push(`Maior gargalo observado: ${report.healthCheck.largestBottleneck}.`);
  conclusions.push(`Causa mais provavel do timeout: ${report.healthCheck.timeoutCause}.`);
  if (!report.healthCheck.fastPreviewWorking) {
    conclusions.push("FastPreview nao foi confirmado; verifique se a compilacao chegou ao backend.");
  }
  if (report.status !== "ok") {
    conclusions.push("Benchmark terminou com falha controlada; veja a secao de erros e diagnostics.");
  }
  return conclusions;
}

function detectTimeoutCause(runs: BenchmarkRun[]) {
  const firstFailed = runs.find((run) => !run.success);
  if (!firstFailed) {
    return "none";
  }

  const diagnostic = firstFailed.diagnostics.join(" ");
  if (!/timeout|aborted/i.test(diagnostic)) {
    return diagnostic || "unknown";
  }

  const timeline = firstFailed.timeline;
  if ((timeline.request_round_trip ?? 0) > 0) {
    return "request_round_trip_to_vite_backend";
  }
  if ((timeline.request_serialize ?? 0) > 0) {
    return "request_serialization_or_payload_build";
  }
  if ((timeline.zip_extract ?? 0) > 0 || (timeline.zip_read ?? 0) > 0) {
    return "after_zip_processing_before_compile_result";
  }
  return "unknown_timeout_stage";
}

function findLargestBottleneck(runs: BenchmarkRun[]) {
  const totals = new Map<string, number>();
  for (const run of runs.filter((item) => Object.keys(item.timeline).length > 0)) {
    for (const [name, value] of Object.entries(run.bottlenecks)) {
      if (name === "other") {
        continue;
      }
      totals.set(name, (totals.get(name) ?? 0) + value);
    }
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "unknown";
}

function hashString(value: string) {
  return hashBuffer(Buffer.from(value, "utf8"));
}

function hashBuffer(value: Buffer | Uint8Array) {
  return crypto.createHash("sha1").update(value).digest("hex");
}

function percent(value: number, total: number) {
  return Math.round((value / total) * 100);
}

function formatNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(1) : "-";
}

function formatBytes(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? String(Math.round(value)) : "-";
}

function bytesToMb(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Number((value / 1024 / 1024).toFixed(3)) : undefined;
}

function bar(value: number) {
  const length = Math.max(0, Math.min(20, Math.round(value / 5)));
  return "#".repeat(length).padEnd(20, ".");
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function stopDevServer(server: ChildProcessWithoutNullStreams | undefined) {
  if (!server?.pid) {
    return;
  }

  if (/^win/.test(process.platform)) {
    await new Promise<void>((resolve) => {
      const taskkill = spawn("taskkill", ["/pid", String(server.pid), "/t", "/f"], {
        windowsHide: true,
      });
      taskkill.on("close", () => resolve());
      taskkill.on("error", () => resolve());
    });
    return;
  }

  server.kill();
}

function printSummary(report: BenchmarkReport) {
  console.log(`[EditorLatex Benchmark] status=${report.status}`);
  console.log(`json=${jsonOutputPath}`);
  console.log(`markdown=${markdownOutputPath}`);
  console.log(`largestBottleneck=${report.healthCheck.largestBottleneck}`);
}

export { calculateBottlenecks, createReport, generateMarkdown };

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
