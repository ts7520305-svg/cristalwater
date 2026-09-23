# TASK301 — correção do mês de atribuição de custos

## Resultado

O ADMIN pode corrigir uma repartição manual de despesa de uma visita REGULAR, EXTRA ou reparação para o mês UTC da execução confirmada. A consulta por execução abre diretamente a despesa e a atribuição selecionadas; o histórico mostra os meses diferentes e permite rever a correção. A confirmação apresenta o serviço, o cliente original, o valor e os dois meses, exige motivo e consentimento explícitos e conserva o registo anterior.

O mês de destino vem da execução atual confirmada. Não é uma edição livre da data do documento nem um fecho contabilístico. As categorias combustível, viatura, seguro, despesas gerais e outras repartições manuais usam o mesmo percurso; uma compra de stock continua distinta do consumo.

## Integridade e recuperação

- `CORRECT_COST_PERIOD` usa o comando versionado de despesas e o recibo `ExpenseEvent` existente. Sob bloqueio da despesa e das fontes, volta a verificar a origem, o serviço, o cliente, a atribuição original, o orçamento e a prévia confirmada.
- A anulação da atribuição anterior, a criação da substituta com igual montante e fontes, o incremento único da versão e o recibo pertencem à mesma transação. Uma falha em qualquer etapa reverte todas as alterações. Não altera montantes do documento, pagamentos, comprovativos, serviços, stock ou faturação.
- O recibo contém a prévia, a fotografia anterior, a atribuição anulada e a substituta. Identificadores tipados separam REGULAR/EXTRA/REPAIR mesmo quando têm o mesmo número. Reparações conservam o cliente original após transferência da piscina e exigem a prova autenticada atual.
- Outra repartição manual já existente para a mesma despesa/serviço no mês de destino bloqueia a correção. Não há junção implícita de parcelas. Mês já alinhado, execução sem data, fonte alterada, cliente diferente, atribuição anulada ou versão antiga são recusados.
- Materiais/trabalho valorizados e parcelas de bases compostas não entram neste percurso. Continuam sujeitos à revisão, anulação e valorização pelas respetivas fontes; a anulação conjunta das composições mantém-se obrigatória.
- IndexedDB e Web Locks conservam o pedido por conta. Consulta, reenvio exato e cancelamento de pedidos não recebidos reutilizam o recibo existente; não há repetição automática. A interface confirma hashes, identidades, montantes, fontes, meses e ambos os registos antes de aceitar a resposta. Mudanças de contexto ou sessão, incluindo A–B–A, invalidam a prévia; o motivo ainda não enviado fica em rascunho por conta/despesa/atribuição.

## Verificação local

Os dois novos grupos API/Playwright passam em ambiente isolado. Cobrem valores e pagamentos invariáveis, mudança dos totais de atribuição e execução, identidades tipadas, cliente histórico, conflitos entre pedidos, reenvio/consulta/cancelamento, origem importada alterada, documento/serviço desatualizados, colisões sem junção, recusa de valores medidos e falhas após anulação, criação e atualização da versão/recibo. O ensaio de composição confirma a recusa de correção isolada de parcelas.

Regressões de custos gerais, custos de reparações, consulta por execução e bases compostas aprovadas em API e navegador. 401 testes unitários em 64 ficheiros; sintaxe 597 JS backend, 199 JS frontend e 62 scripts inline. Layout verificado a 320/390/1440 px e em modo escuro; dados tratados como texto literal. Logs locais `/tmp/cw301-*.log`; imagens de QA em `reports/field-visual/cost-period/`.

O runner passa de 199 para 201 grupos. Sem alterações ao esquema ou novas dependências: mantêm-se 32 migrações e 125 tabelas. Cache `cristalwater-field-20260923-v117`. O CI completo e o restauro PostgreSQL 16 da versão publicada ainda têm de ser confirmados antes do fecho.

## Âmbito e limites

Base de trabalho `79e0b1968558806e74b7e8ba08ba72e8102e0c60`; publicação apenas na branch `work/field-readiness-20260915-simulation`, sem força. Principal `feature/technicians-v25` preservada em `6f27081e1d183ff584a62255b016b373836734db`. Sem merge, deploy, fornecedores ou contactos reais.

Fecha a correção explícita de divergências em repartições manuais com execução atual confirmada. Restantes gastos/repartições entre técnicos ou períodos, restantes origens/ajustes de receita, históricos, volume, VPS/fornecedores e piloto físico continuam em aberto. Custos e receitas completos, lucro e margem permanecem por apurar. IVA e emissão fiscal externos; preços/frequências por cliente e época.
