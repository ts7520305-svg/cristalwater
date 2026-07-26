# FCS-1 Gate 0 - Decisao Arquitetural do Frontend

Data: 2026-07-21
Estado: APROVADO

## Frontend oficial (referencia de consolidacao)
- Shell: `crystal-os-v2-shell.js`
- Navegacao: `crystal-os-v2-nav.js`
- Menu Admin: `admin-menu.html`
- Dashboard operacional: `admin-master-control.html`

## Legado (fora da arquitetura oficial)
- `nav.js`
- `cw-enterprise-sidebar.js`
- `cw-flow-shell.js`
- `cw-os-admin-shell.js`

## Regra de classificacao durante FCS-1.1
- Todo item do inventario deve ser classificado em relacao ao frontend oficial:
  - Manter
  - Migrar
  - Remover

## Gate de avanco
- FCS-1.1 so pode fechar quando:
  - Gate 0 = verde (este documento aprovado)
  - Gate 1 = verde (checklist binario do inventario em 10/10)
