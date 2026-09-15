# TASK140/TASK141 — Pagamentos sem duplicação por repetição

## Problema reproduzido

Em `field-qa-runtime/run-1789485522002`, repetir duas vezes o mesmo pedido de 10 EUR criou dois pagamentos nos quatro percursos: pagamentos manuais de fatura, Core, Finance OS e fluxo operacional. Um excedente podia igualmente ser creditado de novo. O formulário não conservava a identidade do pedido após perda de ligação ou reload.

## API — TASK140

O `requestId` UUID identifica um recebimento. A transação bloqueia esse identificador, valida a fatura/responsável/valor/método/notas e guarda a confirmação original juntamente com o pagamento e crédito. Os quatro percursos partilham a identidade do pedido. Uma repetição devolve o resultado original; alteração dos dados ou do responsável devolve 409. A confirmação não é reescrita por pagamentos posteriores ou cancelamento da fatura.

Uma falha ao guardar a confirmação reverte pagamento, crédito, estado da fatura e registos transacionais de notificação/auditoria. Finance OS não volta a emitir o evento para um pedido já confirmado. Reutilizam-se os comprovativos internos existentes em `OperationalReminder`, sem migração.

Ensaio dirigido aprovado em `field-qa-runtime/run-1789485722445`, incluindo proteção dos rascunhos e Finance OS. O teste inclui oito pedidos simultâneos por percurso, doze entre percursos, excedente de 5 EUR registado uma vez, pedidos alterados/malformados, outro administrador e falha forçada na gravação do comprovativo. Commit remoto `737fa422ba3336515673a3f523ec0705572bc8bd`, workflow `34988224376`: 45 grupos aprovados e restauro de 99 tabelas/11 anexos com linhas e hashes coincidentes.

## Formulário — TASK141

- O formulário de faturas guarda o pedido antes de enviar. Se não conseguir guardar ou ler/verificar os dados, não envia.
- Bloqueio de cliques repetidos e coordenação entre janelas do mesmo navegador. Dentro do bloqueio, uma consulta recente confirma que o documento e o saldo correspondem ao formulário preparado. Um formulário antigo tem de ser revisto.
- Em caso de resposta perdida, mantém fatura, cliente, valor, método, notas e identificador. Depois de reabrir a página, permite `Confirmar pagamento guardado`. A repetição usa exatamente o pedido original.
- A confirmação recebida deve corresponder ao pedido, responsável, fatura, cliente e valores aplicados/crédito em cêntimos. Resposta incompleta, trocada ou inconsistente não elimina o pedido guardado.
- Rejeições explícitas requerem `Rever pagamento` e consulta recente antes de outro recebimento. Uma falha de consulta após confirmação mantém o pagamento confirmado e bloqueia novos pagamentos até atualizar o saldo.
- Mudança de sessão oculta a informação da conta anterior e ignora respostas tardias. O pedido dessa conta mantém-se disponível quando o mesmo responsável regressar. Os tokens não são guardados no pedido.
- O painel usa texto literal e cabe a 390 px. Campos e confirmação ficam bloqueados durante a operação; Cancelar não cancela um pagamento já enviado.
- A inspeção visual encontrou os estilos comuns da navegação em falta nesta página. Foram ligados os dois estilos existentes e corrigidos, apenas nesta página, o posicionamento da navegação e do formulário sobreposto. O espaço do cabeçalho acompanha a sua altura real. O teste verifica a navegação a 390/1440 px e o formulário fixo.

## Verificação

`test-field-payment-retry-ui.js` usa a API real e Chromium: resposta perdida após commit, dois separadores, cliques repetidos, reload, confirmações falsas/alteradas, formulário antigo, saldo indisponível, quota/corrupção de armazenamento, sessão alterada e rejeição posterior à consulta. A bateria passa a 46 grupos.

O ensaio `run-1789486255246` passou a interface, mas o teste de API seguinte terminou com código 1 sem diagnóstico no log. O executor local passou a aguardar o fecho dos streams antes de fechar o log; a mesma sequência voltou a passar em `run-1789486330484`. Não se atribui essa ocorrência a uma causa funcional confirmada. A revisão final inclui também confirmação com cliente incorreto e repete os testes relevantes; a aceitação depende do CI do commit final com 46 grupos e restauro.

O ensaio `run-1789486414360` passou a interface, a API e a visibilidade dos rascunhos. Revelou uma espera insuficiente no teste estático: tanto o filtro de rascunhos como o de pagos tinham uma linha, pelo que a espera por contagem aceitava a lista anterior. O teste passou a esperar os identificadores exatos dos documentos. A revisão final da interface, navegação e filtros passou em `run-1789486703205`. Sintaxe dos scripts, 322 testes unitários em 57 ficheiros e quatro testes de técnicos aprovados.

## Limites e retoma

A garantia da API depende de `requestId`. Integrações antigas sem esse identificador mantêm compatibilidade e precisam de atualização própria. Esta tarefa liga o novo mecanismo ao formulário de faturas; o recebimento geral por cliente e os outros formulários financeiros ainda precisam da mesma revisão. Dois pagamentos deliberadamente diferentes mantêm identificadores diferentes. Não se deduz identidade só por coincidirem cliente, data e montante.

O evento pós-commit do Finance OS mantém o transporte existente; não foi criada uma fila durável de eventos. A recuperação depende de conservar os dados do navegador. Dados guardados ilegíveis ficam bloqueados para revisão. Não houve emissão fiscal em produção, instalação no VPS, mensagens externas ou merge na principal.

Ficheiros da TASK141 (7): `frontend/invoices.js`, `frontend/invoices.html`, `scripts/test-field-payment-retry-ui.js`, `scripts/test-invoice-draft-classification-browser.js`, `scripts/test-field-suite.js`, este relatório e `CURRENT_WORK_CHECKPOINT.md`.
