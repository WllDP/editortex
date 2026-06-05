export function normalizeLatexSource(source: string): string {
  return source.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

export function splitPreambleAndBody(source: string) {
  const beginDocument = source.search(/\\begin\s*\{\s*document\s*\}/);

  if (beginDocument === -1) {
    return {
      preamble: source,
      body: "",
    };
  }

  return {
    preamble: source.slice(0, beginDocument).trim(),
    body: source.slice(beginDocument).trim(),
  };
}
