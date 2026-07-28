# GROUP3_SCOPE_MAPPING

Data: 2026-07-20
Fase ativa: 3.3.2 - Migracao controlada do Grupo 3
Estado: REVALIDADO

## Regras canonicas aplicadas
- Freeze ativo dos Grupos 1 e 2.
- Nao alterar paginas certificadas por preferencia visual.
- Reparacoes mantidas como FUNCAO DISTRIBUIDA.
- `admin-alerts.html` e `admin-alerts.js` ficam como referencia funcional nesta fase.
- Nao criar centro novo de reparacoes.
- Nao iniciar Grupo 4.

## Paginas congeladas (nao alterar)
- `admin-dashboard.html`
- `admin-today.html`
- `admin-alerts.html`
- `admin-payments.html`
- `admin-inventory.html`
- `admin-clients.html`
- `admin-pools.html`
- `admin-technicians.html`
- `admin-rounds.html`

## Evidencia de atividade
- Rotas frontend confirmadas no indice: `frontend/crystal-os-v2-route-index.html`.
- Navegacao operacional confirmada em: `frontend/admin-menu.html` e `frontend/admin-master-control.html`.
- Escopo de reparacoes distribuido confirmado por: `docs/product/GROUP3_REPAIRS_CANONICAL_MAPPING.md`.

## PASSO 1 - Tabela final de escopo
| Conceito | Pagina | Ativa | Legacy | Congelada | Acao |
|---|---|---|---|---|---|
| Visitas | admin-visits.html | SIM | NAO | NAO | MIGRAR |
| Visitas | admin-visits.js | SIM | NAO | NAO | MIGRAR |
| Visitas | admin-visits-dashboard.html | SIM | PARCIAL | NAO | MIGRAR |
| Visitas | admin-visits-dashboard.js | SIM | PARCIAL | NAO | MIGRAR |
| Visitas | technician-visit.html | SIM | NAO | NAO | MIGRAR |
| Visitas | technician-visit.js | SIM | NAO | NAO | MIGRAR |
| Reparacoes | admin-alerts.html | SIM | NAO | SIM | NAO ALTERAR |
| Reparacoes | admin-alerts.js | SIM | NAO | SIM | APENAS VALIDAR |
| Reparacoes | technician-field-mode.html | SIM | PARCIAL | NAO | MIGRAR |
| Reparacoes | technician-field-mode.js | SIM | PARCIAL | NAO | MIGRAR |
| Reparacoes | technician-visit.html | SIM | NAO | NAO | MIGRAR |
| Reparacoes | technician-visit.js | SIM | NAO | NAO | MIGRAR |
| Reparacoes | admin-pool-technical.html | SIM | PARCIAL | NAO | MIGRAR |
| Reparacoes | admin-pool-technical.js | SIM | PARCIAL | NAO | MIGRAR |
| Reparacoes | admin-master-control.html | SIM | PARCIAL | NAO | APENAS VALIDAR |
| Guias | technician-guide.html | SIM | PARCIAL | NAO | MIGRAR |
| Guias | technician-guide.js | SIM | PARCIAL | NAO | MIGRAR |
| Guias | admin-vehicles.html | SIM | PARCIAL | NAO | APENAS VALIDAR |
| Guias | admin-vehicles.js | SIM | PARCIAL | NAO | APENAS VALIDAR |
| Chaves | admin-keys.html | SIM | PARCIAL | NAO | MIGRAR |
| Chaves | admin-keys.js | SIM | PARCIAL | NAO | MIGRAR |
| Viaturas | admin-vehicles.html | SIM | PARCIAL | NAO | MIGRAR |
| Viaturas | admin-vehicles.js | SIM | PARCIAL | NAO | MIGRAR |
| Armazem | admin-inventory.html | SIM | NAO | SIM | NAO ALTERAR |
| Armazem | admin-inventory.js | SIM | NAO | SIM | APENAS VALIDAR |
| Armazem | admin-vehicles.html (stock viatura) | SIM | PARCIAL | NAO | DOCUMENTAR COMO DISTRIBUIDA |
| Armazem | technician-guide.html (movimentos) | SIM | PARCIAL | NAO | DOCUMENTAR COMO DISTRIBUIDA |
| Armazem | admin-warehouse.* | NAO | SIM | NAO | EXCLUIR POR LEGACY |
| Armazem | warehouse-* / stock-* dedicados | NAO | SIM | NAO | EXCLUIR POR LEGACY |

## Decisao de escopo
- Grupo 3 segue ativo sem abrir paginas novas.
- Reparacoes e Armazem permanecem com trilho distribuido.
- Qualquer pagina congelada fica fora de migracao, exceto bug real comprovado.

## Ordem de execucao (3.3.2)
1. Visitas Admin
2. Visita Tecnico
3. Modo Campo Tecnico
4. Contexto tecnico da piscina / Reparacoes
5. Guias
6. Chaves
7. Viaturas
8. Armazem nao congelado (somente se houver superficie real adicional)

## Estado atual
- Passo 1 concluido: escopo final revalidado com tabela de acao.
- Passo 2.1 concluido: Visitas Admin (migracao visual em `admin-visits-dashboard.html` e validacao de `admin-visits.html`).
- Passo 2.2 concluido: Visita Tecnico validada (`technician-visit.html`).
- Passo 2.3 concluido: Modo Campo Tecnico validado (`technician-field-mode.html`).
- Passo 2.4 concluido: Contexto tecnico da piscina/reparacoes migrado (`admin-pool-technical.html`) e `admin-pool-technical.js` validado.
- Passo 2.5 concluido: Guias migrado (`technician-guide.html`) e `technician-guide.js` validado.
- Passo 2.6 concluido: Chaves migrado (`admin-keys.html`) e `admin-keys.js` validado.
- Passo 2.7 concluido: Viaturas migrado (`admin-vehicles.html`) e `admin-vehicles.js` validado.
- Passo 2.8 concluido: Armazem nao congelado revalidado. Nao existe superficie dedicada adicional (`admin-warehouse.*`, `warehouse-*`, `stock-*`); funcao permanece distribuida em `admin-vehicles.*` e `technician-guide.*` com `admin-inventory.*` congelado.
- Estado da fase 3.3.2: EXECUCAO CONCLUIDA, pronto para auditoria de aceitacao do Grupo 3.
