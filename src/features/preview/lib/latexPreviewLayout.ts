import type { UploadedTemplate } from "@/types/latex";

export type LatexPreviewLayout = {
  chapterBackgroundImage?: string;
  chapterBackgroundMirrored?: boolean;
  chapterTitleIconImage?: string;
  coverHeaderImage?: string;
  coverLogoImage?: string;
  pageFooterImage?: string;
};

export function resolveLatexPreviewLayout(uploadedTemplate?: UploadedTemplate): LatexPreviewLayout {
  const source = collectTemplateSources(uploadedTemplate);
  const chapterBackgroundImage = findChapterBackgroundImage(source);
  const coverImages = findCoverImages(source);
  return {
    chapterBackgroundImage,
    chapterBackgroundMirrored: Boolean(
      chapterBackgroundImage && /\\reflectbox\s*\{[\s\S]*?\\includegraphics/i.test(source),
    ),
    chapterTitleIconImage: findChapterTitleIconImage(source),
    coverHeaderImage: coverImages[0],
    coverLogoImage: coverImages[1],
    pageFooterImage: findPageFooterImage(source),
  };
}

function collectTemplateSources(uploadedTemplate?: UploadedTemplate) {
  if (!uploadedTemplate) {
    return "";
  }

  const textFiles = uploadedTemplate.project.files
    .filter((file) => file.content && ["tex", "style", "class"].includes(file.kind))
    .map((file) => file.content);

  return [uploadedTemplate.content, uploadedTemplate.parsedTemplate.preamble, ...textFiles].filter(Boolean).join("\n");
}

function findChapterBackgroundImage(source: string) {
  const chapterBackgroundBody = findCommandBody(source, "ChapterBackground");
  const imageName = chapterBackgroundBody ? findFirstIncludeGraphicsImage(chapterBackgroundBody) : undefined;
  if (imageName) {
    return imageName;
  }

  const pretocmdChapter = source.match(/\\pretocmd\s*\{\\chapter}\s*\{([\s\S]*?)}\s*\{\}\s*\{\}/i)?.[1] ?? "";
  const directImage = findFirstIncludeGraphicsImage(pretocmdChapter);
  if (directImage) {
    return directImage;
  }

  return undefined;
}

function findCoverImages(source: string) {
  const coverBody = findCommandBody(source, "capaCustomizada");
  return coverBody ? findIncludeGraphicsImages(coverBody) : [];
}

function findChapterTitleIconImage(source: string) {
  const match = source.match(
    /\\titleformat(?:\s*\[[^\]]*])?\s*\{(?:name=)?\\chapter}[\s\S]*?\\includegraphics(?:\s*\[[^\]]*])?\s*\{([^}]+)}/i,
  );
  return match?.[1]?.trim();
}

function findPageFooterImage(source: string) {
  const hookMatch = source.match(/\\AddToHook\s*\{shipout\/foreground}\s*\{([\s\S]*?)\\fi\s*}/i);
  const hookImage = hookMatch ? findFirstIncludeGraphicsImage(hookMatch[1]) : undefined;
  if (hookImage) {
    return hookImage;
  }

  const footerBody = findCommandBody(source, "RodapeImagem");
  return footerBody ? findFirstIncludeGraphicsImage(footerBody) : undefined;
}

function findCommandBody(source: string, commandName: string) {
  const commandStart = source.search(new RegExp(`\\\\(?:re)?newcommand\\s*\\{?\\\\${commandName}\\}?`, "i"));
  if (commandStart < 0) {
    return undefined;
  }

  const firstBodyBrace = source.indexOf("{", source.indexOf(commandName, commandStart) + commandName.length);
  if (firstBodyBrace < 0) {
    return undefined;
  }

  return readBalancedBrace(source, firstBodyBrace);
}

function readBalancedBrace(source: string, openBraceIndex: number) {
  let depth = 0;
  for (let index = openBraceIndex; index < source.length; index += 1) {
    const character = source[index];
    const previous = source[index - 1];
    if (character === "{" && previous !== "\\") {
      depth += 1;
      continue;
    }
    if (character === "}" && previous !== "\\") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(openBraceIndex + 1, index);
      }
    }
  }

  return undefined;
}

function findFirstIncludeGraphicsImage(source: string) {
  const match = source.match(/\\includegraphics(?:\s*\[[^\]]*])?\s*\{([^}]+)}/i);
  return match?.[1]?.trim();
}

function findIncludeGraphicsImages(source: string) {
  return Array.from(source.matchAll(/\\includegraphics(?:\s*\[[^\]]*])?\s*\{([^}]+)}/gi))
    .map((match) => match[1]?.trim())
    .filter((value): value is string => Boolean(value));
}
