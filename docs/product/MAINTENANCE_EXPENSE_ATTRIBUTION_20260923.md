# TASK302 — atribuição de despesas às manutenções

## Resultado

O ADMIN pode atribuir uma parcela manual de despesa a uma manutenção de equipamento concluída ou a um lembrete de serviço concluído. A seleção começa pelo cliente histórico e distingue as duas origens mesmo quando partilham o mesmo identificador numérico. Intervenções incluídas e extras com decisão comercial confirmada são elegíveis; o custo é sempre o montante explicitamente repartido do documento da despesa.

A confirmação exige a execução atual consistente com a decisão original, o cliente registado nessa decisão, motivo, mês e valor explícitos. O cliente pode estar inativo e a piscina pode ter mudado de titular. Uma conclusão de equipamento numa visita regular ou extra mantém identidade própria; a visita pode ainda estar em curso. A conclusão posterior da visita e a alteração do título atual do plano não mudam o custo histórico.

## Integridade e histórico

- `MAINTENANCE_EQUIPMENT` e `MAINTENANCE_REMINDER` usam identidades próprias em `ExpenseAllocation`. A migração 33 acrescenta duas colunas opcionais e índices, conserva os registos anteriores e reforça a exclusão mútua das identidades. Não acrescenta tabelas nem dependências. Sem FK para a origem: uma remoção conserva a atribuição e a fotografia para revisão/anulação.
- A fotografia liga a execução à decisão ADMIN confirmada e conserva o cliente, piscina, data, visita de origem e hashes da execução e decisão integral. Mudanças na execução, cliente original ou prova deixam a parcela por rever. Sem decisão histórica confirmada, a origem não é elegível.
- Não transfere duração, consumos, custos medidos ou preço da visita para a manutenção. Não calcula despesa a partir do valor comercial. Pagamento, cancelamento ou alteração da fatura não recalculam esta repartição manual; faturação e despesa continuam registos separados.
- Orçamento monetário partilhado entre todos os destinos e meses, uma parcela ativa por documento/destino/mês, bloqueios de despesa e origens, versão e recibo na mesma transação. Pedidos concorrentes ou repetidos não duplicam valores. Falhas na versão/auditoria revertem a atribuição.
- Revisão e anulação preservam os valores e identidade anteriores. A correção de período da TASK301 também abrange ambas as manutenções: substitui a parcela pelo mesmo montante no mês UTC da execução confirmada e conserva pagamentos, comprovativos e saldo global. Recibos de correção anteriores à migração continuam recuperáveis no formato/hash original.
- A consulta por execução inclui os novos custos no serviço e cliente certos, com totais completos e paginação. Compras de stock ficam separadas do consumo medido; divergências de mês e fontes por rever não entram como custos confirmados. Cobertura completa e lucro permanecem por apurar.
- Interface manual com motivo e confirmação, verificação das fontes/recibos, IndexedDB e Web Locks por conta, consulta/reenvio exatos e recuperação após perda de resposta. A mudança de uma valorização calculada para manutenção limpa o montante e mês; não confirma automaticamente esse cálculo como parcela manual. Rascunhos e mudança de sessão A–B–A mantêm as proteções existentes.

## Verificação local

API e navegador novos: equipamento/lembrete, mesmo ID numérico, pais regulares/extras, incluído/extra, cliente inativo após transferência, parcelas e orçamento entre meses, duplicados, concorrência entre processos, recuperação pelo mesmo recibo e isolamento por conta, rollback, origens alteradas/removidas, correção de período com pagamentos preservados e consulta paginada com totais completos.

Regressões aprovadas: despesas/repartições, reparações, consulta por execução, bases compostas e correção de período em API e navegador; receitas de manutenções. O teste de período verifica também recibos anteriores à migração com hashes históricos. 401 testes unitários/64 ficheiros; sintaxe 598 JS backend, 200 JS frontend, 62 scripts inline. As 33 migrações preservam os dados anteriores e correspondem ao esquema atual de 125 tabelas. Layout a 320/390/1440 px e modo escuro, com conteúdo literal.

Runner de 201 para 203 grupos; cache `cristalwater-field-20260923-v118`. Logs locais `/tmp/cw302-*.log`, visuais `reports/field-visual/maintenance-costs/`. O CI completo e o restauro PostgreSQL 16 da versão publicada foram posteriormente confirmados conforme a evidência seguinte.

## Âmbito e próximos passos

Base `21f855f7ac308637597de4c89458e327bf45589b`; publicação apenas na branch `work/field-readiness-20260915-simulation`, sem força. Principal `feature/technicians-v25` preservada em `6f27081e1d183ff584a62255b016b373836734db`. Sem merge, deploy ou contactos reais.

Fecha a atribuição manual de despesas às duas origens de manutenção confirmadas. Restantes gastos/repartições entre técnicos e períodos, custos medidos próprios das manutenções, restantes ajustes/origens de receita, históricos, volume, VPS/fornecedores e piloto físico continuam abertos. Custos/receitas completos e margem por apurar; IVA e emissão fiscal externos, preços/frequências por cliente e época.

## Publicação e CI

Código publicado sem força e com árvore igual à validada localmente: commit `d39be03c084196cec5990211ae97786e261567a2`, árvore `7580c9c03c51984ee56c434ad5adf7a5ea609636`, [CI 35859868635](https://github.com/ts7520305-svg/cristalwater/actions/runs/35859868635), job `107177158222`: 17 etapas aprovadas entre 12:20:33 e 12:47:56 UTC de 23/09/2026 (27m23s). Logs completos conferidos: 203/203 grupos previstos distintos, código zero/sem sinal, sem falta ou duplicação; 401 unitários/64 ficheiros, quatro técnicos, gate geral do navegador, 33 migrações e sintaxe 598/200/62. Restauro PostgreSQL 16: 125 tabelas/46 ficheiros, linhas e hashes iguais.

Despesas de manutenções API/UI aprovadas em 7539/9758 ms; correção de período API/UI 8922/9363 ms; consulta por execução API/UI 18910/25913 ms; receitas de manutenção 35078 ms. Todos os grupos previstos foram conferidos, sem falta, entrada inesperada, duplicação ou sinal.

Evidência completa em `evidence/20260923_task302_ci.json`. Backup `backup/maintenance-cost-local-20260923` (`fafd40af2e7fcea707ac96f3130b9e2b3cdd950b`). O fecho posterior altera apenas documentação e conserva as árvores de código, migrações e testes aprovados. Restantes gastos/repartições, custos medidos próprios de manutenções, ajustes/origens de receita, históricos, volume, VPS/fornecedores e piloto físico continuam pendentes. Esta aprovação não comprova cobertura financeira completa ou operação em produção.
