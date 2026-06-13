# Known Limitations

Este arquivo deve ser atualizado sempre que surgir nova limitacao tecnica relevante.

## Fastpreview

- As heuristicas de elementos caros ainda sao conservadoras.
- Templates extremamente customizados podem nao ser otimizados automaticamente.
- O fluxo Rust injeta a flag `fastpreview`; heuristicas ricas de condicionamento vivem principalmente no transformador TypeScript.

## Templates

- Templates sem `main.tex`, sem `.tex` na raiz e sem `\documentclass` podem exigir fallback manual.
- Templates com macros proprietarias para capa/background podem precisar ser adaptados para `\iffastpreview`.
- Preview fiel ainda nao e pixel-perfect em todos os templates.

## LaTeX Local

- Benchmark e compilacao real dependem de toolchain local: `latexmk`, `pdflatex`, `xelatex` ou `lualatex`.
- Ambientes CI sem LaTeX devem executar testes unitarios, mas nao necessariamente benchmark real.

## Node/Vite vs Tauri

- Tauri e a arquitetura final.
- Node/Vite existe para desenvolvimento e pode ter pequenas diferencas temporarias, desde que documentadas e sem quebrar fluxo dev.

## PDF Viewer

- pdf.js usa range/stream loading, mas comportamento final depende da origem da URL e suporte do servidor.
- Heuristicas contra pagina branca devem permanecer simples para nao criar timers excessivos.

## Diagnostics

- Parser de logs LaTeX captura erros e warnings comuns, mas logs de pacotes muito especificos podem nao ser classificados perfeitamente.
