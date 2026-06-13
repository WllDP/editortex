# Testing Strategy

Leia tambem [CODING_STANDARDS.md](./CODING_STANDARDS.md) e [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md).

## Comandos Obrigatorios

Antes de merge em alteracoes de compilacao/cache/importacao:

```bash
npm run typecheck
npm run test
npm run lint
npm run build
cargo check
cargo test
```

Quando a mudanca tocar performance de template:

```bash
npm run perf:compile-template
```

## Unit Tests

Vitest cobre:

- geracao/parsing de documento;
- parser de logs LaTeX;
- manifest/sync;
- `fastPreviewLatex`.

Rust cobre:

- seguranca de path ZIP;
- deteccao de `main.tex`;
- classificacao de arquivos;
- injecao de `fastpreview`.

## Integration Tests

Devem validar:

- primeira compilacao escreve arquivos;
- segunda compilacao sem mudanca gera cache hit;
- asset novo e escrito;
- asset alterado e reescrito;
- asset removido e apagado;
- `.sty`, `.cls`, `.bib`, `.bst` entram no manifest;
- alteracao de TEX invalida cache;
- alteracao de asset invalida cache.

## Benchmark/Perf Tests

`npm run perf:compile-template` existe para validar fluxo com template real quando LaTeX local estiver disponivel. Se LaTeX nao existir no ambiente, documente o bloqueio no resultado da tarefa.

## Checklist Antes de Merge

- Contratos TypeScript continuam compatíveis.
- Node/Vite e Tauri continuam equivalentes ou a diferenca esta documentada.
- Nenhum `Date.now()` foi introduzido em cache key/URL.
- Nenhum base64 permanente foi reintroduzido.
- `pdf-preview` preserva auxiliares.
- `pdf-final` nao perde elementos visuais.
- `manifest.json` continua valido.
- Diagnostics de erro LaTeX ainda aparecem na UI.
- PDF viewer continua usando range/stream.
