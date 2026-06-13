# Agent Docs Index

Este indice organiza os markdowns essenciais para agentes de IA. Use-o para reduzir contexto, evitar decisoes duplicadas e encontrar rapidamente a fonte de verdade de cada area.

## Entrada Obrigatoria

- [../AGENTS.md](../AGENTS.md): ponto de entrada padrao para agentes.
- [../AGENT_RULES.md](../AGENT_RULES.md): regras inviolaveis e validacao esperada.
- [AI_CONTEXT.md](./AI_CONTEXT.md): visao geral do produto, stack, fluxo e estado atual.

## Arquitetura e Pipeline

- [ARCHITECTURE.md](./ARCHITECTURE.md): frontend, store, Tauri, backend, PDF e diagramas.
- [COMPILATION_PIPELINE.md](./COMPILATION_PIPELINE.md): modos `html-preview`, `pdf-preview`, `pdf-final`, request/result, cache hit e timeline.
- [PROJECT_MANIFEST.md](./PROJECT_MANIFEST.md): `manifest.json`, ciclo de vida de arquivos e sync incremental.
- [CACHE_STRATEGY.md](./CACHE_STRATEGY.md): cache de TEX, PDF, assets, modo e URL.

## LaTeX, PDF e Performance

- [LATEX_TEMPLATE_RULES.md](./LATEX_TEMPLATE_RULES.md): regras para templates, `fastpreview`, capas, backgrounds e elementos caros.
- [PERFORMANCE_GUIDELINES.md](./PERFORMANCE_GUIDELINES.md): anti-patterns proibidos, metricas e gargalos confirmados.
- [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md): limitacoes atuais que nao devem ser tratadas como bugs novos sem confirmacao.

## Qualidade e Processo

- [TESTING_STRATEGY.md](./TESTING_STRATEGY.md): testes unitarios, integracao, benchmark e checklist antes de merge.
- [CODING_STANDARDS.md](./CODING_STANDARDS.md): padroes TypeScript, React, Rust, Tauri e contratos.
- [ROADMAP.md](./ROADMAP.md): etapas concluidas e proximas prioridades.
- [CHANGELOG_AI.md](./CHANGELOG_AI.md): historico tecnico das etapas e correcoes pos-etapa.

## Guias Operacionais Para Agentes

- [AGENT_ONBOARDING.md](./AGENT_ONBOARDING.md): como iniciar uma tarefa sem perder contexto.
- [AGENT_GUARDRAILS.md](./AGENT_GUARDRAILS.md): o que nao fazer, refazer, alterar ou excluir.
- [AGENT_TASK_CHECKLISTS.md](./AGENT_TASK_CHECKLISTS.md): checklists por tipo de tarefa.

## Mapa Rapido Por Tipo de Mudanca

| Mudanca               | Leia antes                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| Compilacao LaTeX      | `COMPILATION_PIPELINE.md`, `CACHE_STRATEGY.md`, `LATEX_TEMPLATE_RULES.md`, `PROJECT_MANIFEST.md` |
| Importacao ZIP/assets | `PROJECT_MANIFEST.md`, `PERFORMANCE_GUIDELINES.md`, `AGENT_GUARDRAILS.md`                        |
| PDF viewer            | `COMPILATION_PIPELINE.md`, `PERFORMANCE_GUIDELINES.md`, `KNOWN_LIMITATIONS.md`                   |
| Store/frontend        | `ARCHITECTURE.md`, `CODING_STANDARDS.md`, `AI_CONTEXT.md`                                        |
| Benchmark/performance | `PERFORMANCE_GUIDELINES.md`, `CHANGELOG_AI.md`, `ROADMAP.md`                                     |
| Docs apenas           | `AGENT_DOCS_INDEX.md`, `CHANGELOG_AI.md`, `ROADMAP.md`                                           |

## Regra de Conflito

Se documentacao e codigo divergirem:

1. Nao corrija automaticamente os dois ao mesmo tempo.
2. Identifique o conflito com arquivo e trecho.
3. Determine se a divergencia veio de mudanca recente nao documentada.
4. Corrija o codigo ou a documentacao conforme a tarefa.
5. Registre a decisao em `CHANGELOG_AI.md` quando for arquitetura/comportamento.
