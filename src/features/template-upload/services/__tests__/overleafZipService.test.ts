import JSZip from "jszip";
import { describe, expect, it, vi } from "vitest";
import { readLatexUpload } from "@/features/template-upload/services/overleafZipService";

describe("readLatexUpload", () => {
  it("le arquivos .tex simples como projeto", async () => {
    const file = new File([String.raw`\documentclass{article}`], "main.tex", { type: "text/x-tex" });

    const result = await readLatexUpload(file);

    expect(result.fileName).toBe("main.tex");
    expect(result.project.sourceType).toBe("tex-file");
    expect(result.project.files[0]).toMatchObject({
      path: "main.tex",
      kind: "tex",
      content: String.raw`\documentclass{article}`,
    });
  });

  it("extrai projeto ZIP do Overleaf com main.tex e assets", async () => {
    const createObjectUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    const zip = new JSZip();
    zip.file("project/main.tex", String.raw`\documentclass{article}\begin{document}Oi\end{document}`);
    zip.file("project/refs.bib", "@book{a,title={A}}");
    zip.file("project/image.png", new Uint8Array([1, 2, 3]));
    const blob = await zip.generateAsync({ type: "blob" });
    const file = new File([blob], "project.zip", { type: "application/zip" });

    const result = await readLatexUpload(file);

    expect(result.fileName).toBe("project/main.tex");
    expect(result.project.sourceType).toBe("overleaf-zip");
    expect(result.project.rootPath).toBe("project");
    expect(result.project.mainTexPath).toBe("project/main.tex");
    expect(result.project.files.map((projectFile) => projectFile.kind)).toEqual(
      expect.arrayContaining(["tex", "bib", "image"]),
    );
    expect(result.project.assets[0]).toMatchObject({
      path: "project/image.png",
      mimeType: "image/png",
      objectUrl: "blob:test",
    });

    createObjectUrl.mockRestore();
  });
});
