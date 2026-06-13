# AI Changelog

Historico tecnico resumido das etapas executadas por agentes. Atualize este arquivo em toda nova etapa.

## Documentacao Operacional Para Agentes

Resumo: criados pontos de entrada e guardrails especificos para agentes de IA.

Arquivos adicionados:

- `AGENTS.md`
- `docs/AGENT_DOCS_INDEX.md`
- `docs/AGENT_ONBOARDING.md`
- `docs/AGENT_GUARDRAILS.md`
- `docs/AGENT_TASK_CHECKLISTS.md`

Decisoes:

- `AGENTS.md` passa a ser o ponto de entrada padrao.
- `AGENT_RULES.md` continua sendo a lista de regras inviolaveis.
- Docs especificos continuam sendo fonte de verdade por area.
- Guardrails documentam o que nao deve ser refeito, alterado ou excluido sem justificativa.

## Etapa 1

Resumo: diagnostico inicial da arquitetura de preview e compilacao LaTeX.

Arquivos analisados:

- `src/store/slices/previewSlice.ts`
- `src/features/preview/lib/pdfPreviewService.ts`
- `src/features/preview/lib/pdfRenderer.tsx`
- `src/infrastructure/latex-compiler/latexCompiler.ts`
- `src/infrastructure/latex-compiler/pdfCache.ts`
- `src/infrastructure/latex-compiler/latexPreviewServer.ts`
- `src-tauri/src/lib.rs`
- `src/store/slices/assetSlice.ts`
- `src/features/template-upload/services/overleafZipService.ts`

Decisoes:

- Priorizar cache, manifest e separacao frontend/backend antes de features maiores.

## Etapa 2

Resumo: base de contrato e cache inicial.

Arquivos alterados principais:

- `src/features/preview/types/compileTypes.ts`
- `src/store/slices/previewSlice.ts`
- `src/features/preview/lib/pdfPreviewService.ts`
- `src/features/preview/lib/pdfRenderer.tsx`
- `src-tauri/src/lib.rs`

Decisoes:

- Criar `CompileRequest`/`CompileResult`.
- Reusar TEX quando `texDirty === false`.
- Remover cache buster com `Date.now()`.
- Usar caminho estavel para TEX preview.
- Preservar auxiliares em preview.
- Habilitar range/stream no pdf.js.

## Etapa 3

Resumo: manifest persistente e sync por delta.

Arquivos alterados principais:

- `src/infrastructure/latex-compiler/projectManifest.ts`
- `src/infrastructure/latex-compiler/latexCompiler.ts`
- `src-tauri/src/lib.rs`
- `src/features/preview/lib/pdfPreviewService.ts`

Decisoes:

- Criar `manifest.json` por projeto.
- Padronizar `source/`, `assets/`, `compile/`, `output/`.
- Escrever apenas arquivos novos/alterados.
- Controlar `.sty`, `.cls`, `.bib`, `.bst` e `.tex` auxiliares no manifest.
- Implementar cache hit real.

## Etapa 4

Resumo: observabilidade, memoria e diagnostics.

Arquivos alterados principais:

- `src/infrastructure/latex-compiler/latexLogParser.ts`
- `src/features/preview/components/PreviewPanel.tsx`
- `src/features/preview/lib/projectAssetService.ts`
- `src/store/slices/assetSlice.ts`
- `src/features/template-upload/services/overleafZipService.ts`

Decisoes:

- Reduzir `binaryBase64` apos sync/importacao.
- Criar asset sob demanda.
- Expor metricas discretas na UI.
- Expor diagnostics de erro LaTeX na UI.
- Criar script `npm run perf:compile-template`.

## Etapa 5

Resumo: importacao ZIP backend-first no Tauri.

Arquivos alterados principais:

- `src-tauri/Cargo.toml`
- `src-tauri/src/lib.rs`
- `src/features/template-upload/services/overleafZipService.ts`
- `src/features/preview/lib/projectAssetService.ts`

Decisoes:

- Adicionar crate `zip`.
- Importar ZIP diretamente no backend Tauri quando possivel.
- Persistir projeto e manifest antes da primeira compilacao.
- Bloquear path traversal/Zip Slip.
- Retornar assets com `alreadySynced: true`.

## Etapa 6

Resumo: `fastpreview` formal e cache por modo.

Arquivos alterados principais:

- `src/infrastructure/latex-compiler/fastPreviewLatex.ts`
- `src/infrastructure/latex-compiler/latexCompiler.ts`
- `src/infrastructure/latex-compiler/projectManifest.ts`
- `src/features/preview/types/compileTypes.ts`
- `src/features/preview/components/PreviewPanel.tsx`
- `src-tauri/src/lib.rs`
- `src-tauri/src/latex_compile.rs`

Decisoes:

- Injetar `\newif\iffastpreview`.
- Decisao atualizada apos teste manual: usar `\fastpreviewfalse` por padrao na aba PDF (`pdf-preview`) para renderizar o PDF fiel ao exportavel.
- Reservar `\fastpreviewtrue` para `previewQuality=fast` opt-in.
- Usar `\fastpreviewfalse` em `pdf-final`.
- Separar `preview.pdf` e `final.pdf`.
- Registrar `lastCompiledByMode`.
- Adicionar `fastPreview` em metricas.

## Etapa 7

### Objetivo

Medir o desempenho real do pipeline apos as otimizacoes das Etapas 1-6, sem introduzir novas otimizacoes.

### Arquivos alterados principais

- `scripts/benchmarkLatexCompilation.ts`
- `package.json`
- `src/features/preview/types/compileTypes.ts`
- `src/infrastructure/latex-compiler/latexCompiler.ts`
- `src-tauri/src/lib.rs`
- `src/features/preview/components/PreviewPanel.tsx`
- `benchmark-results/editorlatex-benchmark.json`
- `benchmark-results/editorlatex-benchmark.md`

### Decisoes

- Adicionar telemetria detalhada: `writeFilesMs`, `pdfReadMs` e `pageCount`.
- Criar `npm run benchmark:latex`.
- Gerar relatorio JSON e Markdown em `benchmark-results/`.
- Nao otimizar heuristicas nesta etapa.

### Resultado

- O benchmark executavel foi criado e gerou JSON/Markdown.
- Com `overleaf-main.zip`, a primeira chamada de compilacao no backend Vite expirou antes de retornar `CompileResult`.
- Nao ha dado real ainda para afirmar ganho de `fastpreview` ou gargalo LaTeX.
- Gargalo confirmado nesta rodada: transporte/serializacao/endpoint dev para payload inicial grande antes da etapa LaTeX.

## Etapa 8

### Objetivo

Instrumentacao completa do pipeline e root cause analysis do timeout identificado na Etapa 7, sem implementar otimizacoes.

### Arquivos alterados principais

- `scripts/benchmarkLatexCompilation.ts`
- `src/features/preview/types/compileTypes.ts`
- `src/infrastructure/latex-compiler/projectManifest.ts`
- `src/infrastructure/latex-compiler/latexCompiler.ts`
- `src-tauri/src/lib.rs`
- `benchmark-results/editorlatex-benchmark.json`
- `benchmark-results/editorlatex-benchmark.md`
- `docs/AI_CONTEXT.md`
- `docs/COMPILATION_PIPELINE.md`
- `docs/PERFORMANCE_GUIDELINES.md`
- `docs/PROJECT_MANIFEST.md`
- `docs/ROADMAP.md`
- `docs/CHANGELOG_AI.md`

### Decisoes

- Manter os nomes reais atuais dos relatorios: `editorlatex-benchmark.json` e `editorlatex-benchmark.md`.
- Adicionar metricas de RCA: ZIP, hash, serializacao, round trip, manifest, asset sync e PDF serve/read.
- Nao otimizar nesta etapa.

### Resultado

- ZIP real: aproximadamente 49.6 MB, 6530 arquivos, 115 arquivos TEX.
- Request JSON gerado: aproximadamente 96.7 MB.
- ZIP read: 72.6 ms.
- ZIP extract: 209.8 ms.
- Asset hash: 182.9 ms.
- Request serialize: 710.6 ms.
- Request round trip: 20023.1 ms, 94% do tempo medido.
- Causa do timeout: `request_round_trip_to_vite_backend`.
- Manifest, asset sync, LaTeX e PDF nao foram alcancados nessa run.

## Etapa 9

### Objetivo

Remover o payload JSON monolitico do fluxo Vite/dev e permitir que o benchmark compile a partir de projeto ja persistido.

### Arquivos alterados principais

- `src/infrastructure/latex-compiler/projectImport.ts`
- `src/infrastructure/latex-compiler/latexPreviewServer.ts`
- `src/infrastructure/latex-compiler/latexCompiler.ts`
- `src/features/preview/types/compileTypes.ts`
- `src/features/template-upload/services/overleafZipService.ts`
- `scripts/benchmarkLatexCompilation.ts`
- `src/infrastructure/latex-compiler/__tests__/projectImport.test.ts`
- `benchmark-results/editorlatex-benchmark.json`
- `benchmark-results/editorlatex-benchmark.md`
- `docs/AI_CONTEXT.md`
- `docs/COMPILATION_PIPELINE.md`
- `docs/PERFORMANCE_GUIDELINES.md`
- `docs/PROJECT_MANIFEST.md`
- `docs/ROADMAP.md`
- `docs/CHANGELOG_AI.md`

### Decisoes

- Criar endpoint Vite/dev `POST /api/import-project-zip` usando `application/octet-stream`.
- Persistir ZIP importado em `projects/{projectKey}` no backend dev antes da compilacao.
- Retornar apenas metadados, `sourceHash` e `mainTexContent`; nao retornar assets em base64.
- Adicionar `usePersistedProject` ao contrato de compilacao leve.
- Quando `usePersistedProject=true`, o compilador Node/Vite le o TEX persistido e nao executa sync destrutivo de assets.
- Atualizar `readLatexUpload` para usar importacao Vite/dev quando disponivel e manter fallback JSZip.
- Atualizar benchmark para importar uma vez e compilar com payload minimo.

### Resultado

- Antes: request JSON de compilacao ~96.7 MB e timeout em ~20 s antes de LaTeX.
- Depois: request de importacao ~49.6 MB via octet-stream; request de compilacao ~310-314 bytes.
- `assetsPayloadCount=0` nas compilacoes do benchmark persistido.
- Preview rapido sem cache: LaTeX ~7134.7 ms, total backend ~7710.5 ms.
- Preview rapido cache hit: LaTeX 0 ms, total backend ~17.1 ms.
- Preview final sem cache: LaTeX ~7441.1 ms, total backend ~7486.3 ms.
- Preview final cache hit: LaTeX 0 ms, total backend ~34.4 ms.
- Gargalo novo confirmado: importacao inicial Vite/dev dominada por `writeFilesMs` (~100608.4 ms) em ZIP grande.

## Correcao pos-Etapa 9: FastPreview Decorativo

### Contexto

Depois da Etapa 9, um teste manual de compilacao mostrou erro no `pdf-preview`:

```txt
Undefined control sequence.
l.51 \RodapeAtivofalse
```

O `fastpreview` estava envolvendo apenas a primeira linha de comandos decorativos, como `\capaCustomizada`, mas deixava o corpo da macro ativo. Com isso, comandos internos da capa apareciam antes da definicao correspondente:

```tex
\newif\ifRodapeAtivo
```

### Correcao

- `fastPreviewLatex.ts` passou a substituir definicoes decorativas inteiras por stubs seguros no `pdf-preview`.
- `\capaCustomizada` vira `\providecommand{\capaCustomizada}{}`.
- `\PaginaFinalImagem` vira `\providecommand{\PaginaFinalImagem}[1]{}`.
- Blocos de background/shipout sao removidos no preview rapido.
- O corpo decorativo nao permanece ativo parcialmente.
- Teste especifico foi adicionado em `fastPreviewLatex.test.ts`.

### Validacao

```bash
npm run test -- src/infrastructure/latex-compiler/__tests__/fastPreviewLatex.test.ts
npm run typecheck
npm run test
```

Tudo passou.

## Preview Visual: Fonte do Template LaTeX

### Contexto

O preview Visual usava fonte fixa, mas deve refletir a fonte declarada pelo arquivo LaTeX importado quando possivel.

### Alteracoes

- Criado `resolveLatexPreviewFontFamily` para detectar fonte no LaTeX importado.
- Suporte inicial para `\setmainfont`, `\setsansfont`, `\newfontfamily` e pacotes conhecidos como `montserrat`.
- Montserrat foi adicionada como fonte embutida do app via `@fontsource/montserrat`, subsets `latin` e `latin-ext`, pesos 400, 500, 600 e 700.
- `HtmlPreviewPage` passou a receber `fontFamily` via prop.
- `HtmlBlockPreview` resolve a fonte a partir de `uploadedTemplate` e aplica no preview Visual.
- Fallback atual: `Arial, sans-serif`.

### Validacao

```bash
npm run test -- src/features/preview/lib/__tests__/latexPreviewFont.test.ts
npm run typecheck
npm run lint
npm run build
```

Tudo passou.

## Edicao Rica no Texto Livre

### Contexto

O bloco `Texto Livre` precisava de formatacoes basicas em estilo WYSIWYG sem substituir o pipeline atual de blocos, preview Visual ou PDF.

### Alteracoes

- Adicionado Lexical apenas para blocos `plain-text`.
- Criada toolbar discreta com negrito, italico, sublinhado, lista, link e limpar formatacao.
- O estado rico e serializado em JSON no campo `__lexicalJson`.
- O campo `text` continua sendo atualizado com plain text para compatibilidade com documentos antigos e com o pipeline existente.
- Preview Visual renderiza o JSON Lexical quando existir e usa `text` como fallback.
- Geracao LaTeX usa `lexicalJsonToLatex` quando houver JSON Lexical.
- Blocos estruturais, imagem, tabela, equacao e LaTeX preservado nao foram alterados.
- `tsconfig.json` passou a usar `moduleResolution: "Bundler"` para resolver corretamente os submodulos ESM do Lexical no Vite.

### Mapeamentos LaTeX

- bold -> `\textbf{...}`
- italic -> `\textit{...}`
- underline -> `\underline{...}`
- unordered list -> `\begin{itemize} ... \item ... \end{itemize}`
- link -> `\href{url}{texto}`

### Validacao

```bash
npm run test -- src/utils/latex/__tests__/lexicalToLatex.test.ts src/domain/latex/__tests__/blockRendererRichText.test.ts
npm run typecheck
npm run test
npm run lint
npm run build
```

Tudo passou.

## Correcao pos-Etapa 9: PDF Fiel Branco no Viewer

### Contexto

A aba PDF compilava com `\fastpreviewfalse` e o TEX efetivo chamava `\capaCustomizada`. A inspecao com pdf.js confirmou que o PDF continha texto e operadores de desenho, mas o app mostrava apenas a superficie branca da pagina.

### Causa

`PdfRenderer` dependia de `viewportWidth > 0` para ativar a renderizacao. Quando o container era medido inicialmente com largura zero, o componente criava o retangulo da pagina, mas nao desenhava o canvas.

### Correcao

- `PdfRenderer` agora renderiza quando o PDF esta carregado, mesmo antes de medir largura positiva.
- A medicao de largura usa `clientWidth`, `getBoundingClientRect().width` e `window.innerWidth` como fallback.
- A logica de remover capa permanece restrita ao `fastpreview` opt-in; a aba PDF fiel nao deve remover `\capaCustomizada`.

## Correcao pos-Etapa 9: PDF Vazio no Preview

### Contexto

Um teste manual mostrou que o painel PDF podia receber um arquivo vazio e o pdf.js exibia:

```txt
The PDF file is empty, i.e. its size is zero bytes.
```

O backend considerava alguns caminhos de PDF como validos apenas porque o arquivo existia. Isso permitia reutilizar/copiar `output.pdf` vazio vindo de tentativa anterior ou artefato parcial.

### Correcao

- `latexCompiler.ts` agora valida PDF por tamanho e assinatura `%PDF-` antes de reutilizar cache em memoria, cache do manifest ou PDF encontrado no diretorio de compilacao.
- `src-tauri/src/lib.rs` recebeu a mesma validacao para manter equivalencia Tauri/Node.
- PDF vazio deixa de ser tratado como sucesso de compilacao.
- Testes focados foram adicionados para Node/Vite e Tauri.

### Validacao

```bash
npm run typecheck
npm run test -- src/infrastructure/latex-compiler/__tests__/latexCompilerPdfValidation.test.ts
cargo test
```

Tudo passou.

## Correcao pos-Etapa 9: Preview Sem Paginas

### Contexto

Depois da correcao de stubs decorativos, um documento cujo corpo continha apenas a capa final ficou efetivamente vazio no `pdf-preview`:

```tex
\begin{document}
\iffastpreview\else \capaCustomizada \fi
\end{document}
```

Com `\fastpreviewtrue`, o LaTeX executava com sucesso, mas emitia:

```txt
No pages of output.
```

Isso impedia a geracao de PDF renderizavel para o painel.

### Correcao

- `fastPreviewLatex.ts` agora detecta quando o corpo efetivo do `pdf-preview` ficaria sem conteudo renderizavel.
- Nesses casos, insere `\EditorLatexFastPreviewPlaceholder` logo apos `\begin{document}`.
- O placeholder gera uma pagina visivel com aviso explicito, para evitar que o viewer pareca renderizar uma pagina branca.
- O placeholder nao afeta `pdf-final`.
- O cache em memoria do preview passou a comparar o hash do TEX efetivo transformado, evitando reutilizar PDF antigo quando a transformacao `fastpreview` muda.
- Teste especifico foi adicionado em `fastPreviewLatex.test.ts`.

### Validacao

```bash
npm run test -- src/infrastructure/latex-compiler/__tests__/fastPreviewLatex.test.ts
npm run typecheck
npm run test
```

Tudo passou.

## Correcao pos-Etapa 9: Paths de Assets LaTeX

### Contexto

Um teste manual mostrou falha com assets importados de subdiretorio:

```txt
Arquivo nao encontrado: icone.png
Unable to load picture or PDF file 'icone.png'.
```

O ZIP tinha `main.tex` e imagens dentro de `Relatório_de_maturidade/`, mas o backend compila `main.preview.tex` na raiz de `compile/`. Com isso, referencias como:

```tex
\includegraphics{icone.png}
```

deixavam de resolver `Relatório_de_maturidade/icone.png`.

### Correcao

- `latexCompiler.ts` injeta `\graphicspath` com diretorios de assets do manifest e o diretorio do `mainTexPath`.
- `src-tauri/src/lib.rs` recebeu comportamento equivalente.
- A injeção ocorre antes de escrever o TEX efetivo em `source/` e `compile/`.
- Testes foram adicionados em TypeScript e Rust.

Exemplo:

```tex
\graphicspath{{Relatório_de_maturidade/}}
```

### Validacao

```bash
npm run test -- src/infrastructure/latex-compiler/__tests__/latexCompilerGraphicPath.test.ts
npm run typecheck
cargo test
```

Tudo passou.
