# TASK322 — Parcelas de manutenção entre meses

Base de publicação: `5d64ae57f36661ead24576e1f41818820aec123b` (fecho TASK321; código `ad8c81a0299fd3f672c627a690727f6963af751a`). Branch de trabalho `work/field-readiness-20260915-simulation`.

## Objetivo e regra do mês

Repartir o custo já confirmado de uma visita REGULAR/EXTRA com equipamentos e lembretes associados cuja conclusão pertence a outro mês UTC. Abrange trabalho e materiais. O mês da parcela é o mês da conclusão histórica confirmada do seu destino; o remanescente mantém o mês original da visita. Não se escolhe livremente um mês nem se altera a data original.

Um serviço pode começar num mês e terminar noutro. Esta tarefa conserva a regra de atribuição pelo mês da conclusão: não divide automaticamente horas ou consumos pela meia-noite, nem reparte uma base salarial por períodos diferentes. Os intervalos próprios continuam limitados à visita e à conclusão do respetivo serviço. As declarações de materiais continuam a exigir datas e consumo líquido compatíveis.

## Comprovativos e conservação

- As provas anteriores do mesmo mês mantêm versões 1–5 e os seus formatos. Uma parcela entre meses usa a versão 6, com os meses da visita e manutenção expressos e vinculados às datas dos comprovativos.
- Servidor e navegador usam a mesma validação dos meses. Datas UTC não canónicas, períodos adulterados, omissões, campos adicionais e regressos artificiais a versões anteriores são recusados.
- A versão 6 conserva as provas próprias: intervalos simples/múltiplos, revisão administrativa de tempos quando existe, declaração de materiais, consumo, associação do lembrete e recursos originais.
- O orçamento continua ligado à atribuição original. As quantidades, tempo pago e cêntimos são comuns a todos os meses, documentos, equipamentos e lembretes. A última parcela recebe o remanescente exato, segundo as regras anteriores.
- Anular uma parcela retira-a do mês da manutenção e devolve o seu montante ao mês original da visita. O comprovativo permanece no histórico. A atribuição original, compra, movimentos de stock, pagamentos e conclusão técnica não são reescritos.

## Consultas e revisão

A projeção comum coloca cada parcela no mês do seu destino e conserva a referência à atribuição e ao mês de origem. Despesas, custos por cliente/técnico e valores por execução usam essa projeção. As consultas já carregavam as despesas de todos os meses antes de selecionar as atribuições; não é aplicado um filtro antecipado que esconda documentos de origem de outro período.

Correções de tempos e alterações das fontes continuam a assinalar as parcelas anteriores, com os seus saldos reservados até à anulação financeira explícita. Se um histórico de parcelas estiver danificado e puder esconder um destino mensal, o resumo assinala `unplacedShareReviewCount`, fica em revisão e apresenta os montantes atribuídos e valorizados como desconhecidos. Não transforma uma parcela ilegível num total mensal confirmado de zero.

## Interface e recuperação

Os dois editores mostram o mês da visita, o mês da manutenção, o remanescente e o efeito da anulação. O histórico das parcelas e a consulta de despesas atribuídas conservam o mês de origem. Continuam a usar o pedido durável, motivo, confirmação explícita, recuperação por consulta, rascunho e proteção de sessão existentes.

## Validação

- 519 testes unitários em 75 ficheiros, quatro testes técnicos; sintaxe 617 backend / 216 frontend / 62 scripts inline.
- Regras partilhadas ensaiadas em Node e contexto de navegador: versões anteriores, mudança de ano, ano bissexto, limites UTC, períodos adulterados e conservação de cêntimos/quantidades entre meses.
- Ensaio integrado com visitas REGULAR/EXTRA de ID numérico igual, equipamentos e lembretes, intervalos múltiplos e uma correção administrativa de milissegundos. O relógio isolado do ensaio cria recibos históricos antes da mudança de mês; os originais não são adulterados para simular o cenário.
- Cinco custos originais totalizam 500 cêntimos. A soma dos dois meses permanece 500 após repartições, revisão e anulações. Confirmados saldos conjuntos entre compras, parcela final exata, originais/pagamentos/stock intactos, permissões, dois processos, pedidos concorrentes, UUID repetido, recuperação e rollback do evento/versão.
- Histórico adulterado bloqueia a confirmação de zero mesmo num mês sem parcelas legíveis. As projeções por execução e as despesas atribuídas conservam o mês da origem.
- Navegador real: meses explícitos, revisão administrativa incorporada, proposta e recibo adulterados com hashes recalculados, rascunho após recarga, confirmação dupla, resposta perdida e recuperação por consulta sem novo POST, anulação, materiais de lembrete e isolamento de sessão. Larguras 320/390/1440 e modo escuro.
- Quatro regressões dirigidas aprovadas: repartição de trabalho, materiais, custos de lembretes associados e correção administrativa de tempos.
- Runner com 225 grupos; cache `cristalwater-field-20260924-v137`. Sem novas migrações, tabelas ou dependências; mantêm-se 39 migrações. CI nativo e restauro deste lote pendentes nesta versão documental.

## Continuação

Revisão histórica de registos sem comprovativo verificável permanece aberta. Outras despesas/receitas, cobertura financeira integral, lucro, operação prolongada, produção, fornecedores reais e piloto físico mantêm os critérios próprios da matriz.
