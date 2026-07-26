# FCS-1.4 - Admin Service Log Semantic Check

Data: 2026-07-26T20:46:38.603Z
Run: FCS14ADM_1785098793449_g93j8
Pagina: /admin-service-log

| Cenario | PASS | Screenshot | Console | API inesperados |
|---|---|---|---:|---:|
| loading-delayed | PASS | docs/product/evidence/fcs14-admin-service-log/FCS14ADM_1785098793449_g93j8-loading-delayed.png | 1 | 0 |
| empty | PASS | docs/product/evidence/fcs14-admin-service-log/FCS14ADM_1785098793449_g93j8-empty.png | 1 | 0 |
| data | PASS | docs/product/evidence/fcs14-admin-service-log/FCS14ADM_1785098793449_g93j8-data.png | 3 | 0 |
| error | PASS | docs/product/evidence/fcs14-admin-service-log/FCS14ADM_1785098793449_g93j8-error.png | 2 | 0 |

## loading-delayed

| Seletor observado | Texto encontrado | Estado esperado | Estado observado | PASS/FAIL |
|---|---|---|---|---|
| #services | A carregar registos... | Loading visivel com texto de carregamento | Loading correto | PASS |
| #timeline | A carregar timeline... | Loading visivel com texto de carregamento | Loading correto | PASS |
| #services + #timeline | A carregar registos... \| A carregar timeline... | Sem empty state prematuro antes da resposta | Sem flicker prematuro | PASS |
| #services | Sem servicos registados para estes filtros. | Empty state apos resposta vazia | Empty correto | PASS |
| #timeline | Sem eventos na timeline para estes filtros. | Timeline vazia apos resposta vazia | Empty correto | PASS |

- Screenshot: docs/product/evidence/fcs14-admin-service-log/FCS14ADM_1785098793449_g93j8-loading-delayed.png
- Console lines: 1
- Page errors: 0
- API 4xx/5xx esperados: 0
- API 4xx/5xx inesperados: 0

## empty

| Seletor observado | Texto encontrado | Estado esperado | Estado observado | PASS/FAIL |
|---|---|---|---|---|
| #services | Sem servicos registados para estes filtros. | Empty state com lista vazia | Empty correto | PASS |
| #timeline | Sem eventos na timeline para estes filtros. | Timeline vazia com lista vazia | Empty correto | PASS |

- Screenshot: docs/product/evidence/fcs14-admin-service-log/FCS14ADM_1785098793449_g93j8-empty.png
- Console lines: 1
- Page errors: 0
- API 4xx/5xx esperados: 0
- API 4xx/5xx inesperados: 0

## data

| Seletor observado | Texto encontrado | Estado esperado | Estado observado | PASS/FAIL |
|---|---|---|---|---|
| #services .service .service-title | Piscina QA | Registo renderizado com dados | Dados renderizados | PASS |
| #timeline .timeline-item strong | Posicao capturada | Timeline renderizada com dados | Dados renderizados | PASS |
| #services .empty | 0 | Empty state desaparece quando ha dados | Empty removido | PASS |

- Screenshot: docs/product/evidence/fcs14-admin-service-log/FCS14ADM_1785098793449_g93j8-data.png
- Console lines: 3
- Page errors: 0
- API 4xx/5xx esperados: 0
- API 4xx/5xx inesperados: 0

## error

| Seletor observado | Texto encontrado | Estado esperado | Estado observado | PASS/FAIL |
|---|---|---|---|---|
| #services | Falha simulada no registo diario. | Mensagem de erro apos resposta 500 | Erro mostrado | PASS |
| #timeline | Nao foi possivel carregar a timeline. | Timeline mostra indisponibilidade e nao empty de dados | Erro mostrado | PASS |

- Screenshot: docs/product/evidence/fcs14-admin-service-log/FCS14ADM_1785098793449_g93j8-error.png
- Console lines: 2
- Page errors: 0
- API 4xx/5xx esperados: 1
- API 4xx/5xx inesperados: 0
