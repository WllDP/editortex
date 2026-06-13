# EditorLatex Benchmark

Projeto: overleaf-main.zip
Status: ok
Gerado em: 2026-06-11T20:31:25.782Z

## Tabela

| Modo                       | Sucesso | Cache | Request MB | Import bytes | Compile bytes | ZIP read | ZIP extract | Asset hash | Serialize |  Request | Manifest | Asset sync |  LaTeX | PDF read |    Total |
| -------------------------- | ------: | ----: | ---------: | -----------: | ------------: | -------: | ----------: | ---------: | --------: | -------: | -------: | ---------: | -----: | -------: | -------: |
| Importacao ZIP persistente |     Sim |   Nao |       49.6 |     51964708 |             - |    103.9 |       403.2 |      550.2 |         - | 102111.4 |        - |          - |      - |        - | 101765.1 |
| Preview rapido             |     Sim |   Nao |        0.0 |            - |           314 |        - |           - |          - |       0.0 |   8501.9 |     26.3 |        0.0 | 7134.7 |      0.6 |   7710.5 |
| Preview rapido 2a vez      |     Sim |   Sim |        0.0 |            - |           314 |        - |           - |          - |       0.2 |     24.4 |     11.6 |        0.0 |    0.0 |      0.6 |     17.1 |
| Preview final              |     Sim |   Nao |        0.0 |            - |           310 |        - |           - |          - |       0.0 |   8142.7 |     15.1 |        0.0 | 7441.1 |      0.8 |   7486.3 |
| Preview final 2a vez       |     Sim |   Sim |        0.0 |            - |           310 |        - |           - |          - |       0.0 |    107.5 |     17.0 |        0.0 |    0.0 |      0.6 |     34.4 |

## Compile Timeline

### Importacao ZIP persistente

zip_read..............103.9ms
zip_extract...........403.2ms
zip_classify..........91.3ms
main_tex_detection....123.3ms
asset_hash............550.2ms
request_round_trip....102111.4ms
manifest_save.........64.0ms
write_files...........100608.4ms

### Preview rapido

request_serialize.....0.0ms
request_round_trip....8501.9ms
manifest_load.........26.3ms
manifest_save.........17.3ms
write_files...........155.5ms
latex.................7134.7ms
pdf_read..............0.6ms

### Preview rapido 2a vez

request_serialize.....0.2ms
request_round_trip....24.4ms
manifest_load.........11.6ms
pdf_read..............0.6ms

### Preview final

request_serialize.....0.0ms
request_round_trip....8142.7ms
manifest_load.........15.1ms
manifest_save.........16.9ms
write_files...........4.7ms
latex.................7441.1ms
pdf_read..............0.8ms

### Preview final 2a vez

request_serialize.....0.0ms
request_round_trip....107.5ms
manifest_load.........17.0ms
manifest_save.........27.5ms
write_files...........0.1ms
pdf_read..............0.6ms

## Grafico Textual

- Importacao ZIP persistente: zip_read .................... 0%; zip_extract .................... 0%; zip_classify .................... 0%; main_tex_detection .................... 0%; asset_hash .................... 1%; manifest_save .................... 0%; write_files #################### 99%; other .................... 0%
- Preview rapido: manifest_load .................... 0%; manifest_save .................... 0%; write_files .................... 2%; latex ###################. 93%; pdf_read .................... 0%; other #................... 5%
- Preview rapido 2a vez: manifest_load ##############...... 68%; pdf_read #................... 4%; other ######.............. 28%
- Preview final: manifest_load .................... 0%; manifest_save .................... 0%; write_files .................... 0%; latex #################### 99%; pdf_read .................... 0%; other .................... 0%
- Preview final 2a vez: manifest_load ########............ 38%; manifest_save ############........ 61%; write_files .................... 0%; pdf_read .................... 1%; other .................... 0%

## Health Check

- Cache funcionando: sim
- Manifest funcionando: sim
- FastPreview funcionando: sim
- Maior gargalo: latex
- Causa do timeout: none

## Warnings

- WARNING: write_files consumes 99% of measured pipeline time.
- WARNING: latex consumes 93% of measured pipeline time.
- WARNING: manifest_load consumes 68% of measured pipeline time.
- WARNING: latex consumes 99% of measured pipeline time.
- WARNING: manifest_save consumes 61% of measured pipeline time.

## Conclusoes Automaticas

- Cache hit reduziu o tempo do preview rapido em aproximadamente 100%.
- Maior gargalo observado: latex.
- Causa mais provavel do timeout: none.
