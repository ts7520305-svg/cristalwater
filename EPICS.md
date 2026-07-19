# EPICS

## EPIC-001 - Technician OS
- Status: Concluído (100%)
- Objetivo: levar o Technician OS a 100% com arquitetura controller → business, sem alterar contratos públicos nem respostas JSON.
- Entregas: auth, portal, stats, visit, route, workday e GPS movidos para business modules; testes de regressão adicionados; relatório final produzido em TECHNICIAN_OS_REPORT.md.
- Validação: sintaxe executada com sucesso e npm test aprovado com 3 testes verdes.
- Revisão final: controllers avaliados como delegadores, business modules consolidados e JSON compatível.

## EPIC-002 - Pool OS
- Status: Em andamento / concluído para o escopo inicial de refatoração
- Objetivo: transformar o módulo Pool no Pool OS mantendo contratos públicos, respostas JSON e comportamento existente.
- Entregas: dashboard, equipment, chemistry, maintenance, history e visit movidos para business modules; controllers do módulo Pool reestruturados para delegação; testes de regressão adicionados; relatório produzido em POOL_OS_REPORT.md.
- Validação: sintaxe executada com sucesso e npm test aprovado com 7 testes verdes.

## EPIC-003 - Visit OS
- Status: Production Ready
- Objetivo: permitir que o técnico execute a visita completa, do arranque ao fecho, sem sair do fluxo operacional.
- Entregas: login do técnico, rota do dia, workday, visita, fotos, observações, incidentes, dashboard, histórico, notificações e audit trail validados em ambiente real.
- Validação: acceptance operacional concluído em 2026-07-05 com 5 clientes, 5 piscinas, 5 visitas, 6 notificações e 5 entradas de audit trail.

## EPIC-004 - Route OS
- Status: Production Ready
- Objetivo: otimizar e estabilizar a geração da rota diária do técnico sobre o dataset operacional real.
- Entregas: today route alinhado com o optimizador, cobertura determinística para datasets mistos, persistência e recuperação local da rota diária, sincronização idempotente de conclusões offline e contratos EventBus preservados.
- Validação: `node -c`, `npm test` e operational smoke test aprovados; Route OS acceptance report concluído em 2026-07-05.
