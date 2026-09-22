# TASK291 — Reparações sem utilização de materiais

## Âmbito

Continuação da TASK290, base `592da9b049b733394deeda92d4e6466bb4e476a8`, na branch `work/field-readiness-20260915-simulation`. O ecrã `/repair-execution` permite declarar uma intervenção sem materiais, com descrição obrigatória e confirmação explícita. Não presume que a ausência de reserva significa ausência de consumo.

Só são elegíveis reparações aprovadas, agendadas ou faturadas, sem data de conclusão, reserva ou evento histórico de conclusão/consumo. Uma reserva cancelada, consumida, vazia ou incoerente exige revisão; não é convertida automaticamente numa intervenção sem materiais. Confirmações antigas não recebem prova retroativa.

## Comportamento

- A descrição tem 5–1000 caracteres, sem campos adicionais ou controlo inválido. O pedido guarda a versão exata da reparação, a piscina e a declaração. Alterações entretanto ocorridas recusam a execução.
- A conclusão guarda estado, data atual, descrição, autor autenticado, histórico, auditoria, notificação interna e recibo numa transação. A prova de esquema 2 declara explicitamente `materialMode: NONE`, reserva nula e movimentos vazios. O esquema 1 existente continua válido.
- Nenhum movimento de stock, fatura ou pagamento é criado pela conclusão sem materiais; o preço anterior é conservado. A prova é uma declaração no sistema, não uma verificação física independente. A data não é uma data histórica inferida.
- Repetições iguais recuperam o resultado; pedidos diferentes concorrentes não repetem a conclusão. O técnico não recebe contactos, preços ou identidade comercial do cliente. IndexedDB, bloqueio entre janelas e recuperação do percurso anterior são conservados.
- A reserva e o agendamento partilham a ordem de bloqueios cliente/reparação/piscina. Depois de existir declaração de execução, não permitem reservar materiais. Conclusão sem materiais concorrente com agendamento/reserva tem uma única operação vencedora.
- A revisão encontrou uma consulta de saldos fora da transação: a regressão operacional falhou com `P2024` e uma única ligação. `listBalances` passa a receber a ligação transacional; agendamento com Prisma completo também conserva a transação até ao fim. O mesmo ensaio passou após a correção.

## Validação local

`test-field-repair-no-materials.js`: descrição/campos inválidos, nenhuma criação financeira ou consumo, autoria, recuperação, pedidos iguais/diferentes concorrentes, competição com reserva/agendamento, contexto alterado, históricos recusados, prova adulterada e rollback no recibo. A interface verifica o formulário sem materiais a 320 px, resposta perdida e recuperação.

Regressões finais de comandos, interface, conclusão com reserva, prova financeira da execução e percurso operacional completo aprovadas em `/tmp/cw291-292-confirmed.log`. O percurso completo termina com reparação CLOSED e documento PAID. As falhas iniciais ficam em `/tmp/cw291-292-final-focused.log` e `/tmp/cw291-reservation-final.log`; a última incluía uma chamada incorreta do ensaio a uma função interna, corrigida para o agendamento público.

401 testes unitários/64 ficheiros e sintaxe de 585 backend/192 frontend/59 scripts inline aprovados. Publicação conjunta com TASK292: runner de 184 grupos distintos, cache v107, sem esquema, migração ou dependência nova. Confirmar CI PostgreSQL 16/restauro do commit publicado; os testes locais não comprovam o ambiente VPS.

## Limites e continuação

Ligação explícita à visita de origem, revisão de datas históricas e custos completos continuam separados. Valores/frequências caso a caso e emissão fiscal externa com registo do número de fatura. Sem merge, deploy ou contactos reais neste lote.
