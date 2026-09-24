# TASK309 — materiais próprios das revisões de equipamento

## Resultado e limites

A revisão de equipamento REGULAR/EXTRA permite declarar até 20 materiais, indicando produto, unidade e quantidade, ou confirmar explicitamente que não usou materiais. O campo continua opcional: um registo antigo ou omitido não é convertido em zero. A declaração fica ligada à execução, visita tipada, piscina, cliente e técnico originais, no recibo recuperável e no histórico técnico.

Esta etapa regista quantidades, não custos em euros. Não cria movimentos, não retira stock, não escolhe uma compra/lote e não altera despesas, pagamentos ou receitas. Os consumos normalmente só são criados no fecho da visita; por isso a declaração aguarda esse fecho. As quantidades declaradas já pertencem ao total da visita e não devem ser acrescentadas novamente.

## Conferência e conservação

- Nomes e unidades usam a normalização de stock existente, sem conversões entre unidades. Quantidades positivas até 100000, com até seis casas decimais, são tratadas em micro-unidades inteiras. Produto/unidade repetidos, campos extra e quantidades inválidas são recusados.
- A leitura distingue `MISSING`, `NONE`, `DECLARED`, `MATCHED` e `REVIEW`. `MATCHED` significa compatibilidade com o consumo líquido atual, não certificação física nem confirmação monetária.
- Depois do fecho, a soma declarada por todas as revisões do mesmo pai é comparada com CONSUMPTION/EMERGENCY_DISTRIBUTED_CONSUMPTION menos RETURN. Devoluções posteriores também entram. Visitas REGULAR/EXTRA com o mesmo número continuam separadas; identidades de produto, cliente, piscina e técnico incoerentes exigem revisão.
- A consulta mostra quantidade da visita, soma das declarações e quantidade ainda sem parcela declarada. Esta última pode incluir materiais de outras revisões não registadas: não é automaticamente custo exclusivo da visita.
- Declaração/recibo alterados ou removidos, origem alterada, datas/estado incoerentes, stock desconhecido ou soma superior ao consumo exigem revisão. Um registo de outra revisão corrompido não liberta quantidade silenciosamente. Leitura da visita, irmãos, recibos e movimentos usa uma transação RepeatableRead.
- A conferência é uma leitura atual, com fotografia/hash das origens; não reescreve o recibo histórico. Uma correção explícita dos consumos pode restaurar a compatibilidade. Correção/anulação da própria declaração e repartição monetária dos materiais não são implementadas nesta etapa.

## Terreno e recuperação

Rascunhos incompletos, só com materiais ou com confirmação de ausência são preservados por conta/visita/plano, juntamente com notas e tempo. Duas janelas usam o bloqueio e a comparação do rascunho existente. Para mudar uma declaração com quantidades para «sem materiais» é preciso remover explicitamente as linhas; não se descartam silenciosamente.

O pedido original fica no IndexedDB antes do envio. A resposta tem de conservar materiais normalizados, quantidades e origem tipada; resposta incompleta, alterada ou perdida mantém o pedido. O reenvio recupera exatamente o recibo anterior, mesmo depois de alterações na visita ou no plano. Só se limpa o rascunho que corresponde à confirmação. A mudança de conta fecha a interface sem apagar os dados originais. Cache v124.

## Verificação

Doze testes unitários novos cobrem validação/canonicalização partilhada com o navegador, ausência distinta de zero, aritmética exata, orçamento conjunto, devoluções, identidades tipadas, alterações de fontes/recibos e falhas de leitura. A bateria unitária tem 421 testes/66 ficheiros; sintaxe 604 ficheiros backend, 202 frontend e 62 scripts inline.

`test-field-equipment-materials.js` usa API, base isolada e navegador reais: permissões, reenvio concorrente, recibo/histórico, rollback de auditoria/recibo, fecho real de visita extra consumindo a guia uma única vez, alterações de stock/origem e orçamento conjunto. No navegador verifica rascunho sem notas, recarregamento, duas janelas, confirmação danificada/perdida, reenvio idêntico, estados de leitura, texto literal e 320/390/1440 px. Regressões dirigidas: interface antiga de revisões, tempos próprios e repartição monetária do trabalho.

O ambiente local foi recuperado após perda dos ficheiros temporários anteriores; dependências auxiliares e configuração de fontes do navegador ficaram apenas no runtime de QA. Não há dependências novas no projecto, migração ou tabela nova: mantém 35 migrações/126 tabelas. O runner passa de 211 para 212 grupos. A aprovação nativa e o restauro desta árvore devem ser confirmados antes do fecho.

## Retoma

Base `efda938141f3275b46490d8dfdd9ee50c6b147fd`, fecho TASK308. Publicação apenas em `work/field-readiness-20260915-simulation`; principal `feature/technicians-v25` preservada em `6f27081e1d183ff584a62255b016b373836734db`. Sem merge, deploy, produção ou contactos reais.

Depois da aprovação: repartir explicitamente o custo MATERIAL confirmado da visita pelas declarações compatíveis, preservando a atribuição/linha de compra, quantidades e cêntimos originais. Não voltar a consumir nem a valorizar a mesma quantidade. Materiais de lembretes, tempos próprios de lembretes, repartições entre meses, restantes custos/receitas e operação física permanecem abertos; não declarar cobertura financeira ou lucro completos.
