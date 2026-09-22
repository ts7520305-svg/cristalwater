# TASK289 — Confirmação explícita da execução das reparações

## Âmbito

Continuação autorizada da TASK288, com instrução adicional “Corrige e continua”. Base `a4f0e39afbf0ba98599ac58cbbe1d0d12fdce7cf`, branch `work/field-readiness-20260915-simulation`. A faturação fiscal com IVA mantém-se externa e os valores/frequências dependem do cliente, contrato e época.

Foi reproduzido um defeito no percurso existente `PUT /api/repairs/:id/complete`: aceitava uma reserva RESOLVED e consumia o stock novamente, com HTTP 200. O consumo não verificava o estado da reserva, a conclusão não bloqueava a origem e chamadas internas com o cliente Prisma completo não abriam uma transação. O registo anterior de conclusão também não conservava toda a identidade original. `/tmp/cw289-first-execution.log` preserva a reprodução anterior à correção.

Esta etapa corrige esse percurso e acrescenta uma declaração autenticada de conclusão à Gestão com IA. É uma confirmação registada no sistema, com evidência de origem e stock; não é verificação física independente. A data é a do registo da confirmação, não uma data histórica de trabalho inferida. Não acrescenta um novo formulário de execução nem reconcilia automaticamente os históricos.

## Integridade da conclusão

- A conclusão abre uma transação também quando recebe o cliente Prisma completo. Bloqueia cliente, reparação, piscina e reserva, mantendo a ordem cliente → reparação → piscina usada pela faturação; verifica novamente as identidades depois dos bloqueios.
- Exige uma única reserva APPROVED, com cliente/piscina/reparação coerentes no registo e no conteúdo original, e itens válidos. RESOLVED, CANCELLED, estados desconhecidos, reservas repetidas, mudança de titular e dados incompatíveis exigem revisão. Os bloqueios de saldo existentes e a ordem estável dos itens protegem o consumo.
- Stock, movimentos, reserva, estado/data, histórico, auditoria, confirmação e notificações internas são gravados em conjunto. Os auxiliares que ocultavam erros deixaram de ser usados neste percurso. Falha em qualquer gravação reverte o conjunto; erros privados não saem na resposta.
- A conclusão autenticada guarda `REPAIR_EXECUTION_CONFIRMED` em `AuditTrail`, entidade Repair, com cliente/piscina/reparação originais, origem operacional, autor autenticado, data, reserva resolvida, movimentos exatos e hash canónico. A origem operacional não inclui preços: a confirmação de execução é distinta do preço documental já preservado pela TASK288.
- Pedidos repetidos ou simultâneos recuperam a confirmação válida, sem alterar a data, consumir stock novamente ou repetir eventos. A recuperação após falha de resposta posterior ao commit também preserva o resultado. Evidência alterada não é substituída automaticamente.
- Eventos existentes são emitidos depois do commit, uma vez. Uma transação fornecida por outro chamador não emite eventos antes do seu commit. O controlador conserva as permissões existentes ADMIN/TECHNICIAN; a resposta operacional do técnico continua sem preços, notas comerciais ou dados do cliente.
- Campos enviados para simular autor, cliente ou data não alteram a identidade capturada. Chamadas internas antigas sem identidade autenticada conservam a conclusão operacional, mas não criam o novo comprovativo financeiro. DONE/CLOSED antigos, pagamento, emissão e fecho administrativo não recebem confirmações retroativas.

## Leitura financeira e interface

`revenueCoverage` versão 5 mantém as sete parcelas documentais e acrescenta `repairExecution`, um subconjunto de `repairDocumentedAmountCents`. Contagens e valores completos distinguem CONFIRMED, UNCONFIRMED e REVIEW. Não acrescentam receita aos documentos ou recebimentos.

Uma confirmação válida exige identidade original compatível com o documento, origem operacional estável, uma única prova com hash e autor válidos, data original de conclusão e estado DONE/INVOICED/CLOSED. Reserva e movimentos devem existir e corresponder aos dados guardados. Fontes ausentes, duplicadas ou alteradas deixam a confirmação por rever; sem comprovativo fica por confirmar, com datas nulas.

Mudar o nome/proprietário atual da piscina, desativar o cliente ou alterar posteriormente o saldo de stock não transfere nem reescreve a confirmação histórica. A conciliação documental continua a exigir a linha e os dados comerciais originais da TASK288. Alterações comerciais após a faturação continuam por rever nesse nível.

A amostra é explicitamente limitada a dez linhas, com totais completos. Revisões fora da amostra também afetam o estado financeiro. A interface valida bases, datas, estados, contagens, valores e correspondência entre amostra e totais; mostra a data em UTC. A IA local e o contexto do modelo distinguem declaração de execução, fecho administrativo, mês documental e mês do registo da confirmação. A leitura/conversa não escreve em faturas, pagamentos, comprovativos ou stock. Falha na consulta da evidência deixa o contexto financeiro indisponível e impede a chamada externa.

## Validação

- API: reserva já consumida/cancelada/desconhecida, autenticação, resposta de técnico, recusa de cliente, IDs inválidos, autor/data enviados no corpo, seis pedidos concorrentes, recuperação de resposta perdida, históricos, titular alterado, duplicados e reserva adulterada. Ensaios de falha em movimento, reserva, reparação, histórico, auditoria, notificação, novo comprovativo e notificação posterior ao comprovativo confirmam rollback integral e recuperação.
- Conciliação: documento/cliente originais, declaração posterior em mês diferente do documento, progressão administrativa sem nova execução, datas/reservas/movimentos/comprovativos ausentes, alterados ou repetidos, categoria distinta com mesmo ID, saldos posteriores independentes, totais além de dez linhas e revisão fora da amostra. Conversas local/modelo simulado e fonte indisponível verificadas.
- Interface real: os três estados de execução, texto literal, respostas malformadas, contas/mês/sessão, offline e respostas atrasadas; 320/390/1440 px e modo escuro. Imagens `reports/field-visual/financial-ai-1790095899114/repair-execution-320.png` e `repair-execution-1440.png` revistas.
- Regressões aprovadas: faturação atómica de reparação, reserva mensal entre percursos, pagamentos, IA, cobertura documental, repartição mensal API/UI, receitas de manutenção e percurso operacional completo da reparação.
- 396 testes unitários/63 ficheiros; sintaxe 581 backend/190 frontend/58 inline. Dois grupos novos no runner: 179 no total. Cache v105, sem esquema, migrações ou dependências novas; permanecem 26 migrações e 119 tabelas.
- Evidência local: `/tmp/cw289-final-execution.log`, `/tmp/cw289-revenue.log`, `/tmp/cw289-final-regressions.log`, `/tmp/cw289-ui-regression.log`, `/tmp/cw289-unit.log` e `/tmp/cw289-syntax.log`. O ensaio agrupado intermédio encontrou uma ligação PGlite fechada após falhas forçadas, refletida pelo middleware num 401 (`UnexpectedMessage`/`Server has closed the connection`). Os ensaios finais com novas instâncias passaram, mantendo as asserções. O ensaio inicial de texto também conservou a distinção explícita de que o comprovativo documental não prova execução física.

## Publicação

Revisão do contrato de eventos após a primeira publicação `e40e6d4abf5818bf97411c8addd1b021e4bc487b`: os eventos financeiro e de conclusão conservam exatamente os campos anteriores, sem acrescentar itens ou identidade do cliente a novos canais. Acrescentado ensaio de campos exatos, emissão única e recuperação sem novo evento. A aprovação final deve corresponder à árvore desta revisão, não apenas ao primeiro CI `35757521043`.

Revisão final publicada sem força em `work/field-readiness-20260915-simulation`: commit `461d3375581d4b7fb9fd02c3bd1f5118fa66e6f2`, árvore `540eb65de45de318482298414839d1118e2d0861`. Dezanove ficheiros alterados desde a base da TASK288; cache v105, sem esquema, migrações ou dependências novas. Cópias locais preservadas em `backup/repair-execution-local-20260922` (`36507887cae57a8ab460da971164226645f742fc`) e `backup/repair-execution-events-local-20260922` (`c0d71d1284bdedc895b8858dbceca5152cca1633`).

[CI final 35758065575](https://github.com/ts7520305-svg/cristalwater/actions/runs/35758065575), job `106848768060`, aprovado no commit final acima: 17 etapas com sucesso, de 17:02:28 a 17:24:10 UTC de 22/09/2026, duração 21m42s. Registos completos confirmam 179/179 grupos distintos com código zero e sem sinal, 396 testes unitários/63 ficheiros, quatro testes de técnico e gate geral do navegador. As 26 migrações aditivas preservam os dados anteriores e correspondem ao esquema atual; sintaxe 581 backend/190 frontend/58 inline aprovada. Restauro PostgreSQL 16 aprovado: 119 tabelas e 46 ficheiros, com linhas da base de dados e hashes dos ficheiros iguais.

O novo grupo de conclusão passou em 1546 ms, incluindo concorrência, recuperação, rollback e contrato exato dos eventos; a conciliação da execução passou em 18912 ms. IA API/UI em 7163/21182 ms e percurso operacional antigo da reparação em 375 ms. Faturação atómica, reserva mensal, pagamentos, cobertura documental/custos, repartição mensal, manutenção e E2E também aprovados. Evidência consolidada em `/tmp/cw289-ci-evidence.json`; último ensaio local dos eventos em `/tmp/cw289-final-events.log`. O primeiro CI `35757521043` também terminou com sucesso, mas a aprovação desta etapa assenta na revisão final.

O encerramento documental altera apenas este documento e `CURRENT_WORK_CHECKPOINT.md`, preservando o código validado. Principal ancestral e inalterada em `6f27081e1d183ff584a62255b016b373836734db`; sem merge, deploy ou contactos reais.

Próximo âmbito: tornar a confirmação de execução acessível no percurso operacional adequado, com contexto e recuperação de pedidos, incluindo trabalhos sem consumo de material quando houver regra explícita. A data histórica da execução, restantes origens/ajustes e custos completos continuam por estabelecer antes de margens ou previsões. Não usar a nova confirmação para preencher períodos históricos automaticamente.
