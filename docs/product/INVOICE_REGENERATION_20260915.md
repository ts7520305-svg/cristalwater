# TASK149 — Geração sem substituir faturas existentes

## Reprodução

Os percursos core, core legado e operacional usavam `upsert`, seguido de eliminação e recriação de linhas, fora de uma transação única. A proteção anterior do core só recusava uma repetição quando os valores e as referências coincidiam. Uma alteração de preço ou um novo serviço permitia substituir documentos já pagos ou emitidos.

Em `field-qa-runtime/run-1789495368206`, uma fatura PAID de 120 EUR foi regenerada com total 131 EUR, consumindo os 10 EUR de crédito disponíveis. A API respondeu 200. Esta alteração silenciosa de um documento pago foi a falha reproduzida.

## Comportamento corrigido

Os três routers delegam agora no controlador `invoiceGenerationController` e no negócio `InvoiceGenerationBusiness`:

- `POST /api/core/invoices/generate`
- `POST /api/core/invoices/generate-legacy`
- `POST /api/operational-flow/generate-monthly-invoice`

Se já existe qualquer fatura para o cliente/mês, devolvem 409, código `INVOICE_ALREADY_EXISTS`, mensagem de orientação e o documento existente. Não mudam linhas, pagamentos, estado, crédito, datas, referências externas ou indicadores de faturação dos serviços. A regra aplica-se também a PENDING, rascunhos e documentos retirados. Acrescentar serviços ou corrigir um documento existente exige uma ação financeira explícita; «gerar» deixou de servir como substituição silenciosa.

Uma nova geração usa uma transação única com os bloqueios cliente/mês e de distribuição de recebimentos já usados pelas TASK145/TASK148. O cliente é relido sob `FOR NO KEY UPDATE`, incluindo a configuração do plano. A existência da fatura é verificada novamente depois desse bloqueio. A escrita usa `create`, não `upsert`; uma colisão com outro gerador na chave única não pode substituir o documento vencedor e é apresentada como 409 quando este existe.

Fatura, linhas, crédito/pagamento, comunicação e indicadores dos serviços ficam confirmados em conjunto. Falhas deixam o estado anterior intacto. Leituras de fontes que falham deixam de ser transformadas silenciosamente em listas vazias. A resposta de sucesso contém a fatura final depois da aplicação do crédito, mantendo os campos de cada percurso (`lines`, `next` ou `nextStep`).

Os planos explícitos continuam a usar o cálculo comum. Sem plano, mantêm-se as bases de preço dos percursos: core/legado somam cliente e piscinas; operacional usa o valor legado do cliente. As categorias de cobrança mantêm-se: core inclui serviços e extras; legado/operacional incluem mensalidade e reparações. Valores são somados em cêntimos; fontes negativas ou fora do intervalo seguro são recusadas antes da escrita.

O percurso operacional passa a marcar apenas visitas concluídas do mês pedido. Visitas extra já marcadas como faturadas não são selecionadas. Os indicadores são alterados com pré-condição `billed: false` e contagem verificada: uma fonte assumida por outra operação é omitida se já estava faturada ao consultar, ou provoca rollback se mudou entretanto. Não se marca uma visita de outro mês só por gerar a mensalidade atual.

## Testes e evidência

- Primeiro ensaio corrigido: `field-qa-runtime/run-1789495572877`, quatro grupos aprovados (regeneração, planos, orçamentos e mês operacional completo).
- Regressão alargada: `field-qa-runtime/run-1789495742061`, sete grupos de regressão aprovados, incluindo 24 meses, 72 faturas e 144 pagamentos parciais. O novo teste de concorrência exigia inicialmente 409 em ambas as ordens de execução; foi ajustado para aceitar também a exclusão correta da fonte quando a outra operação confirma antes da consulta.
- Ensaio final do teste revisto: `field-qa-runtime/run-1789495855834`, aprovado. Inclui sete estados históricos em cada um dos três percursos, identidades originais de linhas/pagamentos, nove chamadas concorrentes entre APIs, recebimento durante geração, fontes negativas, quatro falhas de escrita forçadas, fontes assumidas concorrentemente e fatura criada por outro gerador.
- Sintaxe de 502 ficheiros backend aprovada; 323 testes unitários em 58 ficheiros e quatro testes de técnicos aprovados. O runner inclui o novo grupo e passa de 53 para 54 grupos. O workflow da árvore final publicada deve confirmar PostgreSQL 16 e restauro; PGlite local não comprova desempenho de produção.

Oito ficheiros: negócio e controlador novos, dois routers, teste de integração, runner, este relatório e `CURRENT_WORK_CHECKPOINT.md`.

## Limites e continuação

Sem migração de esquema, edição de documentos reais, emissão fiscal, instalação no VPS ou merge para `main`. Não foi criado um estorno nem um editor de correções. Reparações continuam sujeitas às regras legadas de elegibilidade; rever separadamente referências já cobradas noutros meses. Os percursos `invoiceRoutes`, ativação de contrato e notas de crédito também conservam pendências próprias; não declarar todo o módulo financeiro concluído.
