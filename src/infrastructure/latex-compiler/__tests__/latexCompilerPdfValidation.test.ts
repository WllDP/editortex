import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isRenderablePdfFile } from "../latexCompiler";

describe("isRenderablePdfFile", () => {
  it("rejeita PDF vazio", async () => {
    const filePath = path.join(process.cwd(), ".tmp-empty-preview.pdf");
    await fs.writeFile(filePath, Buffer.alloc(0));

    try {
      await expect(isRenderablePdfFile(filePath)).resolves.toBe(false);
    } finally {
      await fs.unlink(filePath).catch(() => undefined);
    }
  });

  it("aceita arquivo com assinatura PDF", async () => {
    const filePath = path.join(process.cwd(), ".tmp-valid-preview.pdf");
    await fs.writeFile(filePath, Buffer.from("%PDF-1.7\n", "latin1"));

    try {
      await expect(isRenderablePdfFile(filePath)).resolves.toBe(true);
    } finally {
      await fs.unlink(filePath).catch(() => undefined);
    }
  });
});
