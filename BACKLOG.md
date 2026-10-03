# Backlog operacional Cristal Water

Fonte do estado corrente: [PROJECT_STATE.md](PROJECT_STATE.md). O plano detalhado existente é [COMPLETION_PLAN_20260928.md](docs/product/COMPLETION_PLAN_20260928.md); este índice não o substitui nem duplica as suas TASKs. O sprint de julho em `SPRINT_BACKLOG_ACTIVE.md` é histórico face às instruções posteriores, conforme o próprio plano de conclusão.

| Prioridade | Item existente | Estado / próxima ação |
|---|---|---|
| 1 | Validação TASK543–567 / TASK568 | CI540–542/544–561/563/564 e restauros conferidos. CI543 failure preservada/correção551 aceite. CI562 expiração/histórico failure/restauro skipped não aceite;566 reproduziu relógio1900ms antes do exp e corrigiu só fixture, grupos normal/atrasado aprovados. CI565/566/567 pendentes;568 validada localmente/em publicação. |
| 2 | C06-001 | Dashboard561, formulários/seletores564/cartões565 e feedback read-only567 aprovados localmente.568 corrigiu apenas cor no hover coverageRefresh após45 medições nativas, mínimo9,38. Próxima569: só resumo read-only visitFilterSummary no grupo Admin atual/mesmos ciclos Route OS, sem pruning/prorrogar120s. Estado principal/recibos/diálogos/planeador/fallbacks vazios permanecem abertos. |
| 3 | Validação ambiental Windows | Distinguir as quatro falhas locais de backup (`symlink`/modo `0600`) de regressões reais antes de usar `npm test` como gate total nesta máquina. |
| 4 | C07–C09 | Dashboards, administração, portal/relatórios/PDF; usar manifesto C05 e evidência por página. |
| 5 | C10–C14 | Política temporal, crédito, incidentes, obras/instalações e interface/acesso. Ver dependências no plano. |
| 6 | C15–C18 | Validar identidade, movimentos financeiros e serviços sazonais com fontes reais. |
| 7 | C19–C24 | Importação WhatsApp com revisão/duplicados, IA local e memória por piscina; verificar implementações antes de editar. |
| 8 | C25–C32 | VPS, canais reais, pagamentos externos, backups/restauro operacional, pilotos e aceitação de negócio. |

C01–C05 concluídas no plano existente; C06 em execução; 26 tarefas principais ainda abertas por iniciar. Os subtarefas numeradas TASK não são percentagem de prontidão.

Antes da integração final: comparar os três commits exclusivos de `feature/technicians-v25` com a branch de trabalho. Não integrar automaticamente. Contrato jurídico anual e ideias opcionais permanecem adiados.

Atualização 03/10 às07:36: TASK567 publicada `d71350b`, árvore89cb011d8711adac9d3a31de3cfa8c1ef83d7e39/Action37102577230. TASK568 reproduziu hover1,72:1 nas15 combinações idioma/largura, base/foco16,17 preservados; uma propriedade local de cor deixa hover9,38 sem mudar fundo/geometria/handlers. Grupo completo75,77s/45 medições/55 estados/SQL/bytes intactos, preflight23/E2E completo324/técnicos/seis JS/diff-check aprovados; unitários1403/2 skipped/4 limitações Windows. CI565/566/567 pendentes,564 é última CI/log387/restauro128 tabelas/51 ficheiros conferida. Falhas543/562 e primeiro E2E565/Admin reload7s preservados. Próxima569 em PROJECT_STATE; C06/inventário/evidência560 intactos, sem merge/deploy.
