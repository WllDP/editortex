import { describe, expect, it } from "vitest";
import { resolveLatexPreviewLayout } from "@/features/preview/lib/latexPreviewLayout";
import type { UploadedTemplate } from "@/types/latex";

describe("resolveLatexPreviewLayout", () => {
  it("extracts chapter background image from ChapterBackground macro", () => {
    const template = createTemplate(String.raw`
\newcommand{\ChapterBackground}{%
  \AddToShipoutPictureBG*{%
    \AtPageUpperLeft{%
      \raisebox{-\paperheight}{%
        \includegraphics[
          width=\paperwidth,
          height=\paperheight
        ]{fundo_titulo}%
      }%
    }%
  }%
}
\pretocmd{\chapter}{%
  \clearpage
  \thispagestyle{empty}
  \ChapterBackground
}{}{}
`);

    expect(resolveLatexPreviewLayout(template)).toMatchObject({
      chapterBackgroundImage: "fundo_titulo",
    });
  });

  it("detects mirrored chapter background usage", () => {
    const template = createTemplate(String.raw`
\newcommand{\ChapterBackground}{\includegraphics{fundo_titulo}}
\newcommand{\specialchapter}[2]{%
  \reflectbox{\includegraphics[width=\paperwidth]{fundo_titulo}}
}
`);

    expect(resolveLatexPreviewLayout(template)).toMatchObject({
      chapterBackgroundImage: "fundo_titulo",
      chapterBackgroundMirrored: true,
    });
  });

  it("extracts cover and chapter icon images from imported latex", () => {
    const template = createTemplate(String.raw`
\newcommand{\capaCustomizada}{
  \includegraphics[width=0.9\paperwidth]{cabeca}
  \includegraphics[height=2cm]{icone}
}

\titleformat{name=\chapter}
  {\ChapterFont\color{black}}
  {}
  {0pt}
  {\includegraphics[height=0.9em]{icone.png}\hspace{0.5em}}
`);

    expect(resolveLatexPreviewLayout(template)).toMatchObject({
      coverHeaderImage: "cabeca",
      coverLogoImage: "icone",
      chapterTitleIconImage: "icone.png",
    });
  });

  it("extracts page footer image from shipout foreground hook", () => {
    const template = createTemplate(String.raw`
\AddToHook{shipout/foreground}{%
  \ifRodapeAtivo
    \begin{tikzpicture}
      \includegraphics[width=\paperwidth]{rodape.png}
    \end{tikzpicture}
  \fi
}
`);

    expect(resolveLatexPreviewLayout(template)).toMatchObject({
      pageFooterImage: "rodape.png",
    });
  });
});

function createTemplate(content: string): UploadedTemplate {
  return {
    id: "template",
    name: "template",
    fileName: "main.tex",
    content,
    sourceType: "tex-file",
    parsedTemplate: {
      id: "parsed",
      name: "template",
      rawContent: content,
      preamble: content,
      body: "",
      commands: [],
      variables: [],
      environments: [],
      parsedAt: "2026-06-12T00:00:00.000Z",
    },
    project: {
      sourceType: "tex-file",
      mainTexPath: "main.tex",
      files: [
        {
          path: "main.tex",
          name: "main.tex",
          extension: "tex",
          kind: "tex",
          size: content.length,
          content,
        },
      ],
      assets: [],
    },
    createdAt: "2026-06-12T00:00:00.000Z",
  };
}
