# Backlog operacional Cristal Water

Fonte do estado corrente: [PROJECT_STATE.md](PROJECT_STATE.md). O plano detalhado existente é [COMPLETION_PLAN_20260928.md](docs/product/COMPLETION_PLAN_20260928.md); este índice não o substitui nem duplica as suas TASKs. O sprint de julho em `SPRINT_BACKLOG_ACTIVE.md` é histórico face às instruções posteriores, conforme o próprio plano de conclusão.

| Prioridade | Item existente | Estado / próxima ação |
|---|---|---|
| 1 | Validação TASK543–551 | CI540–542/544 e restauros conferidos. CI543 falhou na passagem de dia; reprodução temporal/correção local551, restauro543 skipped. Conferir os restantes runs por SHA. |
| 2 | C06-013 / TASK552 | Guia técnico já traduzido: executar ensaio nativo existente e observar evento de sessão/leituras/documentos tardios antes de alterar. Não duplicar produtor nem mecanismo de proteção. |
| 3 | Validação ambiental Windows | Distinguir as quatro falhas locais de backup (`symlink`/modo `0600`) de regressões reais antes de usar `npm test` como gate total nesta máquina. |
| 4 | C07–C09 | Dashboards, administração, portal/relatórios/PDF; usar manifesto C05 e evidência por página. |
| 5 | C10–C14 | Política temporal, crédito, incidentes, obras/instalações e interface/acesso. Ver dependências no plano. |
| 6 | C15–C18 | Validar identidade, movimentos financeiros e serviços sazonais com fontes reais. |
| 7 | C19–C24 | Importação WhatsApp com revisão/duplicados, IA local e memória por piscina; verificar implementações antes de editar. |
| 8 | C25–C32 | VPS, canais reais, pagamentos externos, backups/restauro operacional, pilotos e aceitação de negócio. |

C01–C05 concluídas no plano existente; C06 em execução; 26 tarefas principais ainda abertas por iniciar. Os subtarefas numeradas TASK não são percentagem de prontidão.

Antes da integração final: comparar os três commits exclusivos de `feature/technicians-v25` com a branch de trabalho. Não integrar automaticamente. Contrato jurídico anual e ideias opcionais permanecem adiados.

Atualização 03/10 às01:35: TASK550 publicada `3b633d5`, Action37081968167; TASK551 em publicação. Cache311/preflight23/23 prova549, runner387 intacto. Equipamento551 passou nativo e com instante inicial da meia-noite simulado, relógio progressivo e datas QA coerentes; guards/assertions/prazos/produto intactos. CI544 success/logs387/restauro128 tabelas/51 ficheiros conferidos; CI543 failure não aceite, CI545–550 pendentes. Referências/falhas Windows/próxima552 em `PROJECT_STATE.md`.
