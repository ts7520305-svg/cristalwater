# TASK268 — Revisão comercial de intervenções periódicas

A execução de manutenção preventiva e a conclusão de um lembrete de serviço já conservavam o histórico e a próxima ocorrência, mas não tinham uma decisão comercial associada. A administração passa a consultar os registos concluídos de cada piscina, indicar «incluída na mensalidade» ou «extra» e confirmar o valor e uma nota. O valor é introduzido pela administração, caso a caso; não é inferido do número de visitas nem do tipo de equipamento.

## Percurso entregue

- Em **Configurações operacionais → Intervenções e cobrança**, selecionar a piscina no painel de manutenção preventiva e escolher manutenções de equipamentos ou lembretes de serviço concluídos. Paginação de 25 registos, por identificador decrescente; «Ver registos anteriores» continua a consulta e «Atualizar» regressa à primeira página.
- O registo de execução EQUIPMENT conserva a distinção REGULAR/EXTRA; REMINDER admite apenas as categorias de serviço existentes, com data de conclusão e sem cancelamento. Não se cobra uma previsão ou um lembrete pendente.
- «Incluída» guarda uma decisão com zero extra e não cria documento. «Extra» prepara um rascunho avulso pelo Finance OS, com origem `MAINTENANCE_EQUIPMENT` ou `MAINTENANCE_REMINDER`, cliente, piscina, descrição, valor em cêntimos e nota. Não ocupa a mensalidade e não emite nem envia documentos.
- O cliente, a piscina e a versão observada são confirmados antes da decisão. Uma visita que conserva outro cliente/piscina bloqueia a cobrança após transferência da instalação. O relato histórico da execução prevalece sobre o título atual do plano.
- A decisão exibida identifica sempre o cliente e a piscina da revisão original, mesmo depois de uma transferência ou mudança de nome; os valores históricos não são apresentados como pertencendo ao cliente atual.
- A decisão, o eventual documento/linha e a auditoria pertencem à mesma transação. Uma chave única por tipo de origem e identificador reserva a decisão, incluindo quando o lembrete é apagado ou o documento é posteriormente retirado. A repetição exata recupera o resultado; dados diferentes exigem consultar o registo existente. Referências comerciais pré-existentes da mesma origem também bloqueiam nova preparação.
- O histórico operacional, a conclusão da visita e o próximo prazo não são alterados. As decisões comerciais ficam em comprovativos privados, sem valores nos planos, respostas de execução ou consulta dos técnicos.

## API e recuperação

`GET /api/equipment-maintenance/pools/:poolId/billing?kind=EQUIPMENT|REMINDER&before=:id` e `POST /api/equipment-maintenance/billing/:kind/:id/review`, ambos ADMIN. O POST exige `expectedVersion`, `expectedClientId`, `expectedPoolId`, `mode`, `amount`, `note` e `confirmed: true`. Valores coercivos, frações de cêntimo, negativos, zero como extra e campos desconhecidos são recusados. A decisão incluída exige zero explícito.

O navegador conserva o pedido exato por conta antes de o enviar e coordena janelas com Web Locks. A confirmação é verificada por origem, cliente, piscina, versão, modo, cêntimos, nota e documento. Falha de rede ou resposta trocada conserva a recuperação; recusa definitiva exige «Rever dados» e consulta atual. Falha no armazenamento impede o envio. Mudança de sessão esconde valores e mantém a recuperação na conta original. Nenhuma repetição é enviada automaticamente.

## Verificação

- Ensaio local `run-1789756454875`: novo percurso comercial e regressões de manutenção, conclusão dos lembretes e proteção financeira dos rascunhos aprovados.
- Ensaio final `run-1789756590810`: novo percurso comercial completo e percurso real de criação/execução de equipamentos aprovados. Inclui REGULAR/EXTRA, serviços incluídos, oito pedidos simultâneos, cêntimos com vírgula, cliente/piscina/relato alterados, lembrete pendente, reserva histórica, recuperação após eliminação da origem, documento pago preservado, mensalidade independente, paginação e reversão por falha de auditoria.
- Revisão final `run-1789757086083` aprovada: a consulta e a interface mostram o cliente original da decisão após transferência da piscina. O ensaio anterior `run-1789757044126` expôs a mensagem antiga «Intervenções atualizadas» durante nova leitura; a interface passa a anunciar a consulta em curso e o teste aguarda a nova resposta.
- Chromium: formulário real, texto literal, cancelamento, resposta gravada e perdida/reload, resposta com valor errado, conflito, falha de armazenamento sem envio, duas janelas, lembrete concluído, mudança de sessão e layout a 320/390/1440 px. Revisão visual corrigiu a ligação final e apresenta os estados de documento em português.
- 396 testes unitários/63 ficheiros e quatro testes de técnicos aprovados; sintaxe 558 backend/183 frontend/56 scripts inline. Runner passa a 152 grupos. Cache v88; 21 migrações existentes, sem migração nova.
- A primeira tentativa do novo teste usou um alias de faturação mensal inexistente; o ensaio foi corrigido para chamar o negócio mensal efetivamente existente e verificar os 80 EUR independentes. Nenhuma rota de produto foi alterada para acomodar esse erro do teste.

CI final PostgreSQL 16 **aprovado**: commit `865bff33a7f8894167b0d6470f9478620f628141`, árvore `1d53a9723dbf90809372e9963bf76a030158b005`, [workflow 35382109354](https://github.com/ts7520305-svg/cristalwater/actions/runs/35382109354), job `105720461718`, concluído em 18/09/2026 às 19:01:09 UTC. 152/152 grupos distintos, todos com código zero e sem sinal; o novo percurso comercial completo demorou 8799 ms. 396 unitários/63 ficheiros, quatro técnicos, gate de navegador, 21 migrações aditivas e sintaxe 558/183/56 aprovados. Restauro isolado de 110 tabelas e 46 ficheiros carregados, com linhas e hashes iguais. Publicação na branch autorizada, sem merge/deploy. A atualização documental posterior conserva esta árvore de código/testes. Backups locais `backup/maintenance-billing-local-20260918` e `backup/maintenance-billing-context-local-20260918`.

## Âmbito e limites

A decisão comercial é por registo concluído, com preço explícito. Não existe nesta tarefa um preçário automático por plano nem cálculo de materiais, mão de obra ou margem. A decisão guardada é única; a revisão de um documento já preparado segue o Finance OS. Uma decisão incluída não é reaberta por este endpoint. O sistema não infere que duas anotações independentes — por exemplo um lembrete e uma execução de equipamento — representam o mesmo trabalho; a confirmação administrativa inclui verificar cobranças existentes. Registos apagados deixam de constar da consulta de origens, mas o comprovativo e o documento são preservados.

Esta tarefa não valida a instalação no VPS, notificações físicas, desempenho de produção ou emissão fiscal. A interface acrescentada está em português. Frequência e preços por cliente/época/instalação continuam independentes, incluindo três ou mais visitas conforme cada caso.

## Ficheiros (10)

1. `src/business/equipment/MaintenanceBillingBusiness.js`
2. `src/controllers/equipmentMaintenanceController.js`
3. `src/routes/equipmentMaintenanceRoutes.js`
4. `frontend/admin-maintenance-billing.js`
5. `frontend/admin-operational-settings.html`
6. `frontend/sw.js`
7. `scripts/test-field-maintenance-billing.js`
8. `scripts/test-field-suite.js`
9. Este relatório.
10. `docs/product/CURRENT_WORK_CHECKPOINT.md`
