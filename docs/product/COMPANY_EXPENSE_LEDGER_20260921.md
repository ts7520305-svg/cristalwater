# TASK281 — Despesas e contas a pagar

Data: 21/09/2026. Branch: `work/field-readiness-20260915-simulation`. Base publicada e validada: `d3e3054a68e2484035319f4be00ca9cd92e9ed9b` (TASK280). Implementação publicada e aprovada no CI completo; resultados abaixo.

## Comportamento

A administração tem uma nova entrada Financeiro → Despesas e contas a pagar, em `/admin-expenses`, e uma API autenticada em `/api/expenses`. Regista obrigações confirmadas com fornecedor/beneficiário, descrição, documento, categoria, data e vencimento opcional. Totais em cêntimos inteiros; cada montante pode ir até 21 474 836,47 €. Há edição com motivo, anulação sem pagamentos válidos e reabertura explícita. Não há eliminação pelo percurso público.

Os documentos do mês, pagamentos registados no mês e saldos atuais de todos os meses têm bases distintas. As listas são paginadas de dez em dez, mas os totais incluem todos os registos relevantes. Fontes alteradas ou montantes incompatíveis deixam os totais afetados por confirmar. Vencimentos em falta são assinalados; não são inventados a partir da data de uma tarefa.

Podem ser revistas e ligadas compras de `StockPurchase`/`StockPurchaseItem` ou custos de `VehicleMaintenanceRecord`. O registo financeiro conserva uma fotografia da origem e o histórico das revisões. A ligação não altera as compras, inventário ou tarefas. Uma origem já ligada aponta para a despesa existente; uma alteração posterior exige revisão antes de novos pagamentos. Um total confirmado diferente do valor apurado exige motivo. Valores de uma manutenção podem ser estimativas e precisam de confirmação documental.

O fornecedor e número do documento são normalizados por espaços, acentos e maiúsculas para prevenir repetição exata. A verificação não identifica fornecedores equivalentes por NIF nem números diferentes do mesmo documento. Compras e manutenções têm também uma relação única no banco de dados, incluindo despesas anuladas.

Pagamentos parciais representam pagamentos já efetuados; a aplicação não faz transferências. Uma correção anula apenas o registo e conserva o motivo, sem reembolso bancário. O saldo não pode ser ultrapassado e o total da despesa não pode ficar abaixo dos pagamentos válidos.

## Pedidos, comprovativos e acesso

Cada comando tem UUID, titular ADMIN, conteúdo e versão da despesa. A confirmação e os efeitos são gravados na mesma transação. Bloqueios de pedido, origem e documento, bem como a versão da despesa, protegem pedidos concorrentes. A mesma conta pode consultar ou repetir o pedido original e receber a mesma confirmação. Recusas de estado têm uma confirmação durável. Falhas inesperadas não deixam registos parciais.

O navegador guarda o pedido e o anexo em IndexedDB antes de enviar. Uma falha de armazenamento bloqueia o envio. Uma resposta perdida ou incompleta deixa o pedido recuperável nesta conta, com consulta, repetição manual do original ou cancelamento no servidor. Não há reenvio automático. Cancelar um pedido pendente impede a sua aplicação futura se ainda não foi executado; se já foi aplicado, devolve a confirmação existente. Mudar conta, mês ou despesa invalida respostas antigas. Rascunhos e pedidos são separados por ADMIN; outros rascunhos do navegador são preservados.

Os comprovativos PDF/PNG/JPEG, até 5 MiB, ficam em `ExpenseEvidence.bytes`, com tamanho e SHA-256. O histórico admite vinte anexos por despesa, incluindo os anulados. O download é autenticado ADMIN, privado, sem cache e como anexo; o navegador confere contexto, tamanho e hash. Não há URL pública nem interpretação do ficheiro no ecrã. Anular um comprovativo retém os bytes no histórico e fecha o download público da API. Os documentos da compra original continuam no inventário e não são copiados automaticamente. O restauro integral inclui estes bytes na base de dados.

## Gestão com IA

A página e API de IA existentes recebem `finance.expenses` na mesma consulta financeira transacional. A interface mostra despesas e pagamentos mensais, saldos atuais por pagar/vencidos e ligação ao registo. As recomendações locais identificam contas vencidas e origens por rever; o fornecedor de IA opcional recebe os mesmos limites. A conversa financeira permanece apenas de consulta, sem comandos executáveis de pagamento, documentos ou preços.

Cobertura explícita: apenas despesas aqui registadas. Compra de stock, consumo de produtos, obrigação e pagamento não são medidas equivalentes. Não se apuram ainda custos operacionais completos, alocação por cliente/visita/viatura, lucro/margem, saldo bancário ou previsão de tesouraria. A faturação fiscal com IVA permanece no programa externo. Preços e frequências variam por cliente, época e instalação.

## Migração e verificação

Migração aditiva `20260921220000_company_expenses`: quatro tabelas novas (`CompanyExpense`, `ExpensePayment`, `ExpenseEvent`, `ExpenseEvidence`), relações e índices, sem reescrever dados antigos. Há restrições de montante positivo, origem válida, categoria, meio de pagamento, correção com motivo, tamanho e tipo de anexo. É a 23.ª migração desta sequência; o teste de atualização conserva as compras/manutenções antigas e verifica o esquema atual. Cache frontend v97.

Validação local já concluída: API de despesas, interface real em 320/390/1440 px e contraste em modo escuro, API/interface financeira anterior, 396 testes unitários em 63 ficheiros e quatro testes técnicos. Os testes novos cobrem concorrência, documentos/origens repetidos, alteração da origem, pagamentos parciais/correções, rollback após falha, comprovativos, resposta perdida, recuperação após recarga, cancelamento durável, repetição do mesmo pedido, respostas malformadas, falhas de armazenamento, sessão e respostas antigas. O contraste da página foi corrigido após a primeira verificação visual. Sintaxe aprovada (569 ficheiros backend, 187 frontend e 57 scripts inline); os 21 scripts de navegador gerais passaram. A atualização de uma base vazia com o esquema anterior pelas 23 migrações passou, conservando dados e correspondendo ao Prisma atual. Registos locais: `/tmp/cw281-final.log`, `/tmp/cw281-focused2.log`, `/tmp/cw281-migration.log`, `/tmp/cw281-unit.log`, `/tmp/cw281-tech.log`, `/tmp/cw281-syntax.log` e `/tmp/cw281-browser.log`. CI PostgreSQL 16 e restauro também aprovados, conforme os resultados de publicação abaixo.

Próximas evoluções: completar a recolha de custos e a sua atribuição antes de calcular rentabilidade; depois previsões de tesouraria com hipóteses verificáveis. Reconciliação dos emails anteriores continua separada. Esta implementação não instala nem ativa serviços no VPS, bancos, emissão fiscal, notificações ou fornecedor real de IA.

## Publicação e validação nativa

Commit `19a775683a2154dce11e9363cb753a43522096e2`, árvore `8eb2b03030f84645c69f95caeb5f22782618d2d1`, 23 ficheiros; publicação sem força na mesma branch autorizada. A árvore remota coincide exatamente com a validada localmente. Backup local `backup/company-expenses-local-20260921` (`6733008e85944a230803b21093deb57312e54c52`). A branch principal permanece em `6f27081e1d183ff584a62255b016b373836734db`, ancestral desta alteração; não foram detetadas divergências na publicação.

[CI 35655183457](https://github.com/ts7520305-svg/cristalwater/actions/runs/35655183457), job `106516851679`, concluído com sucesso em 21/09/2026 às 21:25:36 UTC, duração 19m14s. Os logs verificam 167 grupos distintos, todos com código zero e sem sinal de erro; 396 testes unitários em 63 ficheiros, quatro técnicos, 21 scripts gerais de navegador e 23 migrações. Sintaxe: 569 backend, 187 frontend, 57 scripts inline. API de despesas: 1764 ms; interface de despesas: 7038 ms; regressão financeira: API 3937 ms, interface 11341 ms. O restauro PostgreSQL 16 confirmou 115 tabelas e 46 ficheiros, com linhas e hashes iguais. Os comprovativos novos fazem parte dos dados restaurados da base de dados.

Esta atualização de encerramento altera apenas este documento e o checkpoint; conserva o código e testes aprovados. O ambiente de execução local ficou indisponível após a publicação do código, pelo que o encerramento foi registado diretamente no GitHub. A próxima sessão deve atualizar a cópia local a partir desta branch, preservando e reconciliando eventuais notas de validação locais. Não houve merge nem instalação no VPS, movimentos bancários, contactos, emissão fiscal ou chamadas a fornecedor real de IA.
