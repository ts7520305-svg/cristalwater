# TASK308 — repartir o trabalho da visita com a manutenção

## Resultado e âmbito

A administração pode repartir um custo de trabalho já confirmado de uma visita REGULAR/EXTRA com uma revisão de equipamento dessa visita. A revisão precisa do tempo próprio da TASK307 e de execução, cliente e decisão histórica confirmados. A prévia apresenta o documento, a atribuição original, os tempos, as parcelas anteriores, o montante da manutenção e o que fica na visita. O motivo e a confirmação são explícitos.

O valor da parcela é descontado da visita. A atribuição original continua a ser a única reserva de dinheiro e tempo na base de salário/encargos. Os relatórios de despesas, cliente, técnico, execução e contexto financeiro usam a mesma projeção. Uma visita pode ficar com custo residual zero quando todo o custo original foi repartido; isso não significa cobertura financeira completa.

Cada operação reparte um documento/componente. Uma composição com salário e encargos conserva os seus documentos e permite repartir cada componente explicitamente. Não há cálculo automático de encargos, cópia integral do custo da visita ou nova valorização das mesmas horas.

## Regras e recuperação

- Visita, manutenção e atribuição têm de estar no mesmo mês de execução UTC. A revisão pertence ao cliente e à identidade REGULAR/EXTRA originais, mesmo quando os IDs numéricos coincidem. Tempos ausentes ou por rever não são tratados como zero.
- O cálculo usa inteiros: custo original × duração própria / duração original, arredondado ao cêntimo. A parcela que esgota o tempo disponível recebe o resto exato dos cêntimos. Montantes positivos e limites conjuntos de tempo/dinheiro são obrigatórios. Uma manutenção só pode ter uma parcela ativa de cada atribuição original.
- O histórico reside em `ExpenseEvent`, com comando, versão, ator, prévia, provas e recibo íntegro. O bloqueio da despesa serializa repartições concorrentes; recibo e alteração da versão são atómicos. Pagamentos, bases pagas e atribuições originais conservam os valores e as reservas.
- Reenvio e consulta recuperam o pedido original. Uma confirmação incompleta conserva o pedido no navegador. O motivo fica em rascunho por conta, despesa, atribuição e manutenção; filtros, navegação e mudança de sessão invalidam prévias antigas.
- A consulta confronta a parcela com a atribuição original, o tempo/recibo da revisão e o destino histórico atuais. Alteração posterior exige revisão de ambos os destinos, preservando o recibo. Um histórico incoerente não liberta orçamento silenciosamente; ausência da atribuição original impede publicar totais confirmados.
- Anular uma parcela devolve o valor à visita, mantendo o histórico e as restantes parcelas. A anulação é possível após mudança das fontes, desde que o histórico da parcela esteja íntegro. É obrigatório anular as parcelas antes de anular o custo original ou a sua composição.
- A leitura dos tempos agrupa visitas e recibos para evitar consultas por parcela. A alteração/remoção de um intervalo próprio também exige rever os restantes intervalos desse pai cuja exclusão de sobreposição deixou de ser confirmável.

## Verificação local

O novo grupo `test-field-maintenance-labor.js` usa a API e o navegador reais com uma base isolada PGlite: execução/decisão/tempo confirmados, paginação de revisões sem tempo, mês diferente recusado, permissões, pais de ID igual, cêntimos e resto final, concorrência, repetição, correção de origens e histórico, anulação explícita, proteção da composição e rollback de versão/recibo. Confere a conservação da atribuição, base paga e pagamentos e a igualdade das projeções por execução, cliente, técnico e IA. O ecrã foi verificado a 320/390/1440 px, com rascunho, texto literal, confirmação alterada/perdida, duplo clique, recarregamento, reenvio idêntico e isolamento de sessão/filtros.

Regressões locais aprovadas: valorização de despesas, correção do mês no navegador, tempos próprios de equipamento, composição do trabalho e cobertura composta. 409 unitários/65 ficheiros aprovados. O runner passa de 210 para 211 grupos; mantém 35 migrações/126 tabelas, sem dependências novas. Cache v123. O limite do job passa de 30 para 35 minutos porque os últimos ensaios completos demoraram mais de 28 minutos; mantém todos os testes e o restauro.

## Publicação e limites

Base `901c3a9254aef707525245d1348ac82002080fd9`, fecho TASK307. Publicação autorizada em `work/field-readiness-20260915-simulation`. O CI nativo e o restauro desta árvore estão aprovados conforme a evidência abaixo.

Permanecem abertos os consumos próprios de materiais, tempos de lembretes, repartições entre meses e restantes custos/receitas. Não há margem ou lucro completos, certificação de presença física, merge na principal, deploy no VPS ou contacto com fornecedores reais nesta etapa.

## CI e fecho

Código publicado `040d2b46c6f16908e6b9e3b3882ebfb2308e61ce`, árvore `199569a05bbff270a14a7c3c44e091186411fe38`, igual à validada localmente. [CI 35928674518](https://github.com/ts7520305-svg/cristalwater/actions/runs/35928674518), job `107409794869`, aprovado entre 2026-09-23T22:30:04Z e 2026-09-23T22:55:57Z (25m53s). 17 etapas aprovadas; 211/211 grupos previstos distintos, sem falha, falta, entrada inesperada ou duplicação. 409 unitários/65 ficheiros, quatro testes técnicos, gate geral de navegador, sintaxe 603/202/62 e 35 migrações. Restauro PostgreSQL 16 de 126 tabelas/46 ficheiros, com linhas e hashes iguais.

Evidência em `evidence/20260923_task308_ci.json`, com os 211 resultados e hash SHA256 do log. O fecho posterior altera apenas documentação e conserva o código e os testes aprovados.

Próxima etapa: origens e quantidades próprias de materiais nas manutenções, seguidas da repartição compatível com os consumos da visita. Tempos de lembretes, repartições entre meses e cobertura financeira integral continuam abertos.
