import { describe, expect, it } from "vitest";
import { injectProjectGraphicPaths } from "../latexCompiler";
import type { ProjectManifest } from "../projectManifest";

describe("injectProjectGraphicPaths", () => {
  it("injeta graphicspath com diretorios de assets e do main tex", () => {
    const manifest: ProjectManifest = {
      projectKey: "project",
      revision: 1,
      files: [
        {
          path: "Relatorio/icone.png",
          hash: "hash",
          size: 10,
          kind: "asset",
          mimeType: "image/png",
          lastSyncedAt: 1,
        },
        {
          path: "Relatorio/main.tex",
          hash: "tex",
          size: 10,
          kind: "tex",
          mimeType: "text/x-tex",
          lastSyncedAt: 1,
        },
      ],
      updatedAt: 1,
    };

    const tex = injectProjectGraphicPaths(
      "\\documentclass{report}\n\\usepackage{graphicx}\n\\begin{document}\\includegraphics{icone.png}\\end{document}",
      manifest,
      "Relatorio/main.tex",
    );

    expect(tex).toContain("\\usepackage{graphicx}\n\\graphicspath{{Relatorio/}}");
    expect(tex.indexOf("\\graphicspath")).toBeGreaterThan(tex.indexOf("\\usepackage{graphicx}"));
    expect(tex.indexOf("\\graphicspath")).toBeLessThan(tex.indexOf("\\begin{document}"));
  });
});
