# Backlog operacional Cristal Water

Fonte do estado corrente: [PROJECT_STATE.md](PROJECT_STATE.md). O plano detalhado existente é [COMPLETION_PLAN_20260928.md](docs/product/COMPLETION_PLAN_20260928.md); este índice não o substitui nem duplica as suas TASKs. O sprint de julho em `SPRINT_BACKLOG_ACTIVE.md` é histórico face às instruções posteriores, conforme o próprio plano de conclusão.

| Prioridade | Item existente | Estado / próxima ação |
|---|---|---|
| 1 | Validação TASK542–548 | CI540/541 e restauros conferidos; obter conclusão/logs/restauro dos runs542–548 nos respetivos SHAs. |
| 2 | C06 / TASK549 | Rota547 traduzida/validada com SQL real; chat548 e E2E dos três perfis passaram. Próximo: testes GPS existentes, evento de sessão/leituras tardias; não duplicar o produtor de cinco idiomas já existente. |
| 3 | Validação ambiental Windows | Distinguir as quatro falhas locais de backup (`symlink`/modo `0600`) de regressões reais antes de usar `npm test` como gate total nesta máquina. |
| 4 | C07–C09 | Dashboards, administração, portal/relatórios/PDF; usar manifesto C05 e evidência por página. |
| 5 | C10–C14 | Política temporal, crédito, incidentes, obras/instalações e interface/acesso. Ver dependências no plano. |
| 6 | C15–C18 | Validar identidade, movimentos financeiros e serviços sazonais com fontes reais. |
| 7 | C19–C24 | Importação WhatsApp com revisão/duplicados, IA local e memória por piscina; verificar implementações antes de editar. |
| 8 | C25–C32 | VPS, canais reais, pagamentos externos, backups/restauro operacional, pilotos e aceitação de negócio. |

C01–C05 concluídas no plano existente; C06 em execução; 26 tarefas principais ainda abertas por iniciar. Os subtarefas numeradas TASK não são percentagem de prontidão.

Antes da integração final: comparar os três commits exclusivos de `feature/technicians-v25` com a branch de trabalho. Não integrar automaticamente. Contrato jurídico anual e ideias opcionais permanecem adiados.

Atualização 03/10 às00:52: TASK547 publicada `56ac2b8`, Action37079201848; TASK548 em publicação. Cache310, preflight23/23 aprovado em547, runner387 intacto. PostgreSQL16 QA isolado/migrações43, oito fluxos SQL/API/mapa e E2E nativo Admin/Técnico/Cliente passaram; chat nativo548 aprovado. CI542–547 pendentes; não transferir aceitação541. Referências/falhas Windows/próxima549 em `PROJECT_STATE.md`.
