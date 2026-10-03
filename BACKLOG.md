# Backlog operacional Cristal Water

Fonte do estado corrente: [PROJECT_STATE.md](PROJECT_STATE.md). O plano detalhado existente é [COMPLETION_PLAN_20260928.md](docs/product/COMPLETION_PLAN_20260928.md); este índice não o substitui nem duplica as suas TASKs. O sprint de julho em `SPRINT_BACKLOG_ACTIVE.md` é histórico face às instruções posteriores, conforme o próprio plano de conclusão.

| Prioridade | Item existente | Estado / próxima ação |
|---|---|---|
| 1 | Validação TASK543–563 | CI540–542/544–556 e restauros conferidos. CI543 falhou na passagem de dia; correção temporal aceite no SHA551, sem apagar a falha/restauro skipped543. Conferir os restantes runs por SHA. |
| 2 | C06-001 / TASK564 | Dashboard561 aprovado/28 IDs classificados; visual562 e Route OS563 corrigidos/duas repetições próprias. Próximo: formulários/seletores próprios de admin-rounds com IDs/valores/dados literais; planeador/cobertura/estados dinâmicos permanecem separados e abertos. |
| 3 | Validação ambiental Windows | Distinguir as quatro falhas locais de backup (`symlink`/modo `0600`) de regressões reais antes de usar `npm test` como gate total nesta máquina. |
| 4 | C07–C09 | Dashboards, administração, portal/relatórios/PDF; usar manifesto C05 e evidência por página. |
| 5 | C10–C14 | Política temporal, crédito, incidentes, obras/instalações e interface/acesso. Ver dependências no plano. |
| 6 | C15–C18 | Validar identidade, movimentos financeiros e serviços sazonais com fontes reais. |
| 7 | C19–C24 | Importação WhatsApp com revisão/duplicados, IA local e memória por piscina; verificar implementações antes de editar. |
| 8 | C25–C32 | VPS, canais reais, pagamentos externos, backups/restauro operacional, pilotos e aceitação de negócio. |

C01–C05 concluídas no plano existente; C06 em execução; 26 tarefas principais ainda abertas por iniciar. Os subtarefas numeradas TASK não são percentagem de prontidão.

Antes da integração final: comparar os três commits exclusivos de `feature/technicians-v25` com a branch de trabalho. Não integrar automaticamente. Contrato jurídico anual e ideias opcionais permanecem adiados.

Atualização 03/10 às04:39: TASK562 publicada `99775ee`, Action37093523948; TASK563 fixtures PIN Route OS em publicação, duas repetições completas aprovadas mantendo403/permissões. Cache320/preflight23/E2E completo/sintaxe são provas561; visual562 passou duas vezes com ID próprio/visitas intactas. CI556 success/logs387/restauro128 tabelas/51 ficheiros conferidos; CI543 failure não aceite, CI557–562 pendentes. Quatro falhas unitárias Windows conhecidas preservadas. Próxima564 em `PROJECT_STATE.md`; inventário/evidência560 intactos.
