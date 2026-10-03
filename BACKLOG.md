# Backlog operacional Cristal Water

Fonte do estado corrente: [PROJECT_STATE.md](PROJECT_STATE.md). O plano detalhado existente é [COMPLETION_PLAN_20260928.md](docs/product/COMPLETION_PLAN_20260928.md); este índice não o substitui nem duplica as suas TASKs. O sprint de julho em `SPRINT_BACKLOG_ACTIVE.md` é histórico face às instruções posteriores, conforme o próprio plano de conclusão.

| Prioridade | Item existente | Estado / próxima ação |
|---|---|---|
| 1 | Validação TASK543–560 | CI540–542/544–554 e restauros conferidos. CI543 falhou na passagem de dia; correção temporal aceite no SHA551, sem apagar a falha/restauro skipped543. Conferir os restantes runs por SHA. |
| 2 | C06-001 / TASK561 | Auditoria560 guarda hashes/323 candidatos e28 IDs do dashboard: nav já coberto, corpo PT/sem seletor e contraste fraco observados nativamente. Próximo: texto próprio do dashboard/seletor global, dados/códigos literais, contraste computado e prova nativa; rondas permanece aberta. |
| 3 | Validação ambiental Windows | Distinguir as quatro falhas locais de backup (`symlink`/modo `0600`) de regressões reais antes de usar `npm test` como gate total nesta máquina. |
| 4 | C07–C09 | Dashboards, administração, portal/relatórios/PDF; usar manifesto C05 e evidência por página. |
| 5 | C10–C14 | Política temporal, crédito, incidentes, obras/instalações e interface/acesso. Ver dependências no plano. |
| 6 | C15–C18 | Validar identidade, movimentos financeiros e serviços sazonais com fontes reais. |
| 7 | C19–C24 | Importação WhatsApp com revisão/duplicados, IA local e memória por piscina; verificar implementações antes de editar. |
| 8 | C25–C32 | VPS, canais reais, pagamentos externos, backups/restauro operacional, pilotos e aceitação de negócio. |

C01–C05 concluídas no plano existente; C06 em execução; 26 tarefas principais ainda abertas por iniciar. Os subtarefas numeradas TASK não são percentagem de prontidão.

Antes da integração final: comparar os três commits exclusivos de `feature/technicians-v25` com a branch de trabalho. Não integrar automaticamente. Contrato jurídico anual e ideias opcionais permanecem adiados.

Atualização 03/10 às04:00: TASK559 publicada `f82f2ec`, Action37090788455; TASK560 auditoria em publicação. Cache319/preflight23/E2E são provas559; auditoria560 valida ledger/hashes, GETs200/SQL intacto, técnicos4/4 e dois JS, sem mudanças do produto. CI554 success/logs387/restauro128 tabelas/51 ficheiros conferidos; CI543 failure não aceite, CI555–559 pendentes. Referências/falhas Windows/próxima561 em `PROJECT_STATE.md` e evidência560.
