# Agent Onboarding

Use este roteiro para iniciar trabalho no EditorLatex com pouco contexto.

## Objetivo do Produto

EditorLatex e um editor desktop/visual de documentos LaTeX baseado em blocos. O usuario monta documentos visualmente, o sistema gera TEX, sincroniza arquivos do projeto e compila PDF com cache persistente.

O objetivo de produto e oferecer experiencia proxima ao Overleaf, mas otimizada para desktop, edicao estruturada por blocos e controle local de arquivos.

## Arquitetura em Uma Frase

Frontend React/Zustand gera o contrato de compilacao; backend Node/Vite ou Tauri persiste projeto, sincroniza manifest/assets, compila LaTeX e retorna PDF/diagnostics/metricas; pdf.js renderiza o resultado.

## Fluxo Mental Para Qualquer Tarefa

1. Identifique a area tocada: UI, store, TEX, compiler, manifest, Tauri, importacao, PDF viewer ou docs.
2. Leia `AGENT_RULES.md`.
3. Leia `AI_CONTEXT.md`.
4. Leia o doc especifico da area no `AGENT_DOCS_INDEX.md`.
5. Procure testes existentes com nome da feature ou arquivo.
6. Faça a menor alteracao que preserve contratos e cache.
7. Rode validacoes proporcionais ao risco.
8. Atualize docs se mudou comportamento, regra ou contrato.

## Arquivos Mais Importantes

- `src/features/preview/types/compileTypes.ts`: contrato compartilhado.
- `src/features/preview/lib/pdfPreviewService.ts`: montagem de request, Tauri/Vite bridge e URL de PDF.
- `src/store/slices/previewSlice.ts`: fluxo de gerar/reusar TEX e disparar compilacao.
- `src/infrastructure/latex-compiler/latexCompiler.ts`: compilador Node/Vite.
- `src/infrastructure/latex-compiler/projectManifest.ts`: manifest e sync por delta no Node/Vite.
- `src/infrastructure/latex-compiler/projectImport.ts`: importacao persistente no Node/Vite.
- `src/infrastructure/latex-compiler/fastPreviewLatex.ts`: transformacoes de preview rapido.
- `src/features/preview/lib/pdfRenderer.tsx`: renderizacao pdf.js.
- `src-tauri/src/lib.rs`: comandos Tauri e fluxo Rust principal.
- `src-tauri/src/project_manifest.rs`, `project_sync.rs`, `latex_compile.rs`: modulos Rust extraidos.

## Decisoes Que Nao Devem Ser Redescobertas

- `Date.now()` nao e cache buster aceitavel para PDF.
- `sourceHash` e `revision` formam chave estavel de URL, mas cache interno pode usar hash do TEX efetivo transformado.
- `pdf-preview` e fiel por padrao na aba PDF.
- `fastpreview` existe, mas e opt-in e pode remover elementos graficos.
- Preview preserva auxiliares LaTeX.
- Final pode limpar mais artefatos, mas nao pode quebrar preview.
- Assets devem ir por manifest/hash, nao base64 permanente.
- Importacao persistente deve acontecer no backend, especialmente Tauri.
- Node/Vite e Tauri devem permanecer equivalentes sempre que possivel.

## Como Diagnosticar Bugs Rapidamente

- PDF vazio: verifique tamanho e header `%PDF-`.
- PDF branco: confirme se o PDF contem texto/operadores; se sim, investigue `PdfRenderer`.
- Imagem LaTeX ausente: verifique `\graphicspath`, manifest e caminhos relativos.
- Cache errado: compare `sourceHash`, hash do TEX efetivo, `lastCompiledByMode` e PDF do modo.
- Timeout antes do LaTeX: verifique tamanho de request, importacao ZIP e persistencia.
- Erro LaTeX: use diagnostics estruturados e log bruto.

## Quando Parar e Reportar

Pare antes de alterar codigo se:

- a tarefa exige escolher entre fidelidade visual e performance sem decisao do usuario;
- documentacao e codigo entram em conflito sobre regra inviolavel;
- uma correcao exigiria apagar manifest/cache ou remover compatibilidade Tauri/Node;
- o bug depende de arquivo externo que nao existe no workspace;
- testes mostram regressao fora da area tocada.
