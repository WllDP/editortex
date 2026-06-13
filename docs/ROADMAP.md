# Roadmap

Leia tambem [CHANGELOG_AI.md](./CHANGELOG_AI.md).

## Concluido

### Etapa 1

Diagnostico inicial do fluxo de TEX, compilacao, assets, PDF, cache e responsabilidades frontend/backend.

### Etapa 2

Contrato unico de compilacao, reuso de TEX, URL estavel, Tauri com caminho preview estavel, preservacao de auxiliares, pdf.js range/stream, objectUrl revogado e metricas iniciais.

### Etapa 3

Manifest persistente por projeto, diretorios persistentes, sync por delta, assets textuais no manifest, payload minimo e cache hit real.

### Etapa 4

Reducao de base64 no estado, asset sob demanda, parser de logs LaTeX, painel discreto de metricas e diagnostics na UI.

### Etapa 5

Importacao ZIP backend-first no Tauri, persistencia antes da primeira compilacao, seguranca contra Zip Slip e assets ja sincronizados.

### Etapa 6

`fastpreview` formal no preambulo, modos `pdf-preview`/`pdf-final`, outputs separados, cache por modo e metricas com `fastPreview`.

### Etapa 7

Benchmark runner e telemetria detalhada. A primeira medicao com ZIP real encontrou gargalo antes do LaTeX no transporte/timeout da chamada Vite com template grande.

### Etapa 8

Root cause analysis do pipeline. Resultado: o timeout dominante esta no round trip da requisicao Vite com payload JSON grande antes de manifest, sync ou LaTeX.

### Etapa 9

Remocao do payload JSON monolitico no fluxo Vite/dev. Resultado: `POST /api/import-project-zip` persiste o ZIP no backend dev e compilacoes usam `usePersistedProject=true` com request de ~310-314 bytes. O benchmark agora mede LaTeX/cache de fato.

## Proximas

### Etapa 10

Otimizacao orientada por benchmark da importacao persistente. Prioridade: reduzir `writeFilesMs` da importacao Vite/dev para ZIP grande sem reintroduzir base64 ou payload JSON monolitico.

### Synctex

Mapear clique no PDF para posicao no TEX/bloco e vice-versa.

### HTML Preview Avancado

Melhorar preview sem LaTeX para feedback imediato de layout.

### Diff Visual

Comparar PDFs entre revisoes para detectar regressao visual.

### Benchmark Automatizado

Criar suite com ZIPs reais, metricas historicas e thresholds.

### Preview Fiel

Modo de preview mais proximo do final, com tradeoff explicito de performance.
