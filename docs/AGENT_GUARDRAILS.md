# Agent Guardrails

Este arquivo descreve o que agentes nao devem fazer, refazer, alterar ou excluir sem motivo tecnico claro e documentado.

## Nao Refazer

- Nao recriar o contrato `CompileRequest`/`CompileResult`; ele vive em `src/features/preview/types/compileTypes.ts`.
- Nao recriar uma estrategia paralela de cache fora de `manifest.json` e `lastCompiledByMode`.
- Nao substituir o sync por delta por escrita total de projeto.
- Nao voltar para `.preview.<revision>.tex` como nome de arquivo de preview.
- Nao reimplementar parser/importador ZIP sem reutilizar regras de path seguro, classificacao e main.tex.
- Nao recriar workaround de PDF por `Date.now()` ou reload forçado permanente.

## Nao Alterar Sem Atualizar Docs

- Semantica de `pdf-preview`, `pdf-final` ou `fastpreview`.
- Campos de `CompileRequest`, `CompileResult`, `CompileMetrics` ou manifest.
- Estrutura de diretorios persistentes.
- Estrategia de cache hit.
- Fluxo de importacao ZIP/assets.
- Comportamento do viewer PDF.
- Qualquer regra em `AGENT_RULES.md`.

## Nao Excluir

- `docs/CHANGELOG_AI.md`: historico de decisoes de agentes.
- `docs/ROADMAP.md`: priorizacao atual.
- `docs/PERFORMANCE_GUIDELINES.md`: anti-patterns e gargalos confirmados.
- Testes de regressao de compilacao, manifest, importacao, `fastpreview`, parser de logs ou PDF validation.
- Compatibilidade temporaria com campos legados enquanto o codigo ainda os aceita.

## Nao Fazer em Performance

- Nao otimizar LaTeX antes de medir o gargalo real.
- Nao tratar benchmark local como verdade universal sem registrar ambiente/limites.
- Nao reduzir fidelidade visual da aba PDF para ganhar performance sem controle explicito.
- Nao remover assets graficos do preview fiel.
- Nao aceitar cache hit se PDF nao existe, esta vazio ou nao tem header `%PDF-`.

## Nao Fazer em Frontend

- Nao manter `binaryBase64` de assets grandes no estado global apos importacao/sync.
- Nao fazer o frontend decidir persistencia real de arquivos.
- Nao carregar todos os assets em memoria para thumbnails se asset sob demanda resolve.
- Nao esconder erro LaTeX apenas no console; diagnostics devem chegar na UI.
- Nao adicionar UI ruidosa para metricas; manter discreta.

## Nao Fazer em Tauri/Rust

- Nao aceitar Zip Slip, paths absolutos ou drive letters em ZIP.
- Nao deixar comportamento Tauri divergir do Node/Vite sem documentar.
- Nao limpar auxiliares em preview.
- Nao misturar paths de assets, source, compile e output.
- Nao tratar falha de compilacao como sucesso por existir PDF antigo.

## Nao Fazer em Docs

- Nao apagar uma decisao antiga so porque a implementacao mudou; registre a mudanca como correcao ou nova etapa.
- Nao criar documentacao generica desconectada do codigo.
- Nao duplicar grandes blocos entre docs; use links cruzados.
- Nao declarar validacoes que nao foram executadas.

## Padrao Para Mudancas Arriscadas

1. Leia docs da area.
2. Liste risco e criterio de aceite.
3. Implemente incrementalmente.
4. Rode testes focados.
5. Rode validacoes amplas se tocar contratos/cache/Tauri.
6. Atualize `CHANGELOG_AI.md`.
7. Atualize o doc especifico da area.
