# TASK310 — repartir materiais da visita com a revisão

## Resultado e conservação

A administração pode repartir o custo MATERIAL já confirmado de uma visita REGULAR/EXTRA pelas revisões de equipamento dessa visita. A prévia mostra a linha histórica de compra, a atribuição original, o produto/unidade, a quantidade declarada, o que já foi repartido entre todas as compras, a parcela em cêntimos e o remanescente da visita. A quantidade pode ser indicada explicitamente; em branco, calcula-se o máximo disponível para revisão e atribuição. A gravação exige motivo e confirmação da prévia atual.

A parcela é descontada da visita. A atribuição original conserva a única reserva contra a despesa, a linha de compra e o consumo líquido; não há novo movimento de stock, nova valorização ou duplicação de pagamentos. Projeções comuns por execução, cliente, despesas e contexto financeiro incluem o remanescente e as parcelas, com a mesma soma original de quantidades/cêntimos. Custos completos e lucro continuam por apurar.

## Limites conjuntos e provas

- A revisão precisa da declaração TASK309 em estado `MATCHED`, execução e decisão histórica confirmadas e do mesmo cliente e pai tipado. REGULAR e EXTRA com o mesmo número continuam separados. Visita, revisão e atribuição têm de pertencer ao mesmo mês UTC.
- Produto e unidade usam a normalização de stock existente, sem conversões. O cálculo usa micro-unidades inteiras e cêntimos. Quantidades positivas até seis casas decimais têm de caber simultaneamente na atribuição original e na declaração da revisão, considerando todas as compras/documentos. A parcela que esgota a atribuição recebe o resto exato dos cêntimos. Quantidades que não permitem uma parcela positiva em cêntimos são recusadas.
- Só pode existir uma parcela ativa por revisão/atribuição. Uma mesma declaração pode ser repartida por várias compras compatíveis, mas a soma dessas parcelas não pode ultrapassar a quantidade declarada. O bloqueio por visita tipada serializa comandos de despesas diferentes; cada despesa mantém também o bloqueio e a versão existentes.
- O histórico usa `ExpenseEvent`, com pedido, ator, prévia, provas e recibo. A versão da despesa e o evento são atómicos. O diário é conferido entre documentos, incluindo eventos anulados; um evento inválido impede confirmar os custos de materiais e não liberta quantidade silenciosamente. Este mecanismo não foi dimensionado para volume de produção.
- A leitura compara declaração, consumo líquido, compra/atribuição e destino atuais com os registos originais. Devolução posterior, alteração de quantidade/preço, cliente ou declaração exigem revisão dos custos envolvidos. O recibo original mantém-se recuperável. As origens das revisões e consumos são lidas em lote por visita.
- A anulação explícita de uma parcela devolve a quantidade/valor à visita e conserva o histórico e as restantes parcelas. Pode ser feita após alteração das fontes se o diário histórico estiver íntegro. A anulação da atribuição original exige primeiro anular as suas parcelas.

## Ecrã e recuperação

O ecrã de despesas permite consultar revisões em páginas de dez, distinguir materiais em falta, ausência explícita, consumo por confirmar e declarações compatíveis. A quantidade e o motivo ficam em rascunho por conta, despesa, atribuição e revisão. Vírgula decimal é aceite na edição e enviada como decimal canónico. Alterar quantidade invalida a prévia e a confirmação; filtros, navegação e mudança de conta invalidam o contexto.

O mesmo contrato verifica os cálculos e provas no servidor e no navegador. O pedido é guardado antes de enviar; confirmação incompleta/alterada ou resposta perdida mantêm o pedido original. O reenvio conserva o UUID e recupera o recibo. A limpeza do rascunho compara o conteúdo confirmado para preservar uma edição diferente. A interface foi ensaiada a 320/390/1440 px, com nomes tratados como texto literal. Cache v125.

## Validação local e publicação

Dezasseis novos testes unitários verificam aritmética, limites entre documentos, identidades tipadas, provas, verificador do navegador, diário alterado, anulação, conservação das projeções e falhas de leitura. Passaram 437 testes/67 ficheiros; sintaxe de 606 ficheiros backend, 204 frontend e 62 scripts inline.

O grupo `test-field-maintenance-materials.js` usa API, base isolada e navegador reais: permissões, paginação, ausência distinta de zero, mês incompatível, três parcelas 33/33/34 cêntimos, duas compras a disputar a mesma quantidade em dois processos, pai regular/extra de ID igual, correção de origens, recibos históricos, devoluções, proteção da atribuição original e rollback de versão/evento. Confere pagamentos, stock e atribuições originais e as projeções por execução/cliente/IA. No navegador verifica vírgula decimal, rascunho/recarregamento, prévia e confirmação alteradas, resposta perdida, reenvio idêntico, duplo clique, isolamento de filtros/conta e layout.

Regressões dirigidas aprovadas: repartição do trabalho TASK308, materiais próprios TASK309 e valorização de despesas. Mantém 35 migrações/126 tabelas; não há dependências novas. O runner passa de 212 para 213 grupos. CI nativo e restauro desta árvore por confirmar antes do fecho.

Base `ac2d3a9a181775fca09404d8ed8aa5a67bc5a314`, fecho documental TASK309. Publicação apenas em `work/field-readiness-20260915-simulation`. Principal `feature/technicians-v25` conservada em `6f27081e1d183ff584a62255b016b373836734db`; sem merge, deploy, alterações de produção ou contactos reais.

## Continuação

O utilizador pediu continuar até completar o sistema. Após a aprovação desta entrega, a TASK311 deve permitir corrigir/anular explicitamente declarações de materiais de equipamento, preservando o original, a recuperação do pedido e a revisão das parcelas afetadas. Materiais/tempos próprios de lembretes, repartições entre meses, restantes custos/receitas, históricos/idiomas/PDFs e capacidade operacional continuam na matriz. Produção, fornecedores e piloto físico requerem acesso/participação e as autorizações aplicáveis; ensaios isolados não os substituem.
