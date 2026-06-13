import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import type { CompileRequest } from "@/features/preview/types/compileTypes";
import {
  classifyProjectFile,
  createEmptyManifest,
  ensureProjectDirectories,
  getProjectDirectories,
  loadProjectManifest,
  syncProjectFiles,
} from "@/infrastructure/latex-compiler/projectManifest";

const tempRoots: string[] = [];

describe("projectManifest", () => {
  afterEach(async () => {
    await Promise.all(tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
  });

  it("cria manifest e escreve arquivos na primeira sincronizacao", async () => {
    const { dirs, request } = await createSyncFixture();
    const result = await syncProjectFiles(request, dirs, createEmptyManifest(request.projectKey));

    expect(result.written).toEqual(["styles/report.sty", "images/logo.png"]);
    expect(result.skipped).toEqual([]);
    expect(result.removed).toEqual([]);
    expect(await readText(path.join(dirs.assetsDir, "styles/report.sty"))).toBe("\\ProvidesPackage{report}");
    expect(await fileExists(path.join(dirs.compileDir, "images/logo.png"))).toBe(true);

    const loaded = await loadProjectManifest(dirs, request.projectKey);
    expect(loaded.loaded).toBe(true);
    expect(loaded.manifest.files).toHaveLength(2);
  });

  it("pula arquivos quando hash nao mudou", async () => {
    const { dirs, request } = await createSyncFixture();
    const first = await syncProjectFiles(request, dirs, createEmptyManifest(request.projectKey));
    const second = await syncProjectFiles(request, dirs, first.manifest);

    expect(second.written).toEqual([]);
    expect(second.skipped).toEqual(["styles/report.sty", "images/logo.png"]);
    expect(second.removed).toEqual([]);
  });

  it("reescreve asset alterado e remove asset ausente", async () => {
    const { dirs, request } = await createSyncFixture();
    const first = await syncProjectFiles(request, dirs, createEmptyManifest(request.projectKey));
    const nextRequest: CompileRequest = {
      ...request,
      assetManifest: [
        {
          path: "styles/report.sty",
          hash: "style-v2",
          size: 19,
          kind: "style",
        },
      ],
      assets: [
        {
          path: "styles/report.sty",
          hash: "style-v2",
          size: 19,
          content: "\\ProvidesPackage{v2}",
        },
      ],
    };
    const second = await syncProjectFiles(nextRequest, dirs, first.manifest);

    expect(second.written).toEqual(["styles/report.sty"]);
    expect(second.removed).toEqual(["images/logo.png"]);
    expect(await readText(path.join(dirs.assetsDir, "styles/report.sty"))).toBe("\\ProvidesPackage{v2}");
    expect(await fileExists(path.join(dirs.assetsDir, "images/logo.png"))).toBe(false);
  });

  it("classifica arquivos textuais de template no manifest", () => {
    expect(classifyProjectFile("report.sty")).toBe("style");
    expect(classifyProjectFile("report.cls")).toBe("class");
    expect(classifyProjectFile("refs.bib")).toBe("bibliography");
    expect(classifyProjectFile("refs.bst")).toBe("bibliography");
    expect(classifyProjectFile("chapter.tex")).toBe("tex");
  });
});

async function createSyncFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "editortex-manifest-test-"));
  tempRoots.push(root);
  const dirs = getProjectDirectories(root, "project-test");
  await ensureProjectDirectories(dirs);
  const request: CompileRequest = {
    projectKey: "project-test",
    mode: "pdf-preview",
    revision: 1,
    sourceHash: "source-v1",
    tex: "\\documentclass{article}",
    assetManifest: [
      {
        path: "styles/report.sty",
        hash: "style-v1",
        size: 24,
        kind: "style",
      },
      {
        path: "images/logo.png",
        hash: "logo-v1",
        size: 4,
        kind: "image",
        mimeType: "image/png",
      },
    ],
    assets: [
      {
        path: "styles/report.sty",
        hash: "style-v1",
        size: 24,
        content: "\\ProvidesPackage{report}",
      },
      {
        path: "images/logo.png",
        hash: "logo-v1",
        size: 4,
        binaryBase64: Buffer.from([1, 2, 3, 4]).toString("base64"),
        mimeType: "image/png",
      },
    ],
  };

  return { dirs, request };
}

async function fileExists(filePath: string) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function readText(filePath: string) {
  return fs.readFile(filePath, "utf8");
}
