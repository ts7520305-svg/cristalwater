# Backlog operacional Cristal Water

Fonte do estado corrente: [PROJECT_STATE.md](PROJECT_STATE.md). O plano detalhado existente é [COMPLETION_PLAN_20260928.md](docs/product/COMPLETION_PLAN_20260928.md); este índice não o substitui nem duplica as suas TASKs. O sprint de julho em `SPRINT_BACKLOG_ACTIVE.md` é histórico face às instruções posteriores, conforme o próprio plano de conclusão.

| Prioridade | Item existente | Estado / próxima ação |
|---|---|---|
| 1 | Validação TASK543–566 / TASK567 | CI540–542/544–561/563 e restauros conferidos. CI543 failure preservada/correção551 aceite. CI562 expiração/histórico failure/restauro skipped não aceite;566 reproduziu relógio1900ms antes do exp e corrigiu só fixture, grupos normal/atrasado aprovados. CI564/565 pendentes;566 em publicação. |
| 2 | C06-001 | Dashboard561, formulários/seletores564 e cartões read-only565 aprovados localmente. Próxima567: feedback read-only coverageStatus no grupo Admin nativo existente; conciliar ready no ciclo Route OS já existente, sem novos ciclos/prorrogar120s. Recibos/diálogos/planeador/fallbacks vazios permanecem abertos. |
| 3 | Validação ambiental Windows | Distinguir as quatro falhas locais de backup (`symlink`/modo `0600`) de regressões reais antes de usar `npm test` como gate total nesta máquina. |
| 4 | C07–C09 | Dashboards, administração, portal/relatórios/PDF; usar manifesto C05 e evidência por página. |
| 5 | C10–C14 | Política temporal, crédito, incidentes, obras/instalações e interface/acesso. Ver dependências no plano. |
| 6 | C15–C18 | Validar identidade, movimentos financeiros e serviços sazonais com fontes reais. |
| 7 | C19–C24 | Importação WhatsApp com revisão/duplicados, IA local e memória por piscina; verificar implementações antes de editar. |
| 8 | C25–C32 | VPS, canais reais, pagamentos externos, backups/restauro operacional, pilotos e aceitação de negócio. |

C01–C05 concluídas no plano existente; C06 em execução; 26 tarefas principais ainda abertas por iniciar. Os subtarefas numeradas TASK não são percentagem de prontidão.

Antes da integração final: comparar os três commits exclusivos de `feature/technicians-v25` com a branch de trabalho. Não integrar automaticamente. Contrato jurídico anual e ideias opcionais permanecem adiados.

Atualização 03/10 às06:27: TASK565 publicada `c82f121`, árvore82e32a4be88cfae4ef7f31e3f5923922fe7c61ac/Action37099463287. TASK566 reproduziu a asserção antiga com JWT real ainda válido1900ms; fixture agora usa exp efetivo e prova a fronteira±1ms. Grupos completos aprovados83,61s atrasado/81,65s normal, SQL/bytes/drafts/pendentes/cache322/casos originais/prazos intactos. Técnicos4/4/node--check/diff-check aprovados; unitários1403/2 skipped/4 limitações Windows. Preflight23/E2E final permanecem provas565; primeiro E2E565/Admin reload7s falhado não apagado. CI564/565 pendentes,563 é última CI/log387/restauro128 tabelas/51 ficheiros conferida, falha562 não aceite. Próxima567 em PROJECT_STATE; C06/inventário/evidência560 intactos.
