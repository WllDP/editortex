# AI Context

Este é o primeiro arquivo que um agente de IA deve ler ao trabalhar no EditorLatex. Ele resume o produto, a arquitetura atual e as decisões que nao devem ser redescobertas em cada etapa.

## Indice

- [Architecture](./ARCHITECTURE.md)
- [Compilation Pipeline](./COMPILATION_PIPELINE.md)
- [Latex Template Rules](./LATEX_TEMPLATE_RULES.md)
- [Performance Guidelines](./PERFORMANCE_GUIDELINES.md)
- [Project Manifest](./PROJECT_MANIFEST.md)
- [Cache Strategy](./CACHE_STRATEGY.md)
- [Testing Strategy](./TESTING_STRATEGY.md)
- [Coding Standards](./CODING_STANDARDS.md)
- [Known Limitations](./KNOWN_LIMITATIONS.md)
- [Roadmap](./ROADMAP.md)
- [AI Changelog](./CHANGELOG_AI.md)
- [Agent Rules](../AGENT_RULES.md)
- [Agent Entry Point](../AGENTS.md)
- [Agent Docs Index](./AGENT_DOCS_INDEX.md)
- [Agent Onboarding](./AGENT_ONBOARDING.md)
- [Agent Guardrails](./AGENT_GUARDRAILS.md)
- [Agent Task Checklists](./AGENT_TASK_CHECKLISTS.md)

## Visao Geral

EditorLatex e um app desktop/editor visual de documentos LaTeX baseado em blocos. O usuario monta o documento visualmente, o app gera um `.tex`, compila para PDF e mostra o preview. A direcao do produto e oferecer uma experiencia semelhante ao Overleaf, mas otimizada para desktop, cache persistente e edicao estruturada por blocos.

## Stack Tecnologica

- Frontend: React 18, TypeScript, Vite, Zustand.
- Edicao rica: Lexical apenas em blocos textuais `Texto Livre`.
- Desktop/backend: Tauri 2 com Rust.
- PDF: `pdfjs-dist`.
- Importacao ZIP no browser/dev: JSZip.
- Importacao ZIP no desktop: comando Tauri com crate Rust `zip`.
- Testes: Vitest para TypeScript, `cargo test` para Rust.
- Build: `npm run build`, `cargo check`, `tauri`.

## Arquitetura Atual

O frontend controla a edicao visual, a store, a geracao do TEX e o envio de um contrato de compilacao. O backend Node/Vite e o backend Tauri recebem `CompileRequest`, sincronizam assets por hash, persistem `manifest.json`, compilam LaTeX quando necessario e retornam `CompileResult`.

O Tauri e a arquitetura final para compilacao local. O Node/Vite existe para desenvolvimento no navegador e deve continuar funcionalmente equivalente sempre que possivel.

## Fluxo de Edicao

1. O usuario edita blocos no editor visual.
2. A store marca o TEX como dirty.
3. `ensureGeneratedTex` reutiliza `preview.generatedTex` quando `texDirty === false`.
4. Se dirty, o sistema chama `generateLatexDocument`.
5. O preview HTML pode usar o TEX atual sem compilar PDF.
6. A compilacao PDF chama `compileLatexPreview`.

## Fluxo de Compilacao

1. `pdfPreviewService.ts` monta `CompileRequest`.
2. `CompileRequest` inclui `projectKey`, `mode`, `revision`, `sourceHash`, `tex`, `assetManifest` e, apenas quando necessario, `assets`.
3. O backend carrega ou cria `manifest.json`.
4. O backend sincroniza arquivos por delta.
5. O backend aplica modo de compilacao:
   - `pdf-preview`: `main.preview.tex`, `\fastpreviewfalse` por padrao na aba PDF, cache de auxiliares preservado.
   - `pdf-preview` com `previewQuality=fast`: `\fastpreviewtrue` e heuristicas de reducao.
   - `pdf-final`: `main.final.tex`, `\fastpreviewfalse`, saida final separada.
6. Se houver cache hit real, o backend retorna PDF existente sem chamar LaTeX.
7. Se necessario, executa LaTeX e atualiza manifest, metricas e diagnostics.
8. O frontend renderiza PDF via pdf.js com range/stream loading.

## Estado Atual

Etapas concluidas:

- Etapa 1: diagnostico inicial.
- Etapa 2: contrato unico, cache buster estavel e preservacao de auxiliares.
- Etapa 3: manifest persistente e sync por delta.
- Etapa 4: diagnostics, metricas e reducao de base64 no estado.
- Etapa 5: importacao ZIP backend-first no Tauri.
- Etapa 6: `fastpreview`, cache por modo e outputs separados.
- Etapa 7: benchmark runner e telemetria detalhada.
- Etapa 8: root cause analysis do pipeline de compilacao.
- Etapa 9: importacao persistente no Vite/dev e compilacao com payload leve.

Pipeline atual:

- Manifest persistente.
- Cache incremental.
- FastPreview.
- Telemetria com `syncMs`, `writeFilesMs`, `latexMs`, `pdfReadMs`, `pageCount` e `totalMs`.
- Telemetria de RCA com `zipReadMs`, `zipExtractMs`, `assetHashMs`, `requestSerializeMs`, `requestRoundTripMs`, `manifestLoadMs`, `assetSyncMs` e `manifestSaveMs`.
- Benchmark runner em `npm run benchmark:latex`.
- Fluxo Vite/dev com `POST /api/import-project-zip` e `usePersistedProject=true`.
- Editor rico incremental no bloco `Texto Livre`, mantendo `text` plain como fallback.
- Preview Visual resolve fonte do template importado a partir do LaTeX quando houver declaracao detectavel.

## Decisoes Implementadas nas Etapas 1-9

- O contrato compartilhado vive em `src/features/preview/types/compileTypes.ts`.
- `Date.now()` nao e usado como cache buster de PDF.
- A URL do PDF e estavel por `revision` e `sourceHash`.
- TEX gerado e reutilizado quando `texDirty === false`.
- Assets sao controlados por hash e manifest.
- `binaryBase64` nao deve permanecer no estado global apos importacao/sync.
- Tauri importa ZIP diretamente e persiste projeto antes da primeira compilacao.
- `manifest.json` e a fonte de verdade persistente por projeto.
- `pdf-preview` preserva auxiliares; `pdf-final` pode limpar artefatos se necessario.
- Preview e final usam arquivos e PDFs separados.
- `fastpreview` e formalizado com `\newif\iffastpreview`.
- Logs LaTeX sao convertidos em diagnostics estruturados quando possivel.
- UI mostra metricas discretas de compilacao/cache.
- Benchmark real gera `benchmark-results/editorlatex-benchmark.json` e `.md`.
- A primeira execucao real com `overleaf-main.zip` confirmou gargalo antes da compilacao LaTeX: chamada Vite/JSON com template grande expirou antes de produzir metricas de LaTeX.
- A root cause analysis da Etapa 8 mediu o gargalo dominante como `request_round_trip` para o backend Vite: request JSON de aproximadamente 96.7 MB aguardou cerca de 20 s e expirou antes de manifest, sync ou LaTeX.
- A Etapa 9 removeu o payload JSON monolitico do benchmark/fluxo Vite: o ZIP e importado por `application/octet-stream`, o projeto e persistido no backend dev e a compilacao usa `usePersistedProject=true`.
- Benchmark atualizado com `overleaf-main.zip`: request de importacao ~49.6 MB; request de compilacao ~310-314 bytes; `assetsPayloadCount=0`; cache hit de preview em ~17 ms; cache hit final em ~34 ms.
- Gargalos confirmados apos Etapa 9: importacao inicial ainda e dominada por escrita/leitura de arquivos persistidos; compilacoes sem cache sao dominadas por LaTeX.
- Correcao pos-Etapa 9: `fastpreview` agora substitui definicoes decorativas inteiras por stubs seguros no `pdf-preview`, como `\providecommand{\capaCustomizada}{}` e `\providecommand{\PaginaFinalImagem}[1]{}`. Nao deixar corpos decorativos parcialmente ativos.
- Correcao pos-Etapa 9: cache/preview de PDF agora rejeita `output.pdf` vazio ou sem assinatura `%PDF-` no Node/Vite e no Tauri. Existencia do arquivo nao e suficiente para sucesso de compilacao.
- Correcao pos-Etapa 9: se o corpo efetivo do `pdf-preview` ficar sem paginas apos aplicar `fastpreview`, o transformador insere `\EditorLatexFastPreviewPlaceholder`. O preview deve sempre produzir PDF renderizavel e visualmente explicito; `No pages of output` ou pagina branca silenciosa sao tratados como bug de fallback.
- Correcao pos-Etapa 9: Node/Vite e Tauri injetam `\graphicspath` a partir do manifest e do `mainTexPath` para preservar referencias como `\includegraphics{icone.png}` quando o projeto importado veio de subdiretorio.
- Correcao pos-Etapa 9: pagina branca no viewer fiel pode ser falha de renderizacao React/pdf.js, nao do LaTeX. `PdfRenderer` nao deve bloquear renderizacao quando `viewportWidth` ainda e zero.
- Edicao rica: `Texto Livre` pode conter JSON Lexical em `__lexicalJson`; outros blocos nao devem usar Lexical. O pipeline deve preservar `text` plain e usar `lexicalJsonToLatex` apenas quando o JSON existir.
- Preview Visual: fonte nao deve ficar hardcoded. Use `resolveLatexPreviewFontFamily` para ler `\setmainfont`, `\setsansfont`, `\newfontfamily` ou pacotes conhecidos como `montserrat`. Montserrat esta embutida no app via `@fontsource/montserrat`.
- Preview Visual: fundos de capitulo devem ser extraidos do LaTeX com `resolveLatexPreviewLayout`, por exemplo macro `\ChapterBackground` usada por `\pretocmd{\chapter}`.

## Diretorios Principais

- `src/domain/latex`: geracao de TEX a partir de blocos.
- `src/store`: Zustand store, slices e estado de preview/template/assets.
- `src/features/preview`: UI e servicos de preview PDF.
- `src/features/editor/components`: editor visual de blocos e componentes Lexical do `Texto Livre`.
- `src/features/template-upload`: importacao de templates/ZIP no frontend.
- `src/infrastructure/latex-compiler`: backend Node/Vite de compilacao, manifest, cache e diagnostics.
- `src-tauri/src`: backend Tauri em Rust.
- `scripts`: scripts operacionais, incluindo benchmark/perf de template.
- `docs`: documentacao operacional para agentes.

## Glossario

- `CompileRequest`: contrato enviado pelo frontend ao backend para compilar.
- `CompileResult`: contrato retornado pelo backend.
- `projectKey`: identificador estavel do projeto no cache/persistencia.
- `revision`: revisao do documento no frontend.
- `sourceHash`: hash estavel do TEX e manifest de assets.
- `assetManifest`: lista de assets com path, hash, size e metadata.
- `assets`: payload temporario de arquivos novos/alterados.
- `usePersistedProject`: instrui o backend a compilar a partir do projeto ja importado/persistido, sem reenviar TEX/assets em base64.
- `manifest.json`: estado persistente do projeto no backend.
- `pdf-preview`: compilacao do painel PDF; fiel por padrao, com `\fastpreviewfalse`.
- `previewQuality=fast`: preview rapido opt-in, com `\fastpreviewtrue`.
- `pdf-final`: compilacao fiel/final, com `\fastpreviewfalse`.
- `fastpreview`: flag LaTeX usada por templates para desativar elementos caros no preview.
- `cache hit`: retorno de PDF existente sem reexecutar LaTeX.
- `__lexicalJson`: campo interno serializado do Lexical para formatacao rica do bloco `Texto Livre`.
- `previewFontFamily`: familia CSS resolvida a partir das declaracoes de fonte do LaTeX importado para o preview Visual.
