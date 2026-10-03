# Backlog operacional Cristal Water

Fonte do estado corrente: [PROJECT_STATE.md](PROJECT_STATE.md). O plano detalhado existente é [COMPLETION_PLAN_20260928.md](docs/product/COMPLETION_PLAN_20260928.md); este índice não o substitui nem duplica as suas TASKs. O sprint de julho em `SPRINT_BACKLOG_ACTIVE.md` é histórico face às instruções posteriores, conforme o próprio plano de conclusão.

Conciliado em 2026-10-03 09:12 (Europe/Lisbon), TASK572 documental. Publicação571 `c380f01de6867ceb618d05edc37fbeafe0119f07`, árvore `a55e8f119c308633bbaf1643365aae6673419716`, Action `37108818511`, SHA/árvore/parent570 conferidos; pasta limpa antes desta conciliação. Última CI integral aceite568, não571. As entradas históricas abaixo conservam o estado na data indicada.

| Prioridade | Item existente | Estado / próxima ação |
|---|---|---|
| 1 | Validação TASK543–571 / TASK572 | CI540–542/544–561/563–568 e restauros próprios conferidos. Última568: SHA42e5f95/run37103713525/job111148065502,387 grupos/code0,1409 unitários/4 técnicos/sintaxe695-308-45/restauro128 tabelas/51 ficheiros iguais. CI569/570/571 ainda em execução09:11, própria572 necessária. CI543 failure/correção551 aceite e CI562 failure/restauro skipped/correção566 com CI própria permanecem distintas; falhas antigas não convertidas em aprovações. |
| 2 | C06-001 | Dashboard561, formulários/seletores564, cartões565 e feedback read-only567; hover568, resumo de filtros569, leitura loadAll570 e aviso de rondas sem técnico571 validados localmente com provas por produtor. CI569–571 próprias pendentes. Próxima TASK573: apenas títulos/fallbacks/instrução de colunas vazias de renderPlanner, após publicar a conciliação572. Escritas/validações/transferência/recibos/diálogos/chips/tabela/planeador restante/fallbacks vazios/bootstrap/avisos automáticos ativos continuam abertos; sem pruning ou prorrogar120s. |
| 3 | Validação ambiental Windows | Distinguir as quatro falhas locais de backup (`symlink`/modo `0600`) de regressões reais antes de usar `npm test` como gate total nesta máquina. |
| 4 | C07–C09 | Dashboards, administração, portal/relatórios/PDF; usar manifesto C05 e evidência por página. |
| 5 | C10–C14 | Política temporal, crédito, incidentes, obras/instalações e interface/acesso. Ver dependências no plano. |
| 6 | C15–C18 | Validar identidade, movimentos financeiros e serviços sazonais com fontes reais. |
| 7 | C19–C24 | Importação WhatsApp com revisão/duplicados, IA local e memória por piscina; verificar implementações antes de editar. |
| 8 | C25–C32 | VPS, canais reais, pagamentos externos, backups/restauro operacional, pilotos e aceitação de negócio. |

C01–C05 concluídas no plano existente; C06 em execução; 26 tarefas principais ainda abertas por iniciar. Os subtarefas numeradas TASK não são percentagem de prontidão.

Antes da integração final: comparar os três commits exclusivos de `feature/technicians-v25` com a branch de trabalho. Não integrar automaticamente. Contrato jurídico anual e ideias opcionais permanecem adiados.

Aceitação local recente, sem herdar CI:570 Admin90,00s/Route OS82,00s/cache326 e571 Admin93,99s/Route OS88,12s/cache327, todos abaixo120s, preflight23/E2E dos três perfis/técnicos/JS alterados aprovados. Cada tarefa mantém55 ciclos de idiomas anteriores, SQL/nós/drafts/bytes e zero GET/escrita de negócio por idioma. Unitários Windows1403/2 skipped/4 limitações de backup permanecem, não dispensadas. Timeout Admin7s do primeiro E2E565 preservado apesar das repetições seguintes aprovadas. Inventário C05 e ledger560 histórico ligado à559 não regenerados; esta572 não aceita novos candidatos nem fecha C06. Sem merge/deploy.

Histórico (estado de 03/10 às07:36, não checkpoint corrente): TASK567 publicada `d71350b`, árvore89cb011d8711adac9d3a31de3cfa8c1ef83d7e39/Action37102577230. TASK568 reproduziu hover1,72:1 nas15 combinações idioma/largura, base/foco16,17 preservados; uma propriedade local de cor deixa hover9,38 sem mudar fundo/geometria/handlers. Grupo completo75,77s/45 medições/55 estados/SQL/bytes intactos, preflight23/E2E completo324/técnicos/seis JS/diff-check aprovados; unitários1403/2 skipped/4 limitações Windows. CI565/566/567 pendentes,564 é última CI/log387/restauro128 tabelas/51 ficheiros conferida. Falhas543/562 e primeiro E2E565/Admin reload7s preservados. Próxima569 em PROJECT_STATE; C06/inventário/evidência560 intactos, sem merge/deploy.
