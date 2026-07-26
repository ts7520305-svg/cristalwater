# FCS-1.4 - Validacao Semantica de Estados UX

Data: 2026-07-22T05:42:19.100Z
Aprovacao global: PASS

## Superficies validadas
| Superficie | Rota | Loading atrasado | Empty | Data | Error | Resultado |
|---|---|---|---|---|---|---|
| Admin | /admin-service-log | PASS | PASS | PASS | PASS | PASS |
| Technician | /technician-route | PASS | PASS | PASS | PASS | PASS |
| Client | /client-payments | PASS | PASS | PASS | PASS | PASS |

## Evidencia por cenario
| Superficie | Cenario | PASS | Screenshot | Console | API 4xx/5xx esperados | API 4xx/5xx inesperados |
|---|---|---|---|---:|---:|---:|
| Admin | loading-delayed | PASS | docs/product/evidence/fcs14-admin-service-log/FCS14ADM_1784698647555_hbewr-loading-delayed.png | 1 | 0 | 0 |
| Admin | empty | PASS | docs/product/evidence/fcs14-admin-service-log/FCS14ADM_1784698647555_hbewr-empty.png | 1 | 0 | 0 |
| Admin | data | PASS | docs/product/evidence/fcs14-admin-service-log/FCS14ADM_1784698647555_hbewr-data.png | 4 | 0 | 0 |
| Admin | error | PASS | docs/product/evidence/fcs14-admin-service-log/FCS14ADM_1784698647555_hbewr-error.png | 2 | 1 | 0 |
| Technician | loading-delayed | PASS | docs/product/evidence/fcs14-technician-route/FCS14TECH_1784698861367_nnfu0-loading-delayed.png | 1 | 0 | 0 |
| Technician | empty | PASS | docs/product/evidence/fcs14-technician-route/FCS14TECH_1784698861367_nnfu0-empty.png | 1 | 0 | 0 |
| Technician | data | PASS | docs/product/evidence/fcs14-technician-route/FCS14TECH_1784698861367_nnfu0-data.png | 1 | 0 | 0 |
| Technician | error | PASS | docs/product/evidence/fcs14-technician-route/FCS14TECH_1784698861367_nnfu0-error.png | 2 | 1 | 0 |
| Client | loading-delayed | PASS | docs/product/evidence/fcs14-client-payments/FCS14CLIENT_1784698827815_pauii-loading-delayed.png | 1 | 0 | 0 |
| Client | empty | PASS | docs/product/evidence/fcs14-client-payments/FCS14CLIENT_1784698827815_pauii-empty.png | 1 | 0 | 0 |
| Client | data | PASS | docs/product/evidence/fcs14-client-payments/FCS14CLIENT_1784698827815_pauii-data.png | 1 | 0 | 0 |
| Client | error | PASS | docs/product/evidence/fcs14-client-payments/FCS14CLIENT_1784698827815_pauii-error.png | 1 | 1 | 0 |