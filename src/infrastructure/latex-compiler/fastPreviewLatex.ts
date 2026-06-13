import type { CompileMode } from "@/features/preview/types/compileTypes";

export interface FastPreviewOptions {
  draftImages: boolean;
  disableBackgrounds: boolean;
  disableDecorativePages: boolean;
  disableHeavyTikz: boolean;
}

export const defaultFastPreviewOptions: FastPreviewOptions = {
  draftImages: false,
  disableBackgrounds: true,
  disableDecorativePages: true,
  disableHeavyTikz: true,
};

export function applyFastPreviewMode(
  tex: string,
  mode: CompileMode,
  options: FastPreviewOptions = defaultFastPreviewOptions,
  fastPreviewOverride?: boolean,
) {
  const fastPreview = fastPreviewOverride ?? mode === "pdf-preview";
  const withFlag = setFastPreviewFlag(tex, fastPreview, options);

  if (!fastPreview) {
    return withFlag;
  }

  return ensureFastPreviewHasRenderablePage(applyFastPreviewLightweightFallbacks(withFlag, options));
}

function setFastPreviewFlag(tex: string, fastPreview: boolean, options: FastPreviewOptions) {
  const desiredValue = fastPreview ? "\\fastpreviewtrue" : "\\fastpreviewfalse";
  const nextTex = tex
    .replace(/^[ \t]*\\newif\\iffastpreview[ \t]*\r?\n?/gm, "")
    .replace(/^[ \t]*\\fastpreview(?:true|false)[ \t]*\r?\n?/gm, "");

  const flagLines = ["\\newif\\iffastpreview", desiredValue];
  if (fastPreview && options.draftImages) {
    flagLines.push("\\PassOptionsToPackage{draft}{graphicx}", "\\PassOptionsToPackage{draft}{graphics}");
  }
  if (fastPreview) {
    flagLines.push(
      "\\providecommand{\\EditorLatexFastPreviewPlaceholder}{\\clearpage\\begingroup\\thispagestyle{plain}\\vspace*{0.32\\textheight}\\begin{center}\\fbox{\\parbox{0.72\\linewidth}{\\centering\\normalfont\\bfseries\\Large Preview rapido sem conteudo renderizavel\\\\[0.8em]\\normalfont\\normalsize Esta revisao contem apenas elementos finais ou decorativos removidos pelo fastpreview. Use a compilacao fiel/final para ver a capa completa.}}\\end{center}\\clearpage\\endgroup}",
    );
  }

  const flag = flagLines.join("\n");
  const documentClassRegex = /(\\documentclass(?:\[[^\]]*])?\{[^}]+\})/;
  if (documentClassRegex.test(nextTex)) {
    return nextTex.replace(documentClassRegex, `$1\n${flag}`);
  }

  return `${flag}\n${nextTex}`;
}

function applyFastPreviewLightweightFallbacks(tex: string, options: FastPreviewOptions) {
  const lines = tex.split(/\r?\n/);
  const nextLines: string[] = [];
  let wrappingTikzBlock = false;
  let tikzDepth = 0;
  let skippingBlock:
    | {
        depth: number;
      }
    | undefined;

  for (const line of lines) {
    if (skippingBlock) {
      skippingBlock.depth += countBraceDelta(line);
      if (skippingBlock.depth <= 0) {
        skippingBlock = undefined;
      }
      continue;
    }

    if (wrappingTikzBlock) {
      if (/\\begin\{tikzpicture\}/.test(line)) {
        tikzDepth += 1;
      }
      if (/\\end\{tikzpicture\}/.test(line)) {
        tikzDepth -= 1;
      }

      nextLines.push(line);
      if (tikzDepth <= 0) {
        nextLines.push("\\fi");
        wrappingTikzBlock = false;
      }
      continue;
    }

    if (options.disableDecorativePages && /\\newcommand\s*\{\\capaCustomizada\}/.test(line)) {
      nextLines.push("\\providecommand{\\capaCustomizada}{}");
      const depth = countBraceDelta(line);
      if (depth > 0) {
        skippingBlock = { depth };
      }
      continue;
    }

    if (options.disableDecorativePages && /\\newcommand\s*\{\\PaginaFinalImagem\}/.test(line)) {
      nextLines.push("\\providecommand{\\PaginaFinalImagem}[1]{}");
      const depth = countBraceDelta(line);
      if (depth > 0) {
        skippingBlock = { depth };
      }
      continue;
    }

    if (options.disableBackgrounds && isBackgroundBlockStart(line)) {
      nextLines.push(`% fastpreview: ${line.trim()} removido no preview`);
      const depth = countBraceDelta(line);
      if (depth > 0) {
        skippingBlock = { depth };
      }
      continue;
    }

    if (options.disableBackgrounds && isBackgroundLine(line)) {
      nextLines.push(wrapInFinalOnly(line));
      continue;
    }

    if (options.disableDecorativePages && isDecorativePageLine(line)) {
      nextLines.push(wrapInFinalOnly(line));
      continue;
    }

    if (options.disableHeavyTikz && isHeavyTikzLine(line)) {
      nextLines.push("\\iffastpreview\\else");
      nextLines.push(line);
      tikzDepth = 1;
      wrappingTikzBlock = true;
      continue;
    }

    nextLines.push(line);
  }

  if (wrappingTikzBlock) {
    nextLines.push("\\fi");
  }

  return nextLines.join("\n");
}

function isBackgroundLine(line: string) {
  return /\\(?:AddToShipoutPictureBG\*?|AddToHook\{shipout\/(?:foreground|background)\})/.test(line);
}

function isBackgroundBlockStart(line: string) {
  return /\\(?:AddToShipoutPictureBG\*?|AddToHook\{shipout\/(?:foreground|background)\})\s*\{/.test(line);
}

function isDecorativePageLine(line: string) {
  return /\\PaginaFinalImagem\b|\\capaCustomizada\b/.test(line);
}

function isHeavyTikzLine(line: string) {
  return /\\begin\{tikzpicture\}\[[^\]]*(?:remember picture|overlay)/.test(line);
}

function wrapInFinalOnly(line: string) {
  if (!line.trim() || line.includes("\\iffastpreview")) {
    return line;
  }

  return `\\iffastpreview\\else ${line} \\fi`;
}

function ensureFastPreviewHasRenderablePage(tex: string) {
  const documentMatch = tex.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
  if (!documentMatch || hasRenderablePreviewBody(documentMatch[1] ?? "")) {
    return tex;
  }

  return tex.replace("\\begin{document}", "\\begin{document}\n\\EditorLatexFastPreviewPlaceholder");
}

function hasRenderablePreviewBody(body: string) {
  const withoutFinalOnly = body.replace(/\\iffastpreview\\else[\s\S]*?\\fi/g, "");
  const withoutComments = withoutFinalOnly
    .split(/\r?\n/)
    .map((line) => line.replace(/(?<!\\)%.*/, "").trim())
    .filter(Boolean)
    .join("\n");

  return withoutComments.length > 0;
}

function countBraceDelta(line: string) {
  let delta = 0;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const previous = line[index - 1];
    if (previous === "\\") {
      continue;
    }
    if (char === "{") {
      delta += 1;
    } else if (char === "}") {
      delta -= 1;
    }
  }
  return delta;
}
