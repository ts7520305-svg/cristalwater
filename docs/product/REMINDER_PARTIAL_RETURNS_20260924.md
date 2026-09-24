# TASK326 — Devoluções parciais de materiais de lembretes

Base: TASK325, `a7bd88b90d24841fb4a3d6ce9e32e5e2e72ef063`. Lote preparado para validação na branch de trabalho; não é uma entrega em produção.

## Comportamento

A administração escolhe produtos e quantidades de um consumo confirmado de um lembrete independente e devolve apenas essa parte ao saldo original. A identidade do produto, unidade, armazém ou viatura não é substituída. Quantidades nulas, repetidas, excessivas ou que equivalham à reposição integral são recusadas; para devolver todo o restante usa-se a anulação explícita.

Cada devolução conserva motivo, autor, UUID, movimentos e comprovativo. O histórico encadeia as devoluções e verifica os movimentos reais. A anulação posterior repõe apenas o remanescente, descontando todas as devoluções anteriores. Consumo, declaração de recursos e documentos anteriores permanecem conservados.

Os custos do produto devolvido ficam por rever, mantendo os montantes e reservas anteriores até à anulação financeira explícita. A nova valorização usa o consumo líquido e a linha histórica de compra. A versão 11 da origem financeira incorpora os comprovativos das devoluções; a versão 8 anterior continua verificável. Devoluções de outro produto não alteram silenciosamente a origem financeira de um produto não afetado.

A interface mostra a quantidade restante e o stock de origem. Rascunhos antigos continuam aceites. Pedidos pendentes usam a recuperação existente; confirmação dupla e resposta perdida não devem repetir movimentos. A apresentação do histórico verifica as provas de todas as devoluções antes de permitir novos pedidos.

## Verificação

- Sintaxe aprovada: 620 ficheiros backend, 217 frontend e 62 scripts inline. Passaram 543 testes unitários em 76 ficheiros e quatro testes técnicos.
- Seis testes unitários novos: quantidades líquidas, limites, encadeamento, reservas financeiras, anulação do remanescente e equivalência Node/navegador. Os 13 testes de regras de materiais passaram localmente.
- Ensaio integrado ampliado: devolver 0,25 de 1 kg, conservar 100 cêntimos já atribuídos, recuperar o mesmo UUID em duas instâncias, rollback e anular só os 0,75 kg restantes.
- Ensaio de navegador ampliado: rascunho de devolução, resposta perdida, clique duplo, recuperação sem novo POST, histórico, valorização de 0,75 kg em 25 cêntimos e larguras 320/390/1440.
- Migração adicional preserva as origens financeiras anteriores e admite a versão 11. O ensaio compara os dados antes/depois e recusa comprovativos incompletos.
- Os ensaios de API/navegador e migração deste lote ainda não foram executados nesta retoma: não há PostgreSQL local disponível. Devem passar no CI antes de declarar a TASK326 aprovada. Nenhuma migração foi aplicada a produção.

O lote mantém 228 grupos no runner, ampliando grupos existentes. Cache v141, 40 migrações, sem novas tabelas ou dependências. O CI e o restauro das TASK323–325 também ainda aguardavam fecho confirmado na última consulta.

## Falha inicial e correção da sincronização de campo

O CI do commit `47261ccf12e577ce6181bda193135d9786d5d9c3` passou a migração, a sintaxe, os 543 unitários e os quatro testes técnicos. Falhou no teste geral de navegador anterior aos integrados, a aguardar a sincronização de um fecho de água offline; o restauro ficou por executar. [Evidência inicial](evidence/20260924_task326_initial_failure.json).

O problema foi reproduzido de forma determinística: a passagem atual já tinha percorrido os avisos de água quando foi pedido o fecho. `sync()` devolvia a promessa dessa passagem e não garantia a execução do novo pedido. A correção conserva a serialização e faz outra passagem antes de resolver os pedidos concorrentes. Três testes cobrem fecho durante sincronização, vários chamadores sem duplicação e mudança de conta com preservação do fecho local. O teste de navegador original mantém-se inalterado. Cache v142.

A execução da migração está confirmada no CI inicial; a correção ainda precisa do CI completo, dos percursos de devolução e do restauro antes da aprovação.

A correção passou localmente a sintaxe, 546 testes unitários em 77 ficheiros e quatro testes técnicos.
