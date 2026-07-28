# FCS-1.3 - Create Client Desktop Diagnostic

Data: 2026-07-22T06:23:29.078Z
Run: FCS13DIAG_1784701261832_4o2zaz

## menu-click

- URL inicial: about:blank
- URL após login: http://127.0.0.1:3002/login
- URL após landing: http://127.0.0.1:3002/admin-master-control
- Seletor clicado: a[href='/admin-clients']
- Erro de clique: locator.click: Timeout 10000ms exceeded.
Call log:
[2m  - waiting for locator('a[href=\'/admin-clients\']').first()[22m
[2m    - locator resolved to <a href="/admin-clients" data-shell-search="Clientes">Clientes</a>[22m
[2m  - attempting click action[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is not visible[22m
[2m    - retrying click action[22m
[2m    - waiting 20ms[22m
[2m    - waiting for element to be visible, enabled and stable[22m

- Erro de navegação direta: (nenhum)
- Screenshot landing: docs/product/evidence/fcs13-create-client-diagnostic/FCS13DIAG_1784701261832_4o2zaz-menu-click-landing.png
- Screenshot final: docs/product/evidence/fcs13-create-client-diagnostic/FCS13DIAG_1784701261832_4o2zaz-menu-click-final.png

| Momento | URL | readyState | clientForm presente | clientForm visível | #name presente | link visível | pendentes | SW controller |
|---|---|---|---|---|---|---|---:|---|
| after-landing | http://127.0.0.1:3002/admin-master-control | interactive | NAO | NAO | NAO | NAO | 27 | NAO |
| immediate-after-click | http://127.0.0.1:3002/admin-master-control | snapshot-timeout | NAO | NAO | NAO | NAO | 2 | NAO |
| after-1s | http://127.0.0.1:3002/admin-master-control | snapshot-timeout | NAO | NAO | NAO | NAO | 2 | NAO |
| after-3s | http://127.0.0.1:3002/admin-master-control | snapshot-timeout | NAO | NAO | NAO | NAO | 2 | NAO |
| after-10s | http://127.0.0.1:3002/admin-master-control | snapshot-timeout | NAO | NAO | NAO | NAO | 2 | NAO |

## direct-route

- URL inicial: about:blank
- URL após login: http://127.0.0.1:3002/login
- URL após landing: http://127.0.0.1:3002/admin-master-control
- Seletor clicado: (n/a)
- Erro de clique: (nenhum)
- Erro de navegação direta: page.goto: Timeout 30000ms exceeded.
Call log:
[2m  - navigating to "http://127.0.0.1:3002/admin-clients", waiting until "commit"[22m

- Screenshot landing: docs/product/evidence/fcs13-create-client-diagnostic/FCS13DIAG_1784701261832_4o2zaz-direct-route-landing.png
- Screenshot final: docs/product/evidence/fcs13-create-client-diagnostic/FCS13DIAG_1784701261832_4o2zaz-direct-route-final.png

| Momento | URL | readyState | clientForm presente | clientForm visível | #name presente | link visível | pendentes | SW controller |
|---|---|---|---|---|---|---|---:|---|
| after-landing | http://127.0.0.1:3002/admin-master-control | interactive | NAO | NAO | NAO | NAO | 15 | NAO |
| immediate-after-direct-goto | http://127.0.0.1:3002/admin-master-control | snapshot-timeout | NAO | NAO | NAO | NAO | 1 | NAO |
| after-1s | http://127.0.0.1:3002/admin-master-control | snapshot-timeout | NAO | NAO | NAO | NAO | 1 | NAO |
| after-3s | http://127.0.0.1:3002/admin-master-control | snapshot-timeout | NAO | NAO | NAO | NAO | 1 | NAO |
| after-10s | http://127.0.0.1:3002/admin-master-control | snapshot-timeout | NAO | NAO | NAO | NAO | 1 | NAO |
