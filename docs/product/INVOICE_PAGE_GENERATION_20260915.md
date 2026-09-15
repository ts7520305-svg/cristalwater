# TASK150 — Geração e crédito na página de faturas

## Falha reproduzida

`POST /api/invoices/generate-for-client/:clientId` e `POST /api/invoices/generate-monthly` gravavam a fatura antes da transação que aplica crédito. Uma falha no pagamento, saldo ou comunicação podia devolver erro e deixar uma fatura parcialmente processada.

Em `field-qa-runtime/run-1789497083321`, uma falha forçada em `CommunicationLog` deixou uma fatura PENDING de 80 EUR, com linha mensal, sem o abatimento dos 10 EUR disponíveis. O teste esperava zero faturas e falhou com uma fatura gravada. A geração mensal em lote usava a mesma sequência separada.

## Alteração

As duas rotas delegam em `invoicePageGenerationController` e `InvoicePageGenerationBusiness`. Cada cliente é processado numa transação que inclui criação da fatura/linha, aplicação do crédito pelo serviço comum, pagamento CREDIT, saldo, comunicação e consulta da resposta final. Qualquer erro reverte todas essas escritas.

Os bloqueios de cliente/mês e distribuição de recebimentos são partilhados com os outros geradores. Para uma fatura existente, a ordem é fatura antes de cliente, compatível com pagamentos. O cliente e a identidade da fatura são relidos depois da espera. Se outro gerador criou ou trocou o documento durante a espera, a transação ainda sem escritas termina e repete com a ordem correta; há no máximo três tentativas. A chave única protege também contra geradores que não usam os bloqueios partilhados.

O contrato de sucesso mantém as mensagens e campos usados pelos ecrãs. A normalização da fatura foi extraída sem alterar a lógica para `invoiceViewService`, também usado pelas consultas existentes. Reabrir uma fatura continua a devolver 200 e a aplicar crédito disponível quando o documento permite cobrança, conservando preço, linhas, pagamentos anteriores, notas e referências externas. Documentos pagos, rascunhos ou retirados não consomem crédito. Uma alteração posterior do plano não recalcula uma fatura existente.

Novas faturas usam o plano explícito, quando existe. Sem plano, conserva-se a regra desta página: `monthlyFee`, ou a soma das piscinas quando esse valor é zero. `monthlyAmount` não substitui esta regra. O total novo é arredondado a cêntimos e valores negativos ou fora do intervalo seguro são recusados. Um mês gratuito continua a criar uma linha mensal de zero e uma fatura PAID, sem consumir crédito.

O lote mantém uma transação por cliente e passa a ordenar por ID. Se falhar num cliente, os anteriores permanecem completos; repetir o lote conserva esses documentos e retoma o cliente que falhou. O lote inteiro não constitui uma transação única. Desativar a faturação durante a espera impede a geração nesse cliente.

IDs e meses malformados são recusados com 400. O mês atual só é usado quando o campo não é fornecido; uma cadeia vazia ou `null` deixa de gerar silenciosamente no mês atual. Falhas internas devolvem uma mensagem genérica, sem detalhes do motor de dados.

## Verificação

O novo grupo `test-field-invoice-page-generation.js` cobre os dois endpoints, dez falhas de escrita, repetição depois de erro, resposta e consulta normalizadas, sete estados de documentos, mudança de plano, preços antigos/gratuitos, oito pedidos mistos simultâneos, recebimentos e pagamentos Finance OS concorrentes, outro gerador durante a espera, faturação desativada, recuperação do lote e acesso inválido.

Em `field-qa-runtime/run-1789497671868`, as dez reversões passaram e os grupos de planos, conservação de crédito, alinhamento mensal e regeneração foram aprovados. O novo grupo e duas regressões posteriores interromperam com 401 depois de o adaptador TCP do PGlite fechar ligações após erros forçados (`UnexpectedMessage`/`Server has closed the connection` na consulta do utilizador). O segundo ensaio `run-1789497786885` confirmou o problema do adaptador também em testes antigos; aumentar temporariamente a capacidade de ligações não o resolveu e foi desfeito. Não se alteraram testes ou autenticação para aceitar estes erros.

323 testes unitários em 58 ficheiros e quatro testes de técnicos aprovados. Sintaxe do teste verificada com `node -c` e verificação global aprovada em 505 ficheiros backend. A validação integral desta alteração exige o workflow da árvore publicada em PostgreSQL 16: 55 grupos, scripts de navegador, migrações aditivas e restauro. Os ensaios PGlite não são uma medição de desempenho do VPS nem substituem esse resultado.

Oito ficheiros do projeto: negócio, controlador e serviço de apresentação novos; router; teste e runner; este relatório e checkpoint. Sem migração de esquema.

## Limites e continuação

A operação não guarda uma confirmação imutável por pedido: reabrir mais tarde pode aplicar crédito entretanto recebido, como antes. Este trabalho protege a criação e o abatimento, sem alterar a intenção dessa ação.

Rever separadamente reparações referenciadas em faturas de outros meses, ativação de contratos e notas de crédito. Não foram alterados documentos reais, emissão fiscal, VPS ou `main`.
