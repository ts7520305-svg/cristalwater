# TASK151 — Reparações sem repetição entre meses

Uma reparação DONE de 9 EUR, ainda não paga, era incluída em todas as mensalidades. A reprodução `field-qa-runtime/run-1789498840505` gerou 29 EUR em janeiro e novamente 29 EUR em fevereiro, em vez de 20 EUR no segundo mês.

Os três geradores core/core legado/operacional passam a consultar referências históricas antes de selecionar reparações. Uma linha REPAIR, identificada por `type` ou `lineType`, reserva a origem em qualquer mês, incluindo documentos avulsos, rascunhos e documentos retirados. Não se altera o estado pago da reparação para a excluir e não se reescreve o documento original. A reserva também é consultada quando mudou o cliente da piscina. O mesmo número numa categoria diferente não bloqueia a reparação.

Os bloqueios já partilhados por cliente e recebimentos serializam gerações de meses diferentes. Nove pedidos simultâneos nos três endpoints produzem uma única linha de reparação.

Quatro grupos aprovados em `field-qa-runtime/run-1789498874726`: o novo teste, preservação de faturas, orçamentos comerciais e mês operacional completo. O novo teste inclui as nove combinações entre geradores, sete estados de documentos, ambos os campos de categoria, história noutro cliente, isolamento de categorias e concorrência entre nove meses. O runner passa a 56 grupos; confirmar o workflow da árvore final em PostgreSQL 16.

Limite: esta tarefa protege a seleção mensal de referências existentes. O percurso dedicado de reparações perde atualmente a referência ao passar por `FinanceOsBusiness.createDraftInvoice` e usa transações financeiras separadas; é a próxima correção. Não foram inferidas referências a partir de descrições antigas nem alterados documentos históricos.
