import { describe, expect, it } from "vitest";
import { calculateBottlenecks, createReport, generateMarkdown } from "../../../../scripts/benchmarkLatexCompilation";

describe("benchmarkLatexCompilation report helpers", () => {
  it("calcula percentuais de gargalo", () => {
    const bottlenecks = calculateBottlenecks({
      totalMs: 1000,
      latexMs: 800,
      syncMs: 50,
      writeFilesMs: 50,
      pdfReadMs: 20,
      mode: "pdf-preview",
    });

    expect(bottlenecks).toEqual({
      latex: 80,
      asset_sync: 5,
      write_files: 5,
      pdf_read: 2,
      other: 8,
    });
  });

  it("gera markdown com tabela e health check", () => {
    const report = createReport(
      "template.zip",
      "template.zip",
      [
        {
          label: "Preview rapido",
          scenario: "first_compile",
          mode: "pdf-preview",
          success: true,
          cacheHit: false,
          metrics: {
            mode: "pdf-preview",
            totalMs: 1000,
            latexMs: 800,
            syncMs: 50,
            writeFilesMs: 50,
            pdfReadMs: 20,
            pdfSizeMb: 2.3,
            pageCount: 4,
            fastPreview: true,
          },
          bottlenecks: { latex: 80, asset_sync: 5, write_files: 5, pdf_read: 2, other: 8 },
          timeline: { latex: 800, asset_sync: 50, write_files: 50, pdf_read: 20 },
          warnings: ["WARNING: latex consumes 80% of measured pipeline time."],
          diagnostics: [],
        },
      ],
      [],
    );

    const markdown = generateMarkdown(report);

    expect(markdown).toContain("# EditorLatex Benchmark");
    expect(markdown).toContain("| Preview rapido |");
    expect(markdown).toContain("Cache funcionando");
    expect(markdown).toContain("Maior gargalo");
    expect(markdown).toContain("Compile Timeline");
  });
});
