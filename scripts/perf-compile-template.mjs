/* global console, performance, process */
import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";

const defaultZip = String.raw`c:\Users\Testing Company\Downloads\overleaf-main.zip`;
const zipPath = process.argv[2] ?? defaultZip;

async function main() {
  const startedAt = performance.now();
  const content = await fs.readFile(zipPath);
  const zip = await JSZip.loadAsync(content);
  const entries = Object.values(zip.files).filter((entry) => !entry.dir && !entry.name.startsWith("__MACOSX/"));
  const texEntries = entries.filter((entry) => entry.name.toLowerCase().endsWith(".tex"));
  const mainTex = await findMainTex(texEntries);
  const imageCount = entries.filter((entry) => /\.(png|jpe?g|webp|svg)$/i.test(entry.name)).length;
  const supportCount = entries.filter((entry) => /\.(sty|cls|bib|bst)$/i.test(entry.name)).length;

  console.log("[EditorLatex perf template]");
  console.log(`zip=${zipPath}`);
  console.log(`files=${entries.length}`);
  console.log(`tex=${texEntries.length}`);
  console.log(`main=${mainTex?.name ?? "not-found"}`);
  console.log(`images=${imageCount}`);
  console.log(`support=${supportCount}`);
  console.log(`inspectMs=${(performance.now() - startedAt).toFixed(1)}`);
  console.log("next=execute o app, importe este ZIP, compile duas vezes e confira cacheHit/assetsPayloadCount nas metricas.");
}

async function findMainTex(texEntries) {
  const byName = texEntries.find((entry) => path.basename(entry.name).toLowerCase() === "main.tex");
  if (byName) return byName;

  for (const entry of texEntries) {
    const text = await entry.async("text");
    if (/\\documentclass|\\begin\s*\{\s*document\s*\}/.test(text)) {
      return entry;
    }
  }

  return undefined;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
