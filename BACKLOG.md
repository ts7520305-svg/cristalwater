# Backlog operacional Cristal Water

Fonte do estado corrente: [PROJECT_STATE.md](PROJECT_STATE.md). O plano detalhado existente é [COMPLETION_PLAN_20260928.md](docs/product/COMPLETION_PLAN_20260928.md); este índice não o substitui nem duplica as suas TASKs. O sprint de julho em `SPRINT_BACKLOG_ACTIVE.md` é histórico face às instruções posteriores, conforme o próprio plano de conclusão.

| Prioridade | Item existente | Estado / próxima ação |
|---|---|---|
| 1 | Validação TASK543–565 / TASK566 | CI540–542/544–561/563 e restauros conferidos. CI543 failure preservada/correção551 aceite. CI562 falhou na expiração do histórico/linha450; restauro skipped, próxima566 reproduz/alinha relógio da fixture ao exp real, sem mudar guardas/prazos. CI564 pendente. |
| 2 | C06-001 | Dashboard561, formulários/seletores564 e cartões read-only565 aprovados localmente. Próximo após566: feedback coverageStatus no grupo Admin nativo existente; Route OS já114s/120s na QA acumulada. Recibos/diálogos/planeador/fallbacks vazios permanecem abertos. |
| 3 | Validação ambiental Windows | Distinguir as quatro falhas locais de backup (`symlink`/modo `0600`) de regressões reais antes de usar `npm test` como gate total nesta máquina. |
| 4 | C07–C09 | Dashboards, administração, portal/relatórios/PDF; usar manifesto C05 e evidência por página. |
| 5 | C10–C14 | Política temporal, crédito, incidentes, obras/instalações e interface/acesso. Ver dependências no plano. |
| 6 | C15–C18 | Validar identidade, movimentos financeiros e serviços sazonais com fontes reais. |
| 7 | C19–C24 | Importação WhatsApp com revisão/duplicados, IA local e memória por piscina; verificar implementações antes de editar. |
| 8 | C25–C32 | VPS, canais reais, pagamentos externos, backups/restauro operacional, pilotos e aceitação de negócio. |

C01–C05 concluídas no plano existente; C06 em execução; 26 tarefas principais ainda abertas por iniciar. Os subtarefas numeradas TASK não são percentagem de prontidão.

Antes da integração final: comparar os três commits exclusivos de `feature/technicians-v25` com a branch de trabalho. Não integrar automaticamente. Contrato jurídico anual e ideias opcionais permanecem adiados.

Atualização 03/10 às06:07: TASK564 publicada `079a47e`, Action37096545823; TASK565 cartões/ARIA de cobertura em publicação, duas repetições nativas109,85s/114,29s/214 cartões/8 códigos/5 idiomas, dados/seleção/SQL intactos. Preflight23/E2E final/cache322/técnicos4/4/sete JS aprovados; unitários com4 limitações Windows. Primeiro E2E565/Admin inventário reload7s falhou, repetição passou sem mudanças; não há causa comprovada. CI561/563 logs387/restauros128 tabelas/51 ficheiros conferidos, falha562 do histórico não aceite nem apagada. Próxima566 em PROJECT_STATE, antes do feedback C06; inventário/evidência560 intactos.
