# TASK236–237 — fontes operacionais e trabalho planeado

## Estado

Implementação e ensaios locais aprovados em 17/09/2026. A publicação, a integração completa em PostgreSQL nativo e o restauro desta árvore ainda aguardam confirmação. Base anterior: `f45082e48537cc22323c642a3ee0c01341176348`, sobre código TASK234–235 `8cd59cd3eb9842a82d4199eb9598a6250371b9d0`.

Sem migração de esquema, envio externo, emissão fiscal, deploy, alteração de main ou reatribuição de visitas. O diagnóstico anterior fica conservado em `PROFITABILITY_SOURCE_REVIEW_20260917.md`.

## TASK236 — atividade, fontes e custos desconhecidos

Billing e os relatórios de técnicos/clientes da Finance OS passam a usar o mesmo serviço, com transação de leitura consistente. Administração conserva os resultados e acrescenta o estado financeiro e as bases de cálculo. As identidades são Technician/Client, incluindo inativos e registos sem titular confirmado; nomes iguais e IDs iguais entre ServiceVisit/ExtraVisit não se fundem. O proprietário atual da piscina não preenche o cliente ausente de uma visita histórica.

| Dado apresentado | Fonte e período | Limite explícito |
|---|---|---|
| Visitas e minutos | REGULAR/EXTRA concluídas, `endAt` dentro do mês UTC | Sem fim confirmado: contagem separada pelo mês planeado. Duração ausente/invertida não equivale a zero. |
| Linhas de extra | Invoice/InvoiceLine do mês de referência, valor literal da linha e IDs de documento/linha/extra | Exclui DRAFT/anulados; referência tem de ser única entre documentos ativos, titularidade coerente e dois campos monetários concordantes. Crédito/ajuste não repartido impede atribuição segura. Não equivale à receita total nem ao recebimento. |
| Consumos e devoluções | StockMovement no mês UTC, tipos admitidos e agrupamento por produto/unidade | Devolução subtrai quantidade física; quantidade não é custo. VehicleStockMovement espelhado não é contado outra vez. Referências/titulares contraditórios ficam por rever. |
| Recebimentos por cliente | Payment pela data efetiva UTC, excluindo métodos internos de crédito/ajuste | Sem repartição por técnico; não se confunde mês da visita, documento e caixa. |
| Mão de obra estimada | Um único custo atual configurado: por visita ou por hora com durações completas | Duas bases positivas são ambíguas; base ausente é desconhecida. A tarifa atual não comprova custo histórico, encargos, deslocações ou estrutura. |
| Receita total, custos efetivos e margem | Campos financeiros retornam `null`, `financialComplete:false` e motivos | Não usa 45 €/visita, 1,50 €/unidade, 12 €/visita nem zero por ausência de fonte. Repartição das mensalidades e valorização histórica permanecem por implementar. |

O período é validado, confirmado na resposta e completo; `limit` legado não trunca um agregado. O pedido antigo de cálculo por cliente devolve `INSUFFICIENT_DATA`, margem desconhecida e `persisted:false`: deixa de criar ClientProfitSnapshot e de recomendar alteração de contrato a partir de constantes. Snapshots históricos existentes não foram reescritos. A resposta é uma projeção do estado atual dos documentos, não uma fotografia fechada do mês.

Os dois endereços `/technician-profit-dashboard` e `/technician-profit` usam a mesma interface, mês UTC atual, fontes visíveis, valores desconhecidos explícitos, custos estimados identificados e detalhes documentais. Não dependem de Chart.js. Aceitam apenas respostas completas/coerentes, sem identidades/evidências duplicadas; mudança de período/conta, falha ou prazo de 20 segundos limpa os resultados antigos e permite recuperação. Nomes e produtos usam texto literal; rascunhos não relacionados são conservados.

## TASK237 — consulta real do trabalho planeado

O endereço legado `/api/routes/auto-plan` tem agora contrato versionado `assigned-work-preview`. Consulta apenas ServiceVisit/ExtraVisit com PLANNED, sem início/fim, no dia civil do servidor. A data planeada da visita regular prevalece; o campo antigo `date` só é usado na ausência de `plannedDate`. O extra usa `scheduledAt`. Datas impossíveis/duplicadas recebem 400.

Agrupa pelas atribuições Technician existentes e conserva o grupo sem responsável. Não transforma o cadastro de piscinas em tarefas, não usa User.role/nome, não altera atribuições e não atribui lucro 99999 aos extras. A lista é completa; equipa/dia sem trabalho produz uma resposta vazia confirmada. `/api/routes/today/:technicianId` confirma explicitamente a identidade Technician; técnico inexistente recebe 404 e técnico sem trabalho recebe lista vazia. Ambos continuam ADMIN e sem cache.

`/profit-map` passa a «Trabalho planeado», com todos os grupos, filtro por ID, inativos identificados, ausência de piscina/coordenadas preservada e coordenada zero válida. A lista e a navegação por destino funcionam sem Leaflet. O mapa não desenha uma ordem de deslocação. O consumidor antigo do dashboard deixa de fabricar previsões de sobrecarga/disponibilidade e liga à consulta confirmável. Gestão de atribuições continua em Rotas e rondas.

Capacidade, deslocações, tempos previstos e lucro permanecem desconhecidos. Isto corrige uma consulta que falhava por relação inexistente; não implementa um otimizador de despacho.

## Verificação local

- `run-1789668485622`: valores operacionais pela API, 756 ms. A execução anterior `run-1789668400970` falhou numa fixture de permissão CLIENT que usava cliente inativo (401); corrigida para cliente ativo/identidade tipada. Não foi registada como aprovação.
- `run-1789668602578`: duas interfaces de valores, 5951 ms; regressão de recebimentos, 1272 ms; Administração, 1790 ms. Capturas `reports/field-visual/operational-values-1789668607080`, 320/390/1440; 320 e 1440 inspecionadas.
- `run-1789668700777`: API inclui cálculo legado sem gravação de snapshot, 753 ms.
- `run-1789669345465`: valores com cliente histórico ausente, 1090 ms; planeador/API/UI, 4654 ms; multi-mapa, 5367 ms; regressão de mapas TASK233, 5630 ms. Capturas `reports/field-visual/planned-work-1789669353234`, 320/390/1440; 320 e 1440 inspecionadas.

Os ensaios incluem mais de 205 técnicos, homónimos/inativos, REGULAR/EXTRA com ID igual, fronteiras mensais, conclusão sem fim/duração invertida, crédito/DRAFT/anulação, devolução/unidades/movimento espelhado, cliente histórico ausente, fontes monetárias incoerentes e sessão/período/rede. O planeador usa 304 visitas reais, exclui piscinas sem tarefa e visitas iniciadas/concluídas/canceladas/outro dia, recusa respostas contraditórias, conserva responsáveis e testa três larguras com recursos externos indisponíveis. As leituras não alteram visitas, documentos, movimentos ou snapshots.

Runner de integração: 131 grupos, incluindo os três grupos novos. Sintaxe aprovada: 540 ficheiros JS backend, 176 frontend e 58 scripts inline. Inventário atualizado: 101 HTML, 54 páginas com referência literal de teste, zero recursos locais em falta e zero divergências de guardas no catálogo. Cache v64. Não há ensaio de volume de produção, despacho automático, custo histórico apurado, tradução exaustiva de todos os textos/PDFs ou validação física/VPS neste lote.
