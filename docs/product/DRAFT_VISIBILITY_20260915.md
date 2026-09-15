# TASK137 — Rascunhos identificados e separados da dívida

## Reprodução

Em `field-qa-runtime/run-1789483176194`, o ecrã apresentou dois rascunhos como PENDENTE e somou 90 EUR em aberto, quando só existiam 40 EUR por cobrar. Um rascunho de 20 EUR e um documento cancelado de 30 EUR estavam a inflacionar a dívida. O total global incluía igualmente ambos. Os rascunhos apresentavam botões de pagamento e PDF, e um rascunho de zero EUR podia aparecer no filtro de pagos.

## Entrega

- Identificação explícita RASCUNHO, valor preparado e aviso de revisão, com filtro próprio e ligação direta `?status=draft`. O período `YYYY-MM` é apresentado como `MM/YYYY`.
- Rascunhos e documentos retirados deixam de contar nos totais de faturas, valores faturados ou dívida do ecrã. Não aparecem como pagos, pendentes ou devedores. Documentos emitidos/enviados continuam disponíveis nos filtros adequados.
- Pagamento apenas para um documento consultado e elegível com valor em aberto. Os rascunhos não expõem PDF de cobrança. Os manipuladores também validam o documento atual; o servidor da TASK136 continua a ser a proteção final perante alterações posteriores à consulta.
- A API de faturas usa a mesma regra de saldo aberto do serviço de crédito. O dashboard administrativo usa essa elegibilidade nos totais faturados, contagem de pagos, devedores e evolução mensal. O valor preparado original permanece disponível no documento.
- O registo geral de um adiantamento não marca o cliente parcialmente pago só por existir um rascunho. O crédito recebido mantém-se separado do documento por rever.
- Consultas falhadas ou malformadas conservam a última lista e os valores, com aviso. Sem consulta anterior, os indicadores ficam por confirmar. Respostas antigas são descartadas. Mudança de sessão fecha o formulário e retira os dados da conta anterior.

## Verificação

Ensaio dirigido final: `field-qa-runtime/run-1789483564490`, com classificação dos rascunhos, proteção dos pagamentos e regressão da faturação de alertas. Chromium a 390 px verifica os cinco documentos, valores exatos, texto literal, filtros, rascunho de zero, ausência de cobrança/PDF, navegação direta, recuperação de consulta, resposta antiga, alteração para rascunho depois de abrir o formulário e mudança de conta. A API/dashboard são comparados antes/depois da criação dos documentos e o adiantamento é verificado na base de dados.

A primeira versão do teste de resposta retida removia o manipulador antes de o libertar e provocava erro no Playwright. O teste final conserva-o até à resposta e permite que a consulta mais recente prossiga, verificando a proteção de geração do ecrã.

Sintaxe, 322 testes unitários em 57 ficheiros e quatro testes de técnicos aprovados. A bateria integrada passa a 43 grupos. Confirmar o workflow do commit final, incluindo os 17 scripts de navegador, PostgreSQL 16 e restauro. A TASK136 já passou no workflow 34982947007, commit `6e7a795a9ece95cec26dfff188f3a9b5fe2f25ba`, com 42 grupos e restauro de 99 tabelas/11 anexos.

## Limites

O filtro legado “Em atraso / devedores” mantém o significado de saldo em aberto, sem introduzir uma nova regra de vencimento nesta tarefa. A fila de documentos oficiais por emitir conserva a sua finalidade de revisão; não é um total de dívida. Outros relatórios com cálculos próprios continuam sujeitos a revisão individual. Este trabalho não implementa repetição idempotente de todos os pagamentos nem altera PDFs no servidor. O percurso novo foi ensaiado em português; não se afirma tradução integral. Não houve instalação no VPS, emissão fiscal em produção, mensagens externas ou merge na principal.

## Ficheiros (9)

- `frontend/invoices.html`
- `frontend/invoices.js`
- `src/routes/invoiceRoutes.js`
- `src/controllers/adminPaymentController.js`
- `src/controllers/dashboardController.js`
- `scripts/test-field-draft-visibility.js`
- `scripts/test-field-suite.js`
- `docs/product/DRAFT_VISIBILITY_20260915.md`
- `docs/product/CURRENT_WORK_CHECKPOINT.md`
