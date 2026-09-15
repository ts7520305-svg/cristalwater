# TASK122 — Recuperação das entradas, transferências e consumos

O inventário guardava apenas identificadores de repetição. Depois de recarregar a página, o operador tinha de reconstruir os dados e escolher novamente o anexo. Uma resposta HTTP 200 com JSON inválido também podia ser tratada como sucesso. A transferência usava apenas o nome como valor da opção, confundindo produtos com o mesmo nome em unidades diferentes.

## Comportamento entregue

- Os três formulários guardam o pedido completo em IndexedDB antes do envio, incluindo os bytes e o nome do anexo da compra. Existe um pedido pendente por conta administrativa e tipo de movimento.
- Um pedido pendente apresenta os dados guardados e bloqueia alterações. Reabrir a página recupera esse pedido sem o enviar automaticamente. «Repetir confirmação» envia os mesmos dados, identificador e anexo.
- Só uma resposta estruturada com os registos confirmados permite retirar o pedido e limpar o formulário. Falhas de ligação, JSON inválido e confirmações incompletas mantêm o pedido.
- Uma recusa explícita do servidor fica guardada. «Corrigir pedido recusado» consulta novamente o inventário e recupera os campos e o ficheiro para revisão; o envio corrigido recebe outro identificador.
- Web Locks e operações transacionais de IndexedDB protegem contra envios concorrentes e substituição do pedido noutra janela. Falhas de armazenamento impedem o envio; registos locais inválidos são mantidos e bloqueiam novos movimentos.
- A conta e a credencial são verificadas antes e depois das operações assíncronas. Mudar de sessão oculta o inventário e preserva os pedidos da conta original.
- As opções de transferência identificam o par produto/unidade. A atualização reúne saldos, produtos e viaturas; uma falha impede novos movimentos até uma consulta válida.
- Os identificadores pendentes do formato anterior são reutilizados quando os mesmos dados permitem reconstruir a chave antiga. O formato anterior não continha dados/anexos recuperáveis: não é possível inventá-los durante a atualização.

## Verificação

`scripts/test-inventory-writes-browser.js` cobre nove cenários: perda de resposta e recuperação explícita após reload; JSON inválido; confirmação incompleta de consumo; recusa e correção; recuperação de fatura com bytes iguais; armazenamento indisponível/corrompido; duas janelas; resposta tardia após mudança de conta; falha de atualização. O cartão da fatura é verificado a 320, 390 e 1280 px. O script integra `npm run test:field-browser`.

`scripts/test-field-e2e.js` usa o servidor e a base de dados reais do ambiente QA. O servidor executa cada movimento e o navegador perde a primeira resposta; após recarregar, repete a confirmação. O teste exige duas chamadas por operação, um único movimento/compra, saldo correto, uma única cópia do anexo e bytes idênticos. Uma segunda unidade do mesmo produto permanece sem alteração.

Verificação local: 216 testes unitários, 4 testes de técnicos, os 16 scripts de navegador e os 32 grupos integrados aprovados (`reports/field-suite/1789466398351/results.json`). Sintaxe aprovada nos 484 ficheiros backend e nos ficheiros JavaScript alterados. A versão final do E2E, com espera explícita da confirmação após reload e contagem das duas chamadas, é verificada separadamente em `field-qa-runtime/run-1789466551008`. Base local descartável PGlite; PostgreSQL 16/migrações/restauro exigem o workflow do commit final antes da declaração de aprovação. Não usar um workflow anterior como prova desta alteração.

## Limites e ficheiros

Os pedidos ficam neste navegador; apagar os dados do site elimina a recuperação local. Não existe sincronização de rascunhos entre dispositivos. IndexedDB, Web Locks e contexto seguro são necessários; navegador sem suporte não envia novos movimentos. Os formulários só registam depois de uma consulta online válida e não constituem um novo modo geral de trabalho offline. Ensaios em telefone físico e VPS continuam pendentes.

O contrato das APIs, as transações/idempotência do servidor e o formulário de contagem física são preservados. Não há migrações nesta tarefa. Ficheiros: `frontend/admin-inventory.html`, `frontend/admin-inventory.js`, `frontend/cw-inventory-pending.js`, `scripts/test-field-e2e.js`, `scripts/test-inventory-writes-browser.js`, `package.json`, este relatório e `CURRENT_WORK_CHECKPOINT.md`.
