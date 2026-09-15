# TASK157 — Pagamento ligado à reparação e transação única

A reprodução `field-qa-runtime/run-1789502099698` confirmou que o pagamento de uma reparação aceitava uma fatura de outro cliente. O negócio não verificava a origem e chamava o registo financeiro através de uma transação independente.

O percurso bloqueia a fatura, cliente e reparação nessa ordem e exige correspondência entre cliente e linha REPAIR/referenceId. Finance OS aceita a transação fornecida: dinheiro, excedente em crédito, estado da reparação, histórico técnico, auditoria, notificação e confirmação são gravados em conjunto. Os eventos existentes são emitidos após commit quando este negócio controla a transação. Uma transação fornecida pelo chamador não emite eventos antecipadamente.

Pedidos com UUID conservam a confirmação original vinculada à reparação, fatura e responsável. Reenvios parciais ou totais não repetem dinheiro nem histórico. Uma reparação já paga recusa novos recebimentos pelo percurso dedicado; o registo geral de cliente continua disponível. Integrações antigas sem UUID mantêm compatibilidade, sem garantia de deduplicação de dois pagamentos parciais indistinguíveis. Faturas históricas sem referência de origem exigem revisão explícita.

Em `field-qa-runtime/run-1789502197709`, passaram as recusas de cliente/origem errados, pagamento parcial, oito repetições simultâneas, alteração de valor, excedente em crédito e reversão após falha no estado da reparação. O adaptador PGlite fechou uma ligação depois da falha forçada, provocando 401 na autenticação do reenvio. A exigência de 200 foi conservada para validação em PostgreSQL nativo; não se alterou o teste para aceitar a limitação local. Os três grupos de regressão passaram: Repair OS operacional, repetição de pagamentos e notas de crédito.

O teste final também exige reversão de falhas em histórico técnico, auditoria e notificação. Runner com 62 grupos. Sete ficheiros: dois negócios, controlador, teste, runner, relatório e checkpoint. Sem migração. Confirmar o workflow final antes de considerar os quatro cenários de falha integralmente aprovados.
