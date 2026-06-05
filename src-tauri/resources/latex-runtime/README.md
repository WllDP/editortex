# EditorTex LaTeX Runtime

Coloque aqui um runtime LaTeX portavel quando o app precisar ser distribuido com compilacao offline embutida.

Estrutura esperada:

```txt
latex-runtime/
  bin/
    windows/
      pdflatex.exe
      lualatex.exe
      xelatex.exe
      latexmk.exe
    macos/
    linux/
```

O backend Tauri procura primeiro `EDITORTEX_LATEX_BIN`/`EDITORTEX_LATEX_HOME`, depois este runtime embutido nos resources do app, e por fim os executaveis no `PATH`.
