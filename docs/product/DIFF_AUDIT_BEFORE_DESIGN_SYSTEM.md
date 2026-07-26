# FASE 3.0 - AUDITORIA COMPLETA DOS DIFFS ANTES DA MIGRACAO DO DESIGN SYSTEM

## Escopo e restricoes
- Modo: somente auditoria (read-only funcional).
- Sem implementacao adicional, sem push, sem tag, sem schema change.
- Base de analise: git diff, git status, inventario consolidado e evidencias em docs/product/evidence.

## 1) Inventario completo de diffs
- Total de ficheiros alterados: 137
- Tracked modificados: 94
- Untracked (novos): 43
- Tipos: Seguranca=1, Visual=94, Funcional=2, Documentacao=40, Outro=0

## 2) Criterio de classificacao por ficheiro
- Razao da alteracao
- Problema que resolve
- Tipo (Seguranca, Visual, Funcional, Documentacao)
- Perfil afetado
- Compatibilidade com DS (Sim, Parcial, N/A)
- Risco de regressao (Baixo, Medio)
- Decisao (MANTER, ADAPTAR, SUBSTITUIR, REVERTER)
- Dependencias relevantes
- Conflitos detectados
- Prontidao de migracao

## 3) Mapa de dependencias por ficheiro
- Backend autorizado: src/routes/coreFlowRoutes.js depende de authMiddleware, roleMatches e businesses de visita.
- Frontend HTML: cada pagina injeta design-system.css e design-system.js alem dos assets locais.
- Frontend CSS legado: depende de ordem de cascata e tokens/componentes compartilhados.
- Scripts de validacao visual: dependem de Playwright e paginas HTML do frontend.
- Documentacao/evidencias: dependem dos artefatos em docs/product/evidence.

## 4) Conflitos e riscos consolidados
- Sobreposicoes potenciais de CSS identificadas: 37
- Basenames CSS duplicados: 2 (enterprise-ui.css, tokens.css)
- Componentes potencialmente duplicados: 1 (button.css vs buttons.css)
- Paginas legadas candidatas a conflito de shell/redirect: 6
- Total de conflitos contabilizados para governanca: 46
- Ficheiros com regressao possivel (risco Medio): 7

## 5) Prontidao para migracao DS
- Paginas HTML prontas para DS (com injecao e sem flag de legado): 87
- Paginas legadas que exigem adaptacao previa: 6
- Conclusao de prontidao: migracao 3.1 pode iniciar por ondas, preservando freeze em ficheiros ADAPTAR.

## 6) Tabela de decisao final (resumo)
| Metrica | Valor |
|---|---:|
| Total alterados | 137 |
| MANTER | 131 |
| ADAPTAR | 6 |
| SUBSTITUIR | 0 |
| REVERTER | 0 |
| Conflitos | 46 |
| Possiveis regressos | 7 |
| Componentes duplicados | 1 |
| Paginas legadas | 6 |
| Paginas prontas DS | 87 |

## 7) Matriz completa por ficheiro
| Ficheiro | Razao | Problema resolvido | Tipo | Perfil afetado | Compativel DS | Regressao | Decisao | Dependencias | Conflitos | Prontidao |
|---|---|---|---|---|---|---|---|---|---|---|
| docs/product/DESIGN_SYSTEM_REPORT.md | Novo ficheiro adicionado nesta fase | Registra evidencia, rastreabilidade e governanca | Documentacao | Engenharia | Sim | Baixo | MANTER | evidencias em docs/product/evidence; comandos git diff/status | Nao identificado | Pronto |
| docs/product/evidence/design-system/chromium/1024x1366/admin.png | Novo ficheiro adicionado nesta fase | Registra evidencia, rastreabilidade e governanca | Documentacao | Admin | Sim | Baixo | MANTER | evidencias em docs/product/evidence; comandos git diff/status | Nao identificado | Pronto |
| docs/product/evidence/design-system/chromium/1024x1366/client.png | Novo ficheiro adicionado nesta fase | Registra evidencia, rastreabilidade e governanca | Documentacao | Engenharia | Sim | Baixo | MANTER | evidencias em docs/product/evidence; comandos git diff/status | Nao identificado | Pronto |
| docs/product/evidence/design-system/chromium/1024x1366/technician.png | Novo ficheiro adicionado nesta fase | Registra evidencia, rastreabilidade e governanca | Documentacao | Tecnico | Sim | Baixo | MANTER | evidencias em docs/product/evidence; comandos git diff/status | Nao identificado | Pronto |
| docs/product/evidence/design-system/chromium/1280x800/admin.png | Novo ficheiro adicionado nesta fase | Registra evidencia, rastreabilidade e governanca | Documentacao | Admin | Sim | Baixo | MANTER | evidencias em docs/product/evidence; comandos git diff/status | Nao identificado | Pronto |
| docs/product/evidence/design-system/chromium/1280x800/client.png | Novo ficheiro adicionado nesta fase | Registra evidencia, rastreabilidade e governanca | Documentacao | Engenharia | Sim | Baixo | MANTER | evidencias em docs/product/evidence; comandos git diff/status | Nao identificado | Pronto |
| docs/product/evidence/design-system/chromium/1280x800/technician.png | Novo ficheiro adicionado nesta fase | Registra evidencia, rastreabilidade e governanca | Documentacao | Tecnico | Sim | Baixo | MANTER | evidencias em docs/product/evidence; comandos git diff/status | Nao identificado | Pronto |
| docs/product/evidence/design-system/chromium/1440x900/admin.png | Novo ficheiro adicionado nesta fase | Registra evidencia, rastreabilidade e governanca | Documentacao | Admin | Sim | Baixo | MANTER | evidencias em docs/product/evidence; comandos git diff/status | Nao identificado | Pronto |
| docs/product/evidence/design-system/chromium/1440x900/client.png | Novo ficheiro adicionado nesta fase | Registra evidencia, rastreabilidade e governanca | Documentacao | Engenharia | Sim | Baixo | MANTER | evidencias em docs/product/evidence; comandos git diff/status | Nao identificado | Pronto |
| docs/product/evidence/design-system/chromium/1440x900/technician.png | Novo ficheiro adicionado nesta fase | Registra evidencia, rastreabilidade e governanca | Documentacao | Tecnico | Sim | Baixo | MANTER | evidencias em docs/product/evidence; comandos git diff/status | Nao identificado | Pronto |
| docs/product/evidence/design-system/chromium/1920x1080/admin.png | Novo ficheiro adicionado nesta fase | Registra evidencia, rastreabilidade e governanca | Documentacao | Admin | Sim | Baixo | MANTER | evidencias em docs/product/evidence; comandos git diff/status | Nao identificado | Pronto |
| docs/product/evidence/design-system/chromium/1920x1080/client.png | Novo ficheiro adicionado nesta fase | Registra evidencia, rastreabilidade e governanca | Documentacao | Engenharia | Sim | Baixo | MANTER | evidencias em docs/product/evidence; comandos git diff/status | Nao identificado | Pronto |
| docs/product/evidence/design-system/chromium/1920x1080/technician.png | Novo ficheiro adicionado nesta fase | Registra evidencia, rastreabilidade e governanca | Documentacao | Tecnico | Sim | Baixo | MANTER | evidencias em docs/product/evidence; comandos git diff/status | Nao identificado | Pronto |
| docs/product/evidence/design-system/chromium/320x740/admin.png | Novo ficheiro adicionado nesta fase | Registra evidencia, rastreabilidade e governanca | Documentacao | Admin | Sim | Baixo | MANTER | evidencias em docs/product/evidence; comandos git diff/status | Nao identificado | Pronto |
| docs/product/evidence/design-system/chromium/320x740/client.png | Novo ficheiro adicionado nesta fase | Registra evidencia, rastreabilidade e governanca | Documentacao | Engenharia | Sim | Baixo | MANTER | evidencias em docs/product/evidence; comandos git diff/status | Nao identificado | Pronto |
| docs/product/evidence/design-system/chromium/320x740/technician.png | Novo ficheiro adicionado nesta fase | Registra evidencia, rastreabilidade e governanca | Documentacao | Tecnico | Sim | Baixo | MANTER | evidencias em docs/product/evidence; comandos git diff/status | Nao identificado | Pronto |
| docs/product/evidence/design-system/chromium/360x780/admin.png | Novo ficheiro adicionado nesta fase | Registra evidencia, rastreabilidade e governanca | Documentacao | Admin | Sim | Baixo | MANTER | evidencias em docs/product/evidence; comandos git diff/status | Nao identificado | Pronto |
| docs/product/evidence/design-system/chromium/360x780/client.png | Novo ficheiro adicionado nesta fase | Registra evidencia, rastreabilidade e governanca | Documentacao | Engenharia | Sim | Baixo | MANTER | evidencias em docs/product/evidence; comandos git diff/status | Nao identificado | Pronto |
| docs/product/evidence/design-system/chromium/360x780/technician.png | Novo ficheiro adicionado nesta fase | Registra evidencia, rastreabilidade e governanca | Documentacao | Tecnico | Sim | Baixo | MANTER | evidencias em docs/product/evidence; comandos git diff/status | Nao identificado | Pronto |
| docs/product/evidence/design-system/chromium/375x812/admin.png | Novo ficheiro adicionado nesta fase | Registra evidencia, rastreabilidade e governanca | Documentacao | Admin | Sim | Baixo | MANTER | evidencias em docs/product/evidence; comandos git diff/status | Nao identificado | Pronto |
| docs/product/evidence/design-system/chromium/375x812/client.png | Novo ficheiro adicionado nesta fase | Registra evidencia, rastreabilidade e governanca | Documentacao | Engenharia | Sim | Baixo | MANTER | evidencias em docs/product/evidence; comandos git diff/status | Nao identificado | Pronto |
| docs/product/evidence/design-system/chromium/375x812/technician.png | Novo ficheiro adicionado nesta fase | Registra evidencia, rastreabilidade e governanca | Documentacao | Tecnico | Sim | Baixo | MANTER | evidencias em docs/product/evidence; comandos git diff/status | Nao identificado | Pronto |
| docs/product/evidence/design-system/chromium/390x844/admin.png | Novo ficheiro adicionado nesta fase | Registra evidencia, rastreabilidade e governanca | Documentacao | Admin | Sim | Baixo | MANTER | evidencias em docs/product/evidence; comandos git diff/status | Nao identificado | Pronto |
| docs/product/evidence/design-system/chromium/390x844/client.png | Novo ficheiro adicionado nesta fase | Registra evidencia, rastreabilidade e governanca | Documentacao | Engenharia | Sim | Baixo | MANTER | evidencias em docs/product/evidence; comandos git diff/status | Nao identificado | Pronto |
| docs/product/evidence/design-system/chromium/390x844/technician.png | Novo ficheiro adicionado nesta fase | Registra evidencia, rastreabilidade e governanca | Documentacao | Tecnico | Sim | Baixo | MANTER | evidencias em docs/product/evidence; comandos git diff/status | Nao identificado | Pronto |
| docs/product/evidence/design-system/chromium/414x896/admin.png | Novo ficheiro adicionado nesta fase | Registra evidencia, rastreabilidade e governanca | Documentacao | Admin | Sim | Baixo | MANTER | evidencias em docs/product/evidence; comandos git diff/status | Nao identificado | Pronto |
| docs/product/evidence/design-system/chromium/414x896/client.png | Novo ficheiro adicionado nesta fase | Registra evidencia, rastreabilidade e governanca | Documentacao | Engenharia | Sim | Baixo | MANTER | evidencias em docs/product/evidence; comandos git diff/status | Nao identificado | Pronto |
| docs/product/evidence/design-system/chromium/414x896/technician.png | Novo ficheiro adicionado nesta fase | Registra evidencia, rastreabilidade e governanca | Documentacao | Tecnico | Sim | Baixo | MANTER | evidencias em docs/product/evidence; comandos git diff/status | Nao identificado | Pronto |
| docs/product/evidence/design-system/chromium/430x932/admin.png | Novo ficheiro adicionado nesta fase | Registra evidencia, rastreabilidade e governanca | Documentacao | Admin | Sim | Baixo | MANTER | evidencias em docs/product/evidence; comandos git diff/status | Nao identificado | Pronto |
| docs/product/evidence/design-system/chromium/430x932/client.png | Novo ficheiro adicionado nesta fase | Registra evidencia, rastreabilidade e governanca | Documentacao | Engenharia | Sim | Baixo | MANTER | evidencias em docs/product/evidence; comandos git diff/status | Nao identificado | Pronto |
| docs/product/evidence/design-system/chromium/430x932/technician.png | Novo ficheiro adicionado nesta fase | Registra evidencia, rastreabilidade e governanca | Documentacao | Tecnico | Sim | Baixo | MANTER | evidencias em docs/product/evidence; comandos git diff/status | Nao identificado | Pronto |
| docs/product/evidence/design-system/chromium/768x1024/admin.png | Novo ficheiro adicionado nesta fase | Registra evidencia, rastreabilidade e governanca | Documentacao | Admin | Sim | Baixo | MANTER | evidencias em docs/product/evidence; comandos git diff/status | Nao identificado | Pronto |
| docs/product/evidence/design-system/chromium/768x1024/client.png | Novo ficheiro adicionado nesta fase | Registra evidencia, rastreabilidade e governanca | Documentacao | Engenharia | Sim | Baixo | MANTER | evidencias em docs/product/evidence; comandos git diff/status | Nao identificado | Pronto |
| docs/product/evidence/design-system/chromium/768x1024/technician.png | Novo ficheiro adicionado nesta fase | Registra evidencia, rastreabilidade e governanca | Documentacao | Tecnico | Sim | Baixo | MANTER | evidencias em docs/product/evidence; comandos git diff/status | Nao identificado | Pronto |
| docs/product/evidence/design-system/summary.json | Novo ficheiro adicionado nesta fase | Registra evidencia, rastreabilidade e governanca | Documentacao | Engenharia | Sim | Baixo | MANTER | evidencias em docs/product/evidence; comandos git diff/status | Nao identificado | Pronto |
| docs/product/evidence/diff-audit-samples.json | Novo ficheiro adicionado nesta fase | Registra evidencia, rastreabilidade e governanca | Documentacao | Engenharia | Sim | Baixo | MANTER | evidencias em docs/product/evidence; comandos git diff/status | Nao identificado | Pronto |
| docs/product/FINAL_COMPLETION_AUDIT.md | Novo ficheiro adicionado nesta fase | Registra evidencia, rastreabilidade e governanca | Documentacao | Engenharia | Sim | Baixo | MANTER | evidencias em docs/product/evidence; comandos git diff/status | Nao identificado | Pronto |
| docs/product/P0_TECHNICIAN_VISIT_FIX.md | Novo ficheiro adicionado nesta fase | Registra evidencia, rastreabilidade e governanca | Documentacao | Engenharia | Sim | Baixo | MANTER | evidencias em docs/product/evidence; comandos git diff/status | Nao identificado | Pronto |
| docs/product/RC1_BUG_TRACKER.md | Novo ficheiro adicionado nesta fase | Registra evidencia, rastreabilidade e governanca | Documentacao | Engenharia | Sim | Baixo | MANTER | evidencias em docs/product/evidence; comandos git diff/status | Nao identificado | Pronto |
| docs/product/UI_UX_VALIDATION_REPORT.md | Novo ficheiro adicionado nesta fase | Registra evidencia, rastreabilidade e governanca | Documentacao | Engenharia | Sim | Baixo | MANTER | evidencias em docs/product/evidence; comandos git diff/status | Nao identificado | Pronto |
| frontend/admin-ai.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Admin | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/admin-alerts.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Admin | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/admin-client-settings.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Admin | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/admin-clients.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Admin | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/admin-collection.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Admin | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/admin-command-center.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Admin | Parcial | Medio | ADAPTAR | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Sim: pagina legado/redirect com shell antigo | Parcial: requer alinhamento de fluxo legado |
| frontend/admin-company-closures.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Admin | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/admin-core-flow.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Admin | Parcial | Medio | ADAPTAR | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Sim: pagina legado/redirect com shell antigo | Parcial: requer alinhamento de fluxo legado |
| frontend/admin-crm.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Admin | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/admin-dashboard.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Admin | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/admin-email-logs.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Admin | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/admin-inventory.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Admin | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/admin-keys.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Admin | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/admin-live-map.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Admin | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/admin-login.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Admin | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/admin-map.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Admin | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/admin-master-control.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Admin | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/admin-menu.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Admin | Parcial | Medio | ADAPTAR | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Sim: pagina legado/redirect com shell antigo | Parcial: requer alinhamento de fluxo legado |
| frontend/admin-notifications.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Admin | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/admin-onboarding.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Admin | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/admin-operational-flow.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Admin | Parcial | Medio | ADAPTAR | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Sim: pagina legado/redirect com shell antigo | Parcial: requer alinhamento de fluxo legado |
| frontend/admin-operational-settings.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Admin | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/admin-payment-settings.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Admin | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/admin-payments.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Admin | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/admin-pool-calculator.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Admin | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/admin-pool-technical.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Admin | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/admin-pools.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Admin | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/admin-priority.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Admin | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/admin-reports.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Admin | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/admin-rounds.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Admin | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/admin-security.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Admin | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/admin-service-log.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Admin | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/admin-suppliers.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Admin | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/admin-technicians.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Tecnico | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/admin-test-center.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Admin | Parcial | Medio | ADAPTAR | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Sim: pagina legado/redirect com shell antigo | Parcial: requer alinhamento de fluxo legado |
| frontend/admin-today.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Admin | Parcial | Medio | ADAPTAR | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Sim: pagina legado/redirect com shell antigo | Parcial: requer alinhamento de fluxo legado |
| frontend/admin-ui-settings.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Admin | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/admin-vehicles.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Admin | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/admin-visits-dashboard.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Admin | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/admin-visits.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Admin | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/alerts-financial.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Todos os perfis | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/alerts.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Todos os perfis | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/billing-center.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Todos os perfis | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/billing-extras.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Todos os perfis | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/billing-history.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Todos os perfis | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/billing.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Todos os perfis | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/chat.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Todos os perfis | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/client_chat.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Todos os perfis | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/client_tech.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Todos os perfis | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/client-dashboard.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Todos os perfis | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/client-history.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Todos os perfis | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/client-login.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Todos os perfis | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/client-menu.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Todos os perfis | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/client-notifications.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Todos os perfis | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/client-payments.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Todos os perfis | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/client-portal.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Todos os perfis | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/client-wow.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Todos os perfis | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/client.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Todos os perfis | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/communications.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Todos os perfis | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/config-notifications.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Todos os perfis | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/crystal-os-v2-route-index.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Todos os perfis | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/dashboard.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Todos os perfis | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/help-center.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Todos os perfis | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/incident-center.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Todos os perfis | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/invoices.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Todos os perfis | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/login.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Todos os perfis | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/map.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Todos os perfis | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/metrics.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Todos os perfis | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/multi-map.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Todos os perfis | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/notifications.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Todos os perfis | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/operational-dashboard.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Todos os perfis | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/profit-map.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Todos os perfis | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/ranking.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Todos os perfis | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/report-center.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Todos os perfis | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/report-settings.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Todos os perfis | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/route-map.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Todos os perfis | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/settings.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Todos os perfis | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/splash.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Todos os perfis | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/technician-chat.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Tecnico | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/technician-field-mode.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Tecnico | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/technician-gps.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Tecnico | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/technician-guide.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Tecnico | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/technician-history.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Tecnico | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/technician-login.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Tecnico | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/technician-map.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Tecnico | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/technician-new-client.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Tecnico | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/technician-profile.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Tecnico | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/technician-profit-dashboard.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Tecnico | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/technician-profit.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Tecnico | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/technician-route.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Tecnico | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/technician-visit.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Tecnico | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/technician.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Tecnico | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/to-issue.html | Injecao DS global (2 linhas: css + js) | Padroniza base visual para migracao progressiva DS | Visual | Todos os perfis | Sim | Baixo | MANTER | frontend/ui/design-system.css; frontend/ui/design-system.js; assets locais da pagina | Nao identificado | Pronto |
| frontend/ui/design-system.css | Novo ficheiro adicionado nesta fase | Define camada transversal de consistencia visual | Visual | Todos os perfis | Sim | Baixo | MANTER | frontend/ui/tokens.css; frontend/ui/components/*.css | Nao identificado | Pronto |
| frontend/ui/design-system.js | Novo ficheiro adicionado nesta fase | Define camada transversal de consistencia visual | Funcional | Todos os perfis | Sim | Baixo | MANTER | frontend/ui/design-system.css; scripts visuais | Nao identificado | Pronto |
| scripts/run-design-system-visual-tests.js | Novo ficheiro adicionado nesta fase | Automatiza captura/validacao visual multi-resolucao | Funcional | Todos os perfis | Sim | Baixo | MANTER | playwright; frontend/**/*.html; docs/product/evidence/design-system | Nao identificado | Pronto |
| src/routes/coreFlowRoutes.js | Ajuste de autorizacao para fluxo tecnico (problem/complete) | Desbloqueia fluxo principal do tecnico com ownership check | Seguranca | Tecnico, Admin, Operacao | N/A | Medio | MANTER | src/middlewares/authMiddleware.js; src/utils/roles.js; RepairBusiness; completeServiceVisit | Nao identificado | Pronto (fora do escopo visual DS) |

## 8) Tabela final requerida
| Ficheiro | Tipo | Compativel DS | Regressao | Decisao |
|---|---|---|---|---|
| docs/product/DESIGN_SYSTEM_REPORT.md | Documentacao | Sim | Baixo | MANTER |
| docs/product/evidence/design-system/chromium/1024x1366/admin.png | Documentacao | Sim | Baixo | MANTER |
| docs/product/evidence/design-system/chromium/1024x1366/client.png | Documentacao | Sim | Baixo | MANTER |
| docs/product/evidence/design-system/chromium/1024x1366/technician.png | Documentacao | Sim | Baixo | MANTER |
| docs/product/evidence/design-system/chromium/1280x800/admin.png | Documentacao | Sim | Baixo | MANTER |
| docs/product/evidence/design-system/chromium/1280x800/client.png | Documentacao | Sim | Baixo | MANTER |
| docs/product/evidence/design-system/chromium/1280x800/technician.png | Documentacao | Sim | Baixo | MANTER |
| docs/product/evidence/design-system/chromium/1440x900/admin.png | Documentacao | Sim | Baixo | MANTER |
| docs/product/evidence/design-system/chromium/1440x900/client.png | Documentacao | Sim | Baixo | MANTER |
| docs/product/evidence/design-system/chromium/1440x900/technician.png | Documentacao | Sim | Baixo | MANTER |
| docs/product/evidence/design-system/chromium/1920x1080/admin.png | Documentacao | Sim | Baixo | MANTER |
| docs/product/evidence/design-system/chromium/1920x1080/client.png | Documentacao | Sim | Baixo | MANTER |
| docs/product/evidence/design-system/chromium/1920x1080/technician.png | Documentacao | Sim | Baixo | MANTER |
| docs/product/evidence/design-system/chromium/320x740/admin.png | Documentacao | Sim | Baixo | MANTER |
| docs/product/evidence/design-system/chromium/320x740/client.png | Documentacao | Sim | Baixo | MANTER |
| docs/product/evidence/design-system/chromium/320x740/technician.png | Documentacao | Sim | Baixo | MANTER |
| docs/product/evidence/design-system/chromium/360x780/admin.png | Documentacao | Sim | Baixo | MANTER |
| docs/product/evidence/design-system/chromium/360x780/client.png | Documentacao | Sim | Baixo | MANTER |
| docs/product/evidence/design-system/chromium/360x780/technician.png | Documentacao | Sim | Baixo | MANTER |
| docs/product/evidence/design-system/chromium/375x812/admin.png | Documentacao | Sim | Baixo | MANTER |
| docs/product/evidence/design-system/chromium/375x812/client.png | Documentacao | Sim | Baixo | MANTER |
| docs/product/evidence/design-system/chromium/375x812/technician.png | Documentacao | Sim | Baixo | MANTER |
| docs/product/evidence/design-system/chromium/390x844/admin.png | Documentacao | Sim | Baixo | MANTER |
| docs/product/evidence/design-system/chromium/390x844/client.png | Documentacao | Sim | Baixo | MANTER |
| docs/product/evidence/design-system/chromium/390x844/technician.png | Documentacao | Sim | Baixo | MANTER |
| docs/product/evidence/design-system/chromium/414x896/admin.png | Documentacao | Sim | Baixo | MANTER |
| docs/product/evidence/design-system/chromium/414x896/client.png | Documentacao | Sim | Baixo | MANTER |
| docs/product/evidence/design-system/chromium/414x896/technician.png | Documentacao | Sim | Baixo | MANTER |
| docs/product/evidence/design-system/chromium/430x932/admin.png | Documentacao | Sim | Baixo | MANTER |
| docs/product/evidence/design-system/chromium/430x932/client.png | Documentacao | Sim | Baixo | MANTER |
| docs/product/evidence/design-system/chromium/430x932/technician.png | Documentacao | Sim | Baixo | MANTER |
| docs/product/evidence/design-system/chromium/768x1024/admin.png | Documentacao | Sim | Baixo | MANTER |
| docs/product/evidence/design-system/chromium/768x1024/client.png | Documentacao | Sim | Baixo | MANTER |
| docs/product/evidence/design-system/chromium/768x1024/technician.png | Documentacao | Sim | Baixo | MANTER |
| docs/product/evidence/design-system/summary.json | Documentacao | Sim | Baixo | MANTER |
| docs/product/evidence/diff-audit-samples.json | Documentacao | Sim | Baixo | MANTER |
| docs/product/FINAL_COMPLETION_AUDIT.md | Documentacao | Sim | Baixo | MANTER |
| docs/product/P0_TECHNICIAN_VISIT_FIX.md | Documentacao | Sim | Baixo | MANTER |
| docs/product/RC1_BUG_TRACKER.md | Documentacao | Sim | Baixo | MANTER |
| docs/product/UI_UX_VALIDATION_REPORT.md | Documentacao | Sim | Baixo | MANTER |
| frontend/admin-ai.html | Visual | Sim | Baixo | MANTER |
| frontend/admin-alerts.html | Visual | Sim | Baixo | MANTER |
| frontend/admin-client-settings.html | Visual | Sim | Baixo | MANTER |
| frontend/admin-clients.html | Visual | Sim | Baixo | MANTER |
| frontend/admin-collection.html | Visual | Sim | Baixo | MANTER |
| frontend/admin-command-center.html | Visual | Parcial | Medio | ADAPTAR |
| frontend/admin-company-closures.html | Visual | Sim | Baixo | MANTER |
| frontend/admin-core-flow.html | Visual | Parcial | Medio | ADAPTAR |
| frontend/admin-crm.html | Visual | Sim | Baixo | MANTER |
| frontend/admin-dashboard.html | Visual | Sim | Baixo | MANTER |
| frontend/admin-email-logs.html | Visual | Sim | Baixo | MANTER |
| frontend/admin-inventory.html | Visual | Sim | Baixo | MANTER |
| frontend/admin-keys.html | Visual | Sim | Baixo | MANTER |
| frontend/admin-live-map.html | Visual | Sim | Baixo | MANTER |
| frontend/admin-login.html | Visual | Sim | Baixo | MANTER |
| frontend/admin-map.html | Visual | Sim | Baixo | MANTER |
| frontend/admin-master-control.html | Visual | Sim | Baixo | MANTER |
| frontend/admin-menu.html | Visual | Parcial | Medio | ADAPTAR |
| frontend/admin-notifications.html | Visual | Sim | Baixo | MANTER |
| frontend/admin-onboarding.html | Visual | Sim | Baixo | MANTER |
| frontend/admin-operational-flow.html | Visual | Parcial | Medio | ADAPTAR |
| frontend/admin-operational-settings.html | Visual | Sim | Baixo | MANTER |
| frontend/admin-payment-settings.html | Visual | Sim | Baixo | MANTER |
| frontend/admin-payments.html | Visual | Sim | Baixo | MANTER |
| frontend/admin-pool-calculator.html | Visual | Sim | Baixo | MANTER |
| frontend/admin-pool-technical.html | Visual | Sim | Baixo | MANTER |
| frontend/admin-pools.html | Visual | Sim | Baixo | MANTER |
| frontend/admin-priority.html | Visual | Sim | Baixo | MANTER |
| frontend/admin-reports.html | Visual | Sim | Baixo | MANTER |
| frontend/admin-rounds.html | Visual | Sim | Baixo | MANTER |
| frontend/admin-security.html | Visual | Sim | Baixo | MANTER |
| frontend/admin-service-log.html | Visual | Sim | Baixo | MANTER |
| frontend/admin-suppliers.html | Visual | Sim | Baixo | MANTER |
| frontend/admin-technicians.html | Visual | Sim | Baixo | MANTER |
| frontend/admin-test-center.html | Visual | Parcial | Medio | ADAPTAR |
| frontend/admin-today.html | Visual | Parcial | Medio | ADAPTAR |
| frontend/admin-ui-settings.html | Visual | Sim | Baixo | MANTER |
| frontend/admin-vehicles.html | Visual | Sim | Baixo | MANTER |
| frontend/admin-visits-dashboard.html | Visual | Sim | Baixo | MANTER |
| frontend/admin-visits.html | Visual | Sim | Baixo | MANTER |
| frontend/alerts-financial.html | Visual | Sim | Baixo | MANTER |
| frontend/alerts.html | Visual | Sim | Baixo | MANTER |
| frontend/billing-center.html | Visual | Sim | Baixo | MANTER |
| frontend/billing-extras.html | Visual | Sim | Baixo | MANTER |
| frontend/billing-history.html | Visual | Sim | Baixo | MANTER |
| frontend/billing.html | Visual | Sim | Baixo | MANTER |
| frontend/chat.html | Visual | Sim | Baixo | MANTER |
| frontend/client_chat.html | Visual | Sim | Baixo | MANTER |
| frontend/client_tech.html | Visual | Sim | Baixo | MANTER |
| frontend/client-dashboard.html | Visual | Sim | Baixo | MANTER |
| frontend/client-history.html | Visual | Sim | Baixo | MANTER |
| frontend/client-login.html | Visual | Sim | Baixo | MANTER |
| frontend/client-menu.html | Visual | Sim | Baixo | MANTER |
| frontend/client-notifications.html | Visual | Sim | Baixo | MANTER |
| frontend/client-payments.html | Visual | Sim | Baixo | MANTER |
| frontend/client-portal.html | Visual | Sim | Baixo | MANTER |
| frontend/client-wow.html | Visual | Sim | Baixo | MANTER |
| frontend/client.html | Visual | Sim | Baixo | MANTER |
| frontend/communications.html | Visual | Sim | Baixo | MANTER |
| frontend/config-notifications.html | Visual | Sim | Baixo | MANTER |
| frontend/crystal-os-v2-route-index.html | Visual | Sim | Baixo | MANTER |
| frontend/dashboard.html | Visual | Sim | Baixo | MANTER |
| frontend/help-center.html | Visual | Sim | Baixo | MANTER |
| frontend/incident-center.html | Visual | Sim | Baixo | MANTER |
| frontend/invoices.html | Visual | Sim | Baixo | MANTER |
| frontend/login.html | Visual | Sim | Baixo | MANTER |
| frontend/map.html | Visual | Sim | Baixo | MANTER |
| frontend/metrics.html | Visual | Sim | Baixo | MANTER |
| frontend/multi-map.html | Visual | Sim | Baixo | MANTER |
| frontend/notifications.html | Visual | Sim | Baixo | MANTER |
| frontend/operational-dashboard.html | Visual | Sim | Baixo | MANTER |
| frontend/profit-map.html | Visual | Sim | Baixo | MANTER |
| frontend/ranking.html | Visual | Sim | Baixo | MANTER |
| frontend/report-center.html | Visual | Sim | Baixo | MANTER |
| frontend/report-settings.html | Visual | Sim | Baixo | MANTER |
| frontend/route-map.html | Visual | Sim | Baixo | MANTER |
| frontend/settings.html | Visual | Sim | Baixo | MANTER |
| frontend/splash.html | Visual | Sim | Baixo | MANTER |
| frontend/technician-chat.html | Visual | Sim | Baixo | MANTER |
| frontend/technician-field-mode.html | Visual | Sim | Baixo | MANTER |
| frontend/technician-gps.html | Visual | Sim | Baixo | MANTER |
| frontend/technician-guide.html | Visual | Sim | Baixo | MANTER |
| frontend/technician-history.html | Visual | Sim | Baixo | MANTER |
| frontend/technician-login.html | Visual | Sim | Baixo | MANTER |
| frontend/technician-map.html | Visual | Sim | Baixo | MANTER |
| frontend/technician-new-client.html | Visual | Sim | Baixo | MANTER |
| frontend/technician-profile.html | Visual | Sim | Baixo | MANTER |
| frontend/technician-profit-dashboard.html | Visual | Sim | Baixo | MANTER |
| frontend/technician-profit.html | Visual | Sim | Baixo | MANTER |
| frontend/technician-route.html | Visual | Sim | Baixo | MANTER |
| frontend/technician-visit.html | Visual | Sim | Baixo | MANTER |
| frontend/technician.html | Visual | Sim | Baixo | MANTER |
| frontend/to-issue.html | Visual | Sim | Baixo | MANTER |
| frontend/ui/design-system.css | Visual | Sim | Baixo | MANTER |
| frontend/ui/design-system.js | Funcional | Sim | Baixo | MANTER |
| scripts/run-design-system-visual-tests.js | Funcional | Sim | Baixo | MANTER |
| src/routes/coreFlowRoutes.js | Seguranca | N/A | Medio | MANTER |

## 9) Encerramento Fase 3.0
- Nenhuma alteracao funcional adicional foi executada nesta fase.
- Este documento encerra a auditoria completa pre-migracao.
- Proxima acao depende de autorizacao explicita para Fase 3.1.
