# Coding Standards

Leia tambem [AGENT_RULES.md](../AGENT_RULES.md) e [AI_CONTEXT.md](./AI_CONTEXT.md).

## TypeScript

- Use tipos compartilhados de `src/features/preview/types/compileTypes.ts`.
- Evite criar contratos paralelos para compilacao.
- Prefira funcoes puras para hash, manifest, sync e transformacao TEX.
- Nao use strings magicas quando ja existir tipo/constante local.
- Preserve compatibilidade temporaria com campos legados quando ja documentado.

## React

- Componentes de preview devem exibir estado, metricas e diagnostics, nao decidir cache.
- Evite computacoes pesadas no render.
- `objectUrl` deve ser revogado ao substituir/remover asset.
- Nao carregar todos os assets na memoria apenas para thumbnails.
- Lexical deve permanecer restrito a blocos textuais onde foi explicitamente integrado. Hoje isso significa apenas `Texto Livre`/`plain-text`.
- Componentes Lexical devem manter fallback plain text e nao substituir blocos estruturais.

## Store

- Evite estado derivado redundante.
- `binaryBase64` e temporario.
- `generatedTex` pode ser cacheado, mas deve respeitar `texDirty`.
- Metrics e diagnostics devem vir do `CompileResult`.
- Conteudo rico do `Texto Livre` usa `__lexicalJson`, mas o campo `text` deve continuar sendo atualizado com plain text para compatibilidade.

## Rust/Tauri

- Tauri e o backend final de compilacao e importacao persistente.
- Path de ZIP deve ser sanitizado contra traversal.
- Use structs serializaveis em camelCase para contratos com frontend.
- Modulos Rust devem continuar sendo extraidos de `lib.rs` quando crescerem.

## Nomes de Arquivos

- Preview TEX: `main.preview.tex`.
- Final TEX: `main.final.tex`.
- Preview PDF: `preview.pdf`.
- Final PDF: `final.pdf`.
- Manifest: `manifest.json`.

## Contratos Compartilhados

Qualquer alteracao em:

- `CompileRequest`
- `CompileResult`
- `CompileMetrics`
- `ProjectManifest`

deve ser refletida em Node/Vite, Tauri, UI e docs.

## Edicao Rica

- O conversor Lexical -> LaTeX deve ficar isolado em `src/utils/latex/lexicalToLatex.ts`.
- Escape caracteres especiais antes de inserir texto do usuario em comandos LaTeX.
- Nao permita que formatacao visual gere LaTeX bruto sem escape.
- Preview Visual deve renderizar o JSON rico quando existir e voltar para plain text quando nao existir.
- Nao remova a compatibilidade com documentos antigos sem uma etapa de migracao explicita.

## Duplicacao Node/Tauri

Evite logica duplicada divergente. Quando duplicacao for inevitavel:

- mantenha nomes equivalentes;
- adicione testes nos dois lados;
- documente diferencas em [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md).

## Comentarios

Comente apenas regras nao obvias: cache, seguranca de path, compatibilidade legada e heuristicas LaTeX.
