import { createReadStream } from "node:fs";
import type { IncomingMessage } from "node:http";
import type { Plugin } from "vite";
import { enqueueLatexPreviewCompile } from "./compileQueue";
import { findFirstPdf, findRequestedPdf, getPreviewCacheDir, sanitizeCacheKey } from "./pdfCache";
import type { PreviewCompileRequest } from "./types";

export function latexPreviewDevServer(): Plugin {
  return {
    name: "latex-preview-dev-server",
    configureServer(server) {
      server.middlewares.use("/api/compile-preview", async (request, response) => {
        if (request.method !== "POST") {
          response.statusCode = 405;
          response.end("Method not allowed");
          return;
        }

        try {
          const payload = JSON.parse(await readRequestBody(request)) as PreviewCompileRequest;
          const result = await enqueueLatexPreviewCompile(payload);
          response.setHeader("Content-Type", "application/json");
          response.end(JSON.stringify(result));
        } catch (error) {
          response.statusCode = 500;
          response.setHeader("Content-Type", "application/json");
          response.end(
            JSON.stringify({
              diagnostics: [error instanceof Error ? error.message : "Falha ao compilar preview no Vite."],
            }),
          );
        }
      });

      server.middlewares.use("/api/preview-pdf", async (request, response) => {
        const startedAt = performance.now();
        const requestUrl = new URL(request.url ?? "", "http://localhost");
        const projectKey = sanitizeCacheKey(requestUrl.searchParams.get("projectKey") ?? "standalone");
        const mode = sanitizeCacheKey(requestUrl.searchParams.get("mode") ?? "preview");
        const previewDir = getPreviewCacheDir(projectKey, mode);
        const pdfPath =
          (await findRequestedPdf(previewDir, requestUrl.searchParams.get("pdf"))) ?? (await findFirstPdf(previewDir));

        if (!pdfPath) {
          response.statusCode = 404;
          response.end("PDF not found");
          return;
        }

        response.setHeader("Content-Type", "application/pdf");
        response.setHeader("Cache-Control", "no-store");
        createReadStream(pdfPath)
          .on("open", () => {
            console.info(
              `[EditorTex perf] servir PDF por URL: ${(performance.now() - startedAt).toFixed(1)}ms | path=${pdfPath}`,
            );
          })
          .on("error", (error) => {
            response.statusCode = 500;
            response.end(error.message);
          })
          .pipe(response);
      });
    },
  };
}

function readRequestBody(request: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];

    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}
