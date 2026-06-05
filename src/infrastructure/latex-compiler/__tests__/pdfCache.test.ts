import { describe, expect, it } from "vitest";
import {
  getPreviewCacheDir,
  normalizeProjectRelativePath,
  sanitizeCacheKey,
} from "@/infrastructure/latex-compiler/pdfCache";

describe("pdfCache helpers", () => {
  it("normaliza caminhos relativos removendo segmentos inseguros", () => {
    expect(normalizeProjectRelativePath(String.raw`..\project\./chapters\main.tex`)).toBe(
      String.raw`project\chapters\main.tex`,
    );
  });

  it("sanitiza chaves usadas no cache de preview", () => {
    expect(sanitizeCacheKey("Projeto / Cliente: A@o")).toBe("Projeto---Cliente--A-o");
  });

  it("gera diretorio de cache fora do repositorio", () => {
    expect(getPreviewCacheDir("cliente", "preview")).toContain("editortex-preview-cache");
    expect(getPreviewCacheDir("cliente", "preview")).toContain("cliente-preview");
  });
});
