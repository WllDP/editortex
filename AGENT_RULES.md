# Agent Rules

Este arquivo e leitura obrigatoria antes de qualquer alteracao no EditorLatex. Ele define regras operacionais para Codex, Claude Code, Cursor Agent, GPT Coding Agents e agentes similares.

Ponto de entrada recomendado para agentes: [AGENTS.md](./AGENTS.md).

## Regras Inviolaveis

- Nunca reintroduzir `binaryBase64` permanente no estado global.
- Nunca usar `Date.now()` como cache key ou cache buster de PDF.
- Toda alteracao de compilacao deve preservar cache hit real.
- Node/Vite e Tauri devem permanecer funcionalmente equivalentes.
- Tauri e a arquitetura final para importacao persistente e compilacao local.
- `pdf-preview` deve preservar auxiliares LaTeX.
- A aba PDF deve ser fiel ao PDF exportavel por padrao; nao ativar `fastpreview` nesse caminho sem controle explicito do usuario.
- `pdf-final` nao deve perder fidelidade visual.
- Preview e final devem usar outputs separados.
- Assets devem ser sincronizados por hash.
- Frontend nao deve decidir persistencia real de arquivos.

## Contratos Fonte de Verdade

- Tipos de compilacao: `src/features/preview/types/compileTypes.ts`.
- Manifest Node/Vite: `src/infrastructure/latex-compiler/projectManifest.ts`.
- Compilador Node/Vite: `src/infrastructure/latex-compiler/latexCompiler.ts`.
- Backend Tauri: `src-tauri/src/lib.rs`.
- PDF viewer: `src/features/preview/lib/pdfRenderer.tsx`.

## Antes de Implementar

1. Leia `docs/AI_CONTEXT.md`.
2. Leia o documento especifico da area tocada.
3. Verifique se ha regra em `docs/PERFORMANCE_GUIDELINES.md`.
4. Preserve compatibilidade com campos legados quando o codigo ainda usar.
5. Planeje testes antes do patch.

## Ao Alterar Compilacao

- Atualize `CompileMetrics` se adicionar nova metrica.
- Atualize Node/Vite e Tauri.
- Atualize `manifest.json` sem quebrar manifests antigos.
- Mantenha `sourceHash` deterministico.
- Nao use revisao no nome do `.tex` de preview.
- Nao apague auxiliares no preview.
- Atualize `docs/CHANGELOG_AI.md` e `docs/ROADMAP.md`.

## Ao Alterar Importacao/Assets

- ZIP no Tauri deve ser backend-first.
- Bloqueie path traversal.
- Nao carregue todos os assets na memoria do frontend sem necessidade.
- Nao enviar ZIP/assets grandes como JSON monolitico para `/api/compile-preview`; use importacao persistente e `usePersistedProject`.
- `objectUrl` antigo deve ser revogado.
- Assets importados pelo Tauri devem chegar como `alreadySynced: true`.

## Ao Alterar UI

- UI deve mostrar diagnostics e metricas, nao tomar decisoes de cache.
- Evite paineis ruidosos.
- Nao bloquear preview por warnings.
- Mantenha feedback de erro LaTeX util e compacto.

## Validacao Esperada

Para mudancas relevantes:

```bash
npm run typecheck
npm run test
npm run lint
npm run build
cargo check
cargo test
```

Se nao puder executar algum comando, registre explicitamente o motivo na resposta final.

## Documentacao

Qualquer nova feature arquitetural deve atualizar:

- `docs/CHANGELOG_AI.md`
- `docs/ROADMAP.md`
- documento especifico da area alterada
- este arquivo, se a regra operacional mudar
