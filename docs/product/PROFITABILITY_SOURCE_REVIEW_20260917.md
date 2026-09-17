# Revisão das fontes de rentabilidade — 17/09/2026

Diagnóstico histórico da base TASK234–235. As TASK236–237 corrigem os relatórios e substituem o planeador inválido por consulta de trabalho realmente agendado. Implementação e ensaios locais em `OPERATIONAL_VALUES_AND_PLANNED_WORK_20260917.md`; CI/restauro do novo lote ainda pendentes neste registo. A rentabilidade total continua por apurar: fontes documentais e estimativas não substituem repartição de receitas nem custos históricos.

## Reprodução em QA isolada

`run-1789666894641`, base de código `8cd59cd3eb9842a82d4199eb9598a6250371b9d0`. Criados apenas na base descartável: um técnico ativo da tabela Technician, custo configurado de 32 € por visita, cliente/piscina, uma visita regular e uma extra concluídas em março de 2032 e uma devolução de stock de 10 L. Nenhuma fatura do cliente. As consultas usaram a API real com sessão ADMIN; não houve fornecedor, documento fiscal, alteração em produção ou nova implementação financeira.

| Consulta | Resultado observado | Defeito ou limite confirmado |
|---|---|---|
| `/api/billing/technician-profit?month=3&year=2032` | HTTP 200, `ok:true`, `ranking:[]` | O técnico existente em Technician fica ausente: a implementação procura User com `role:"tecnico"` e associa visitas pelo nome. |
| `/api/finance-os/reports/technician-profitability?monthRef=2032-03` | Uma visita, receita estimada 45 €, custo de stock 15 €, rentabilidade 30 € | A constante 45 €/visita não vem de faturas; a extra não entra; uma devolução entra como custo a 1,50 €/unidade. O custo de trabalho configurado não é usado. |
| `/api/finance-os/reports/customer-profitability?monthRef=2032-03` | Receita 0 €, stock 15 €, trabalho 12 €, rentabilidade −27 € | A mesma devolução conta como consumo; trabalho usa 12 €/visita, sem fonte de custo. Não é um resultado financeiro apurado. |
| `/api/routes/auto-plan` | HTTP 200, `ok:false` | O servidor confirma relação `Pool.extras` inexistente. Trocar somente esse nome não resolve as restantes premissas do planeador. |

## Fontes revistas

- `src/routes/billingRoutes.js`: visitas são associadas por `technicianName`; homónimos colidem. Extras usam `userId` e `price`, sem usar a identidade Technician e os itens efetivos da fatura. Falta validação estrita de mês/ano. A resposta não confirma período nem completude.
- `frontend/technician-profit-dashboard.html`: ano inicial 2025, Chart externo bloqueante/sem guarda, chamadas sem recuperação de falha de rede/conta e interpretação dos campos como lucro. O alias `/technician-profit` lê `t.total`, embora o contrato devolva `profit`; a ausência é formatada como zero.
- `src/business/finance/FinanceOsBusiness.js`: técnicos limitados a 200 ativos, visitas/movimentos truncados por limite sem confirmação de completude; visitas só por data planeada e sem ExtraVisit. Receita estimada = visitas concluídas × 45; custo de stock = qualquer quantidade × 1,50, misturando tipos/unidades. O relatório por cliente acrescenta todas as visitas × 12. Os indicadores também são consumidos por `AdministrationBusiness`.
- `src/routes/routesRoutes.js`: considera todas as piscinas/histórico, utiliza User antigo e custos/tempos fixos; extras recebem `profit:99999` como prioridade. Não suporta equipa vazia antes de `plans[0].route.push`. As alterações de TASK233–235 usam contratos separados e não validam este planeador.

## Critérios para corrigir

1. Identidade Technician estável, preservando técnicos históricos/inativos, trabalho sem responsável e tipos REGULAR/EXTRA. Nenhuma associação automática por nome ou colisão de IDs entre tabelas.
2. Período validado e confirmado na resposta; definir explicitamente se a data é execução, faturação ou recebimento. Lista completa ou paginação confirmada, sem truncar silenciosamente técnicos/registos.
3. Valores financeiros obtidos de fontes identificadas: documentos/linhas, anulações/notas de crédito e recebimentos com a respetiva base. Mensalidades de cliente que abranjam várias piscinas/técnicos precisam de uma regra de repartição explícita; não inventar receita por visita.
4. Consumos e devoluções tipados, unidades compatíveis e custo documentado. `StockPurchaseItem` tem custos de aquisição; isso não prova automaticamente o custo histórico de cada consumo nem autoriza juntar dois registos do mesmo movimento. Custo não apurado deve aparecer como desconhecido, nunca como zero.
5. Distinguir custos de trabalho estimados dos custos efetivos; a presença de `costPerVisit` ou `hourlyCost` não cobre viaturas, deslocação, encargos ou estrutura. Apresentar apenas a margem que as fontes permitirem comprovar.
6. Interface sem dependência bloqueante do fornecedor de gráficos, com período atual, fontes/limites legíveis, estados vazios/falhados e invalidação perante mudança de conta/período. Tratar os dois endereços antigos e consumidores do relatório em conjunto.
7. Regressões com técnicos homónimos/inativos, IDs tipados, extras, ausência de custos, devoluções, mudanças de mês/ano e visitas com data planeada diferente da execução; documentos anulados/créditos não podem gerar dupla contagem. A pré-visualização de rotas não deve transformar valores fictícios de prioridade em lucro.
