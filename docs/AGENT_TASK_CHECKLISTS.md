# Agent Task Checklists

Checklists operacionais para agentes. Use antes de finalizar tarefas.

## Mudanca de Compilacao LaTeX

- [ ] Li `COMPILATION_PIPELINE.md`, `CACHE_STRATEGY.md` e `LATEX_TEMPLATE_RULES.md`.
- [ ] Preservei `pdf-preview` fiel por padrao.
- [ ] Nao removi auxiliares em preview.
- [ ] Mantive `preview.pdf` e `final.pdf` separados.
- [ ] Verifiquei cache hit e invalidacao.
- [ ] Atualizei Node/Vite e Tauri, ou documentei diferenca temporaria.
- [ ] Rodei testes TypeScript focados.
- [ ] Rodei `cargo check`/`cargo test` se toquei Rust.
- [ ] Atualizei docs e changelog se mudei comportamento.

## Mudanca de Importacao ZIP ou Assets

- [ ] Li `PROJECT_MANIFEST.md` e `PERFORMANCE_GUIDELINES.md`.
- [ ] Bloqueei path traversal.
- [ ] Mantive assets por hash.
- [ ] Nao reintroduzi base64 permanente.
- [ ] Mantive importacao persistente backend-first.
- [ ] Preservei `alreadySynced` quando backend confirma sync.
- [ ] Testei ZIP com assets e arquivos `.sty`, `.cls`, `.bib` quando aplicavel.

## Mudanca no PDF Viewer

- [ ] Li `COMPILATION_PIPELINE.md` e `KNOWN_LIMITATIONS.md`.
- [ ] Mantive range/stream loading.
- [ ] Nao forcei reload por timestamp.
- [ ] Verifiquei se pagina branca e problema de PDF ou de canvas.
- [ ] Mantive fallback de largura do container.
- [ ] Nao escondi erros do pdf.js.

## Mudanca de UI

- [ ] Preservei contraste em fundos claros e escuros.
- [ ] Evitei cards dentro de cards.
- [ ] Usei componentes/estilos existentes.
- [ ] Mantive metricas discretas.
- [ ] Nao movi decisao de cache/persistencia para UI.
- [ ] Rodei `npm run lint`.

## Mudanca de Performance/Benchmark

- [ ] Li benchmark atual em `benchmark-results/`.
- [ ] Medi antes de otimizar.
- [ ] Registrei tamanho de request, tempo total e gargalo dominante.
- [ ] Nao confundi importacao, sync, LaTeX e renderizacao PDF.
- [ ] Atualizei `PERFORMANCE_GUIDELINES.md` se confirmei gargalo.

## Mudanca Apenas em Documentacao

- [ ] Nao contradisse `AGENT_RULES.md`.
- [ ] Usei links cruzados em vez de duplicar conteudo grande.
- [ ] Indiquei fonte de verdade para cada area.
- [ ] Atualizei `AI_CONTEXT.md` se mudou onboarding/estado atual.
- [ ] Atualizei `CHANGELOG_AI.md` se registrei decisao tecnica nova.
