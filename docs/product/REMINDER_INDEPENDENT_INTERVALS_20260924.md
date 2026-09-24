# TASK319 — Intervalos independentes dos lembretes

Base publicada: `139367880c03caedae6e15e978a9b644adb1da10`, fecho aprovado TASK317–318. Lote de 20 ficheiros.

## Resultado

A administração pode declarar de um a 20 intervalos próprios numa única declaração de recursos de um lembrete independente. Os intervalos têm segundos inteiros, duração positiva, ordem cronológica e ausência de sobreposição; extremidades adjacentes são permitidas. O técnico e a conclusão histórica continuam vinculados à execução e à decisão comercial confirmadas.

A duração e o custo usam exclusivamente a soma dos intervalos. As pausas ficam disponíveis para outras intervenções e não consomem tempo pago. Uma declaração de 20 + 40 segundos, separada por uma pausa de 280 segundos, vale 60 segundos e nunca 340.

## Comprovativos, sobreposições e custos

- O formato `workTime` e os respetivos comprovativos de esquema 1 permanecem válidos e inalterados. `workIntervals` é mutuamente exclusivo e usa esquema 2. O evento, o pedido original, a recuperação e a anulação conservam esse esquema.
- A declaração continua numa única linha. `startedAt`/`endedAt` guardam os limites exteriores para a pesquisa indexada; a medição usa o array confirmado. A pesquisa de conflitos verifica o recibo antes de libertar as pausas. Se a prova estiver danificada, conserva o bloqueio do intervalo exterior e assinala revisão.
- O índice de sobreposições conserva duas identidades distintas por prefixo, mesmo quando uma declaração fornece vários intervalos. A própria identidade tipada é excluída; outro serviço não fica oculto por intervalos repetidos.
- A projeção de trabalho nova tem versão 2 e incorpora os intervalos exatos e a declaração original. A fonte financeira usa versão 9 para despesa simples e 10 para parcela distribuída. As fontes anteriores 6/7 permanecem inalteradas; a versão 8 dos materiais é preservada.
- Custos simples, parcelas de documentos e bases compostas usam a mesma soma, os limites do período pago, o técnico confirmado, os segundos disponíveis e os cêntimos partilhados. A última parcela continua a usar o remanescente do orçamento.
- Alterações de prova ou sobreposição no segundo intervalo assinalam o custo para revisão. Anular recursos mostra os custos afetados e conserva as atribuições originais; a anulação financeira permanece explícita e recuperável.

## Base de dados e interface

A migração `20260924150000_reminder_multiple_intervals` estende duas restrições de `ExpenseAllocation`, admitindo as versões 9/10 com projeção 2 e o array idêntico ao comprovativo. Não altera linhas existentes nem acrescenta tabelas. O total passa a 39 migrações; não há novas dependências.

O editor reutiliza os campos de intervalos, permite acrescentar/remover até ao limite, conserva rascunhos antigos e novos e repõe o consentimento após alterações. A revisão e o histórico mostram todos os intervalos. As despesas e bases compostas apresentam os tempos efetivos e a exclusão das pausas. O pedido perdido é recuperado sem nova escrita; a mudança de conta limpa os dados da sessão.

## Validação

- 501 testes unitários em 72 ficheiros e quatro testes técnicos aprovados; sintaxe 616 backend / 215 frontend / 62 scripts inline.
- Novo grupo integrado com API real e dois processos HTTP: limites, formatos incompatíveis, idempotência, transação atómica, coexistência com o formato antigo, pausas livres, prova danificada, sobreposição no segundo intervalo, despesas simples/distribuídas/compostas e anulação com preservação dos custos.
- Caso financeiro com 60 segundos efetivos contra 340 decorridos; orçamento partilhado de 100 cêntimos repartido em 33/33/34; composição de despesa e parcela em 20 + 33 cêntimos.
- Navegador real: adicionar/remover intervalos, rascunho após recarregar, confirmação, resposta perdida e recuperação por consulta, prova financeira de várias parcelas, rejeição de dados adulterados, isolamento de conta e larguras 320/390/1440, incluindo modo escuro. Capturas inspecionadas.
- Migração local: esquema anterior recuperado, 39 migrações aplicadas, linhas e comprovativos legados preservados, rejeição das combinações inválidas e equivalência com o esquema atual. O CI nativo deverá repetir o percurso desde o commit histórico.
- Seis regressões dirigidas aprovadas: recursos, trabalho e materiais independentes; intervalos associados; trabalho de reparações; parcelas compostas de trabalho.
- Runner com 222 grupos; cache `cristalwater-field-20260924-v134`. CI nativo e restauro deste lote ainda pendentes nesta versão documental.

## Limites e continuação

Uma declaração ativa continua a abranger o conjunto dos intervalos; o orçamento pago e o destino histórico mantêm os limites existentes. Os múltiplos intervalos próprios do equipamento, repartições entre meses e revisão histórica de registos antigos sem recibo verificável permanecem próximos passos. Receita/custo integrais, lucro, produção, fornecedores reais e piloto físico não ficam concluídos por este lote.
