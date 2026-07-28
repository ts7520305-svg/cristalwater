# FCS - UI Reorganization Execution Brief (Post Functional Audit)

Data: 2026-07-26
Referência de auditoria: docs/product/FCS_UI_FUNCTIONAL_AUDIT_V1_20260726.md

## Missão
Reorganizar a interface do Cristal Water para maximizar clareza, velocidade e execução operacional, preservando 100% da funcionalidade existente.

## Escopo fechado
- Sem novas funcionalidades de produto.
- Sem alterações de regras de negócio.
- Sem remoção de capacidades operacionais críticas.
- Foco em UX, consolidação de módulos e simplificação de fluxos.

## Princípios obrigatórios
1. Centro Operacional do Técnico como experiência primária de campo.
2. Centro Operacional do Administrador como experiência primária de decisão.
3. Motor único de alertas e lembretes, com alertas persistentes e acionáveis.
4. Aprovação obrigatória para alterações à ficha técnica.
5. Consolidação de módulos redundantes em fluxos canónicos.
6. Técnico sem acesso a preços e informação financeira.
7. Documentos de viatura, seguros, fichas de segurança e manuais em tempo real.

## Macro arquitetura alvo
- Admin: /admin/operations-center
- Technician: /technician/operations-center
- Alerts: /alerts-center
- Communication: /communication-center
- Visits & Routing: /operations/visits
- Operational Map: /operations/map
- Team: /operations/team-center
- Client Ops: /operations/client-center
- Exceptions Workflow: /operations/exception-workflows
- Pool Record + Approval: /pool-record
- Finance Center (admin only): /admin/finance-center
- Inventory Center: /assets/inventory-center
- Fleet Center: /assets/fleet-center
- Insights Center: /control/insights-center
- Settings Center: /control/settings-center
- Customer Portal: /client/portal
- Technician Knowledge Center: /technician/knowledge-center

## Ordem de implementação recomendada
1. Congelar mapa canónico e aliases legados (somente redirects).
2. Implementar estrutura base dos dois centros operacionais (admin e técnico).
3. Migrar e unificar alertas/notificações/lembretes no motor único.
4. Consolidar área financeira num único centro, com bloqueio técnico.
5. Consolidar ficha técnica e implantar fluxo de aprovação.
6. Consolidar mapas/visitas/equipa e eliminar dashboards duplicados.
7. Consolidar portal do cliente numa experiência única premium.
8. Desativar gradualmente rotas redundantes, mantendo telemetria de uso.

## Critérios de aceite por fase
- Todas as tarefas diárias em no máximo 2 cliques/toques.
- Cada workflow com rota canónica única.
- Alertas críticos visíveis acima da dobra e com ação direta.
- Sem regressão funcional em rotas ativas.
- Sem exposição de dados financeiros ao perfil técnico.
- Disponibilidade em tempo real de documentação operacional.

## Gates de qualidade
- Gate funcional: paridade 100% com rotas atuais.
- Gate UX: redução de duplicação de ecrãs e complexidade de navegação.
- Gate visual: manter baseline de FCS visual e melhorar cards/header/spacing/loading/empty states.
- Gate segurança de papéis: validação estrita por perfil.

## Entregáveis mínimos
1. Mapa de rotas canónicas e aliases de compatibilidade.
2. Matriz de migração por rota (origem -> destino).
3. Lista de páginas fundidas/divididas/retiradas com racional.
4. Plano de rollout progressivo com rollback simples por rota.
5. Relatório de validação final com checklist funcional por perfil.

## Nota operacional
A execução deve seguir estritamente a auditoria funcional aprovada em docs/product/FCS_UI_FUNCTIONAL_AUDIT_V1_20260726.md.
