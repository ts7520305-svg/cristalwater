# Revisão e reserva dos emails mensais — TASK279

Data: 21/09/2026. Branch: `work/field-readiness-20260915-simulation`.

## Problema e comportamento

A TASK278 alinhou o mês da geração e do envio. Faltavam uma confirmação do destinatário/conteúdo e uma reserva persistente: dois pedidos simultâneos ou uma resposta perdida podiam repetir o contacto. Esta continuação acrescenta o percurso na página ADMIN de relatórios e usa a mesma reserva para chamadas internas automáticas.

- `POST /api/admin/reports/prepare`, com apenas `monthRef`, gera os relatórios CLIENT em falta de um mês concluído. Recusa o mês atual/futuro, conserva os documentos existentes e não envia emails. Seleciona clientes ativos; não gera os agregados antigos ADMIN neste percurso.
- `GET /api/admin/reports/email-preview?monthRef=AAAA-MM` consulta os relatórios, destinatários, textos, motivos de exclusão e resultados já registados. A consulta não escreve e a resposta é privada, sem cache. O envio manual admite apenas relatórios CLIENT com versão 2 e período consistente.
- Cada relatório sem reserva recebe uma confirmação assinada válida por 15 minutos, ligada ao ADMIN, mês, relatório, destinatário e hash do conteúdo. `POST /api/admin/reports/send-now` exige `monthRef`, `reportId`, UUID `requestId`, `reviewToken` e `confirmed: true`. Campos adicionais, confirmação expirada/de outra conta e conteúdo ou destinatário alterado são recusados.
- Na interface, o ADMIN vê mês, destinatário, assunto e texto integral antes de assinalar a confirmação de um relatório. Há seis por página. Alterar mês, página ou sessão elimina a seleção anterior. Texto dinâmico é literal, sem HTML executável. A geração e a consulta têm ações próprias.

## Persistência, concorrência e falhas

Uma transação com isolamento RepeatableRead revê a fonte e as regras e cria, em conjunto, `EmailLog` PENDING e `MonthlyReportDelivery`. Só depois do commit pode contactar o transporte. As restrições únicas de relatório, UUID e log impedem duas reservas entre processos. Repetições compatíveis devolvem o registo persistente, sem repetir o transporte; conflitos são recusados. A reserva não é retomada automaticamente depois de reinício, falha ou perda de resposta.

Log e resultado da reserva também são atualizados numa transação comum. Aceitação explícita do destinatário fica SENT; recusa explícita, FAILED; exceção/resposta ambígua, UNKNOWN. Falha ao guardar o resultado conserva ambos PENDING. SENT significa aceitação pelo serviço de email, sem confirmação de entrega; `deliveryConfirmed` permanece falso. Uma resposta perdida no navegador conduz a nova consulta, sem repetição automática do POST.

As regras de notificação e as duas flags de integração continuam obrigatórias. O envio automático passa pelo mesmo mecanismo persistente. O alias legado não montado delega na confirmação exigida; os dois mecanismos genéricos de reenvio e o botão do histórico deixam de aceitar MONTHLY_REPORT, incluindo FAILED.

Logs mensais antigos sem ligação à nova reserva exigem revisão antes de enviar: um assunto canónico do mês escolhido bloqueia esse mês; um assunto sem período identificável bloqueia conservadoramente todos os meses. Um assunto canónico de outro mês não bloqueia o mês escolhido. Não há atribuição, apagamento ou alteração automática desses registos. A reserva é por relatório: corrigir posteriormente o endereço não autoriza um segundo envio.

## Esquema e compatibilidade

A 22.ª migração, `20260921190000_monthly_report_delivery`, acrescenta apenas a tabela e as restrições/índices. As relações com relatório e log usam DELETE RESTRICT. Não reescreve relatórios, logs anteriores, preços, frequências, visitas ou referências fiscais. O teste de migrações confirma preservação das fontes, tabela nova vazia, unicidade independente de relatório/UUID/log e integridade referencial. A comparação local entre as 22 migrações e o esquema Prisma não encontrou diferenças.

Cache frontend v95. Runner com 163 grupos, incluindo os dois grupos novos. A comparação com o GitHub confirmou a branch de trabalho em `ce64d02127866ae9cd50599b068c206a2ec9dc82` sem divergência local e a principal `feature/technicians-v25` em `6f27081e1d183ff584a62255b016b373836734db` como antepassado. Publicação normal na mesma branch autorizada, sem atualização forçada, merge ou instalação na VPS.

## Verificação local

- `test-field-monthly-email-delivery.js`: permissões, mês inválido/aberto, confirmação e expiração, alteração de destinatário/conteúdo/regras, duas instâncias concorrentes, UUID em conflito, reinício, resposta HTTP perdida, aceitação/recusa/incerteza, histórico antigo identificável/ambíguo e bloqueio de ambos os reenvios legados.
- Falhas antes do log, depois do log e ao guardar o resultado comprovam rollback e ausência de contactos indevidos. A injeção é restrita ao processo QA, dentro de transações Prisma reais; não há desvio em produção. O transporte simulado só admite `@qa.invalid`.
- `test-field-monthly-email-ui.js`: Chromium real, revisão explícita, paginação, texto literal, duplo clique, resposta perdida, destinatário desatualizado, falha de gravação, geração sem envio, respostas malformadas/parciais/antigas, timeout/offline, A–B–A de mês/sessão, BFCache e mudança de conta noutra aba. Rascunhos alheios ao percurso permanecem intactos.
- Regressões de período mensal, acesso CLIENT e consulta ADMIN aprovadas na mesma base QA. As asserções antigas de falha de gravação passaram para o novo grupo, com verificação atómica mais forte; não foram descartadas. Logs: `/tmp/cw279-api.log`, `/tmp/cw279-ui.log`, `/tmp/cw279-final.log` e `/tmp/cw279-legacy.log`.
- 396 testes unitários/63 ficheiros, quatro testes técnicos, 21 scripts de navegador e sintaxe 564 backend/186 frontend/56 inline aprovados. Prisma validado e cliente gerado. Layout a 320/390/1440 px, alvos de toque e contraste no modo escuro verificados; evidência final em `reports/field-visual/monthly-email-1790015327888/` e `/tmp/cw279-visual-final.log`. O fundo do cartão foi corrigido para preservar contraste; a captura do botão desativado aguarda a repintura do Chromium após o scroll, sem alterar o comportamento de produção.

Publicado no commit `43ff1116585e2efcdddab3777c8a9c01c305b60d`, árvore `3c3c464fa763bda126033b5b2522212e8f620403`, idêntica à validada localmente. [CI 35638748429](https://github.com/ts7520305-svg/cristalwater/actions/runs/35638748429), job `106462611307`, concluído com sucesso às 18:49:13 UTC de 21/09/2026. Logs confirmam 163/163 grupos distintos com código zero/sem sinal: período mensal 3754 ms, reserva/envio 2084 ms e interface 9848 ms. 396 unitários/63 ficheiros, quatro técnicos, 21 scripts de navegador, 22 migrações e sintaxe 564/186/56 aprovados. Restauro PostgreSQL 16 de 111 tabelas e 46 ficheiros, com linhas e hashes iguais. A atualização final deste documento/checkpoint é apenas documental e conserva o código aprovado. Backups locais `backup/monthly-email-confirmation-local-20260921` e `backup/monthly-email-confirmation-visual-local-20260921`. Histórico completo: zero commits exclusivos da principal e 291 exclusivos desta branch no commit publicado. Todos os contactos foram simulados, com integrações externas desativadas no ambiente QA.

## Ficheiros e continuação

22 ficheiros: `frontend/admin-email-logs.js`, `frontend/admin-reports.html`, `frontend/cw-monthly-email.js`, `frontend/sw.js`, `prisma/schema.prisma`, a nova migração, `src/controllers/adminEmailRetryController.js`, `src/controllers/adminReportController.js`, `src/controllers/adminReportEmailController.js`, `src/routes/adminReportRoutes.js`, `src/services/emailRetryService.js`, `src/services/monthlyReportDeliveryService.js`, `src/services/reportEmailService.js`, `scripts/fixtures/monthly-email-server.js`, `scripts/test-field-migrations.js`, `scripts/test-field-monthly-email-period.js`, `scripts/test-field-monthly-email-delivery.js`, `scripts/test-field-monthly-email-ui.js`, `scripts/test-field-suite.js`, este documento, `MONTHLY_EMAIL_PERIOD_20260921.md` e `CURRENT_WORK_CHECKPOINT.md`.

Próximo percurso: reconciliação explícita e auditável dos registos antigos e resultados FAILED/UNKNOWN/PENDING, antes de permitir um reenvio deliberado. Não existe botão para limpar a reserva ou repetir um resultado incerto. Revisão de relatórios históricos CLIENT, agregados ADMIN, reconciliação fiscal, VPS e piloto físico continuam separados. Frequências e preços por cliente/época/instalação, três ou mais visitas conforme necessário; faturação fiscal com IVA num programa externo.
