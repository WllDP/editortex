import { describe, expect, it } from "vitest";
import { lexicalJsonToLatex } from "@/utils/latex/lexicalToLatex";

function state(children: unknown[]) {
  return JSON.stringify({
    root: {
      type: "root",
      children,
    },
  });
}

function paragraph(children: unknown[]) {
  return {
    type: "paragraph",
    children,
  };
}

function text(value: string, format = 0) {
  return {
    type: "text",
    text: value,
    format,
  };
}

describe("lexicalJsonToLatex", () => {
  it("renders bold, italic and underline text", () => {
    const lexicalJson = state([paragraph([text("Bold", 1), text(" Italic", 2), text(" Underline", 8)])]);

    expect(lexicalJsonToLatex(lexicalJson)).toBe("\\textbf{Bold}\\textit{ Italic}\\underline{ Underline}");
  });

  it("escapes LaTeX special characters inside rich text", () => {
    const lexicalJson = state([paragraph([text("A&B 50% $x_1$ #tag {ok}")])]);

    expect(lexicalJsonToLatex(lexicalJson)).toBe("A\\&B 50\\% \\$x\\_1\\$ \\#tag \\{ok\\}");
  });

  it("renders unordered lists", () => {
    const lexicalJson = state([
      {
        type: "list",
        listType: "bullet",
        children: [
          { type: "listitem", children: [text("Primeiro")] },
          { type: "listitem", children: [text("Segundo", 1)] },
        ],
      },
    ]);

    expect(lexicalJsonToLatex(lexicalJson)).toBe(
      "\\begin{itemize}\n\\item Primeiro\n\\item \\textbf{Segundo}\n\\end{itemize}",
    );
  });

  it("renders links", () => {
    const lexicalJson = state([
      paragraph([
        {
          type: "link",
          url: "https://example.com?a=1&b=2",
          children: [text("site")],
        },
      ]),
    ]);

    expect(lexicalJsonToLatex(lexicalJson)).toBe("\\href{https://example.com?a=1\\&b=2}{site}");
  });

  it("falls back to plain text when serialized state is invalid", () => {
    expect(lexicalJsonToLatex("{invalid", "A&B")).toBe("A\\&B");
  });
});
