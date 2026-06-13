import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { importProjectZipBytes, normalizeZipEntryPath, selectMainTexCandidate } from "../projectImport";
import { getPreviewCacheRoot } from "../pdfCache";

describe("projectImport", () => {
  it("detecta main.tex por prioridade", () => {
    const selected = selectMainTexCandidate([
      { path: "chapters/intro.tex", content: "\\documentclass{article}" },
      { path: "main.tex", content: "main" },
    ]);

    expect(selected?.path).toBe("main.tex");
  });

  it("bloqueia path traversal em entradas ZIP", () => {
    expect(normalizeZipEntryPath("../evil.tex")).toBeUndefined();
    expect(normalizeZipEntryPath("folder/../../evil.tex")).toBeUndefined();
    expect(normalizeZipEntryPath("C:/evil.tex")).toBeUndefined();
    expect(normalizeZipEntryPath("/absolute/main.tex")).toBeUndefined();
  });

  it("importa ZIP, persiste manifest e marca assets como sincronizados", async () => {
    const zip = new JSZip();
    zip.file("main.tex", "\\documentclass{article}\\begin{document}Hello\\end{document}");
    zip.file("styles/custom.sty", "\\ProvidesPackage{custom}");
    zip.file("refs/references.bib", "@book{a,title={A}}");
    zip.file("images/logo.png", Buffer.from([137, 80, 78, 71]));

    const zipBytes = Buffer.from(await zip.generateAsync({ type: "uint8array" }));
    const projectKey = `project-import-test-${process.pid}-${Math.random().toString(16).slice(2)}`;
    const result = await importProjectZipBytes(zipBytes, {
      projectKey,
      archiveName: "template.zip",
    });

    expect(result.projectKey).toBe(projectKey);
    expect(result.mainTexPath).toBe("main.tex");
    expect(result.assets.every((asset) => asset.alreadySynced)).toBe(true);
    expect(result.files.some((file) => file.path === "styles/custom.sty" && file.kind === "style")).toBe(true);
    expect(result.files.some((file) => file.path === "refs/references.bib" && file.kind === "bibliography")).toBe(true);

    const manifestPath = path.join(getPreviewCacheRoot(), "projects", projectKey, "manifest.json");
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as { files: Array<{ path: string }> };
    expect(manifest.files.map((file) => file.path)).toContain("images/logo.png");
  });
});
