import type { UploadedTemplate } from "@/types/latex";

const defaultPreviewFontFamily = "Arial, sans-serif";

const latexPackageFonts: Record<string, string> = {
  montserrat: "Montserrat",
  lato: "Lato",
  roboto: "Roboto",
  sourcesanspro: "Source Sans Pro",
  sourcecodepro: "Source Code Pro",
  libertine: "Linux Libertine",
  mathpazo: "Palatino",
  helvet: "Helvetica",
};

export function resolveLatexPreviewFontFamily(uploadedTemplate?: UploadedTemplate) {
  const source = collectTemplateFontSources(uploadedTemplate);
  const fontName = findFontspecMainFont(source) ?? findLatexPackageFont(source);
  if (!fontName) {
    return defaultPreviewFontFamily;
  }

  return `${quoteCssFontFamily(fontName)}, ${defaultPreviewFontFamily}`;
}

function collectTemplateFontSources(uploadedTemplate?: UploadedTemplate) {
  if (!uploadedTemplate) {
    return "";
  }

  const textFiles = uploadedTemplate.project.files
    .filter((file) => file.content && ["tex", "style", "class"].includes(file.kind))
    .map((file) => file.content);

  return [uploadedTemplate.content, uploadedTemplate.parsedTemplate.preamble, ...textFiles].filter(Boolean).join("\n");
}

function findFontspecMainFont(source: string) {
  const patterns = [
    /\\setmainfont(?:\s*\[[^\]]*])?\s*\{([^}]+)}/i,
    /\\setsansfont(?:\s*\[[^\]]*])?\s*\{([^}]+)}/i,
    /\\newfontfamily\s*\\[a-zA-Z@]+\s*(?:\[[^\]]*])?\s*\{([^}]+)}/i,
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);
    const fontName = normalizeFontName(match?.[1]);
    if (fontName) {
      return fontName;
    }
  }

  return undefined;
}

function findLatexPackageFont(source: string) {
  const packageMatches = source.matchAll(/\\usepackage(?:\s*\[[^\]]*])?\s*\{([^}]+)}/gi);
  for (const match of packageMatches) {
    const packageNames = match[1].split(",").map((name) => name.trim().toLowerCase());
    for (const packageName of packageNames) {
      const fontName = latexPackageFonts[packageName];
      if (fontName) {
        return fontName;
      }
    }
  }

  return undefined;
}

function normalizeFontName(value: string | undefined) {
  const fontName = value?.replace(/\s+/g, " ").trim();
  return fontName || undefined;
}

function quoteCssFontFamily(fontName: string) {
  return `"${fontName.replace(/["\\]/g, "")}"`;
}
