# Backlog operacional Cristal Water

Fonte do estado corrente: [PROJECT_STATE.md](PROJECT_STATE.md). O plano detalhado existente é [COMPLETION_PLAN_20260928.md](docs/product/COMPLETION_PLAN_20260928.md); este índice não o substitui nem duplica as suas TASKs. O sprint de julho em `SPRINT_BACKLOG_ACTIVE.md` é histórico face às instruções posteriores, conforme o próprio plano de conclusão.

| Prioridade | Item existente | Estado / próxima ação |
|---|---|---|
| 1 | Validação TASK543–554 | CI540–542/544–549 e restauros conferidos. CI543 falhou na passagem de dia; reprodução temporal/correção local551, restauro543 skipped. Conferir os restantes runs por SHA. |
| 2 | C06-015 / TASK555 | Histórico553 e rota554 validados nos quatro principais: evento síncrono, aborto GET, cache frio e expiração. Próximo: grupo nativo de perfil e observação dos seis campos após troca/expiração de conta; preservar contactos ocultos e todos os casos. |
| 3 | Validação ambiental Windows | Distinguir as quatro falhas locais de backup (`symlink`/modo `0600`) de regressões reais antes de usar `npm test` como gate total nesta máquina. |
| 4 | C07–C09 | Dashboards, administração, portal/relatórios/PDF; usar manifesto C05 e evidência por página. |
| 5 | C10–C14 | Política temporal, crédito, incidentes, obras/instalações e interface/acesso. Ver dependências no plano. |
| 6 | C15–C18 | Validar identidade, movimentos financeiros e serviços sazonais com fontes reais. |
| 7 | C19–C24 | Importação WhatsApp com revisão/duplicados, IA local e memória por piscina; verificar implementações antes de editar. |
| 8 | C25–C32 | VPS, canais reais, pagamentos externos, backups/restauro operacional, pilotos e aceitação de negócio. |

C01–C05 concluídas no plano existente; C06 em execução; 26 tarefas principais ainda abertas por iniciar. Os subtarefas numeradas TASK não são percentagem de prontidão.

Antes da integração final: comparar os três commits exclusivos de `feature/technicians-v25` com a branch de trabalho. Não integrar automaticamente. Contrato jurídico anual e ideias opcionais permanecem adiados.

Atualização 03/10 às02:26: TASK553 publicada `71ebc46`, Action37085255802; TASK554 em publicação. Cache314, preflight23/23, sintaxe695/308/45 e E2E três perfis aprovado em554, runner387 intacto. CI548/549 success/logs387/restauro128 tabelas/51 ficheiros conferidos; CI543 failure não aceite, CI550–553 pendentes. Referências/falhas Windows/próxima555 em `PROJECT_STATE.md`.
