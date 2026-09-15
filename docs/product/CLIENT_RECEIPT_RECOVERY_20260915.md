# Recuperação de recebimentos no ecrã de cobranças — TASK143

O formulário de cobranças passa a reunir cliente, dívida consultada, mês do recebimento, valor, método e nota. Cancelar ou Escape não envia pedidos. A confirmação explica a distribuição pelas faturas mais antigas e o crédito excedente. Foram removidas as ações individuais e em lote que marcavam pagamentos sem registar o dinheiro recebido; o servidor da TASK142 também recusa esse atalho.

Antes de enviar, o navegador consulta novamente o cliente e compara o saldo e a identidade apresentados no formulário. Mudança de mês, sessão, cliente ou saldo exige nova revisão. O pedido é guardado por conta antes do POST, com UUID, cliente, mês e valores imutáveis. Web Locks coordena as janelas da mesma origem/conta. Uma resposta perdida conserva o pedido e permite confirmar o mesmo recebimento após reload, mesmo que o cliente já tenha saído da lista de dívida.

A confirmação valida responsável, cliente, mês, valor, método, nota, parcelas aplicadas, faturas e pagamentos associados e crédito. Respostas ausentes, trocadas ou incoerentes não apagam o pedido. Uma rejeição explícita exige Rever recebimento e uma consulta bem-sucedida antes de o limpar. Quota de armazenamento impede o envio; dados guardados corrompidos são conservados e bloqueiam novos pedidos. A mudança de conta oculta os dados e conserva o pedido da conta original para recuperação posterior.

Uma consulta falhada conserva a lista anterior com indicação de que precisa de atualização, bloqueando novos recebimentos. Falha inicial apresenta valores desconhecidos, incluindo quando se mudam filtros. Respostas de consultas antigas não substituem o mês mais recente. A dívida vem das faturas cobraveis; mensalidade/reparações/visitas são informação separada do período. O crédito é identificado como disponível por aplicar, e os textos de aviso usam a dívida de faturas emitidas.

## Interface e validação

Os estilos comuns de navegação passam a estar carregados nesta página. O cabeçalho, navegação e formulário funcionam em 390 e 1440 px; o diálogo gere foco, Escape e cancelamento. A inspeção visual encontrou texto quase branco nos cartões, corrigido por estilos locais de contraste; o resumo usa duas colunas no telemóvel.

Ensaio dirigido final aprovado em `field-qa-runtime/run-1789488990249`: interface de recebimentos, regressão do formulário de faturas e API de recebimentos. O ensaio real de Chromium/API/base cobre cliques repetidos, duas janelas, resposta perdida após commit, reload, confirmações incorretas, pagamento parcial visível, formulário desatualizado, falha de consulta após pagamento, quota, corrupção, sessão alterada, mês alterado, resposta antiga, rejeição com revisão e excedente recuperado depois de o cliente desaparecer da lista. Não foram enviados avisos por canais externos.

`npm test`: 322 testes em 57 ficheiros aprovados; `npm run test:technician`: quatro aprovados; sintaxe dos ficheiros alterados aprovada. A TASK142 foi verificada no commit remoto `f16963ab5687f94cc8f7ce1180a696e253164035`, workflow `34993111118`, com 47 grupos e restauro de 99 tabelas/11 anexos. Esta TASK143 acrescenta o grupo 48; confirmar o workflow do commit final antes de declarar essa versão aprovada.

Ficheiros (7): `frontend/admin-collection.html`, `frontend/admin-collection.js`, `frontend/cw-client-receipt.js`, `scripts/test-field-client-receipts-ui.js`, `scripts/test-field-suite.js`, este relatório e `CURRENT_WORK_CHECKPOINT.md`.

## Limites

A recuperação local exige armazenamento e Web Locks num contexto seguro. Integrações antigas sem `requestId` continuam sem garantia de repetição. A revisão dos restantes formulários financeiros e da concorrência no consumo automático de crédito entre faturas diferentes é separada desta entrega. Sem migrações, merge da branch principal, emissão fiscal ou instalação no VPS.
