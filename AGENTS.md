# AGENTS.md

Arquivo de entrada para agentes de IA trabalhando no EditorLatex.

Leia este arquivo antes de alterar codigo. Ele resume o que deve ser lido, o que nao deve ser refeito e quais regras protegem a arquitetura atual.

## Ordem de Leitura

Para qualquer tarefa relevante, leia nesta ordem:

1. [AGENT_RULES.md](./AGENT_RULES.md)
2. [docs/AI_CONTEXT.md](./docs/AI_CONTEXT.md)
3. [docs/AGENT_DOCS_INDEX.md](./docs/AGENT_DOCS_INDEX.md)
4. Documento especifico da area tocada:
   - compilacao: [docs/COMPILATION_PIPELINE.md](./docs/COMPILATION_PIPELINE.md)
   - cache: [docs/CACHE_STRATEGY.md](./docs/CACHE_STRATEGY.md)
   - manifest/assets: [docs/PROJECT_MANIFEST.md](./docs/PROJECT_MANIFEST.md)
   - templates LaTeX: [docs/LATEX_TEMPLATE_RULES.md](./docs/LATEX_TEMPLATE_RULES.md)
   - performance: [docs/PERFORMANCE_GUIDELINES.md](./docs/PERFORMANCE_GUIDELINES.md)
   - testes: [docs/TESTING_STRATEGY.md](./docs/TESTING_STRATEGY.md)
5. Historico recente: [docs/CHANGELOG_AI.md](./docs/CHANGELOG_AI.md)

## Regra Principal

Nao otimize ou reestruture por intuicao. O projeto ja passou por etapas de diagnostico, cache, manifest, importacao persistente, telemetria e benchmark. Use a documentacao e os dados existentes antes de alterar arquitetura.

## Nao Fazer

- Nao reintroduzir `binaryBase64` permanente no estado global.
- Nao usar `Date.now()` como cache key ou cache buster de PDF.
- Nao transformar a aba PDF fiel em `fastpreview` sem controle explicito do usuario.
- Nao apagar auxiliares LaTeX no modo preview.
- Nao misturar `preview.pdf` e `final.pdf`.
- Nao enviar ZIP/assets grandes como JSON monolitico para `/api/compile-preview`.
- Nao duplicar logica Node/Vite e Tauri sem documentar diferencas.
- Nao remover manifest/cache para "simplificar" uma correcao.
- Nao alterar ou excluir docs historicos sem preservar a decisao original em `CHANGELOG_AI.md`.

## Estado Arquitetural Atual

- Tauri e a arquitetura final para importacao persistente e compilacao local.
- Node/Vite deve continuar funcional para desenvolvimento e benchmark.
- O projeto usa `CompileRequest`/`CompileResult` em `src/features/preview/types/compileTypes.ts`.
- Projetos importados persistem em estrutura `source/`, `assets/`, `compile/`, `output/` e `manifest.json`.
- Assets sao controlados por hash e sincronizados por delta.
- A aba PDF e fiel por padrao: `previewQuality=faithful` e `\fastpreviewfalse`.
- `fastpreview` existe como otimizacao opt-in, nao como comportamento padrao da aba PDF.
- pdf.js deve renderizar com range/stream loading e fallback de largura no viewer.

## Antes de Editar

1. Verifique se a tarefa toca frontend, store, compilacao, Tauri, importacao, PDF viewer ou docs.
2. Leia o documento especifico dessa area.
3. Procure testes existentes antes de criar comportamento novo.
4. Planeje a menor alteracao que preserve cache, manifest e compatibilidade.
5. Atualize docs quando alterar regra, contrato, pipeline ou decisao arquitetural.

## Depois de Editar

Valide de acordo com o risco:

- Mudanca simples de UI/docs: `npm run lint` e, se houver TypeScript tocado, `npm run typecheck`.
- Mudanca TS funcional: `npm run typecheck`, `npm run test`, `npm run lint`.
- Mudanca de compilacao/importacao/Tauri: comandos TS acima mais `cargo check` e `cargo test`.
- Mudanca de build ou integração: incluir `npm run build`.

Registre no resultado final o que foi validado e o que nao foi possivel validar.
