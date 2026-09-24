# TASK325 — Tempos e parcelas de trabalho de equipamentos históricos

Base funcional: TASK324. Publicação na branch `work/field-readiness-20260915-simulation` após o fecho documental dos materiais históricos.

## Capacidade

A administração pode declarar, completar, corrigir ou anular os tempos próprios de uma manutenção antiga com origem administrativa explicitamente revista. O comprovativo técnico original continua indisponível. A origem e os tempos têm comprovativos próprios, autor, data e motivo; o original antigo conserva os seus dados e a recuperação do pedido original.

São aceites um intervalo ou até 20 intervalos ordenados, sem sobreposição e com precisão de milissegundos. As pausas não contam como trabalho. Os intervalos têm de caber na visita e terminar até à conclusão original da manutenção. Não se presume que o tempo integral da visita pertence ao equipamento.

## Evidência e limites

- O registo histórico de trabalho usa esquema 3, conservando a forma de intervalo único ou múltiplos intervalos e o hash da revisão de origem. O comprovativo administrativo de tempos usa esquema 2 e incorpora a prova completa da origem.
- A prova e a cadeia originais são verificadas de novo na leitura. Alterar ou anular a origem deixa os tempos por rever. Esses tempos não desaparecem dos controlos de sobreposição. A mesma duração exige nova confirmação explícita para ficar vinculada a outra revisão de origem.
- A anulação dos tempos conserva a prova anterior e permite libertar os intervalos próprios. As parcelas financeiras existentes mantêm os seus valores e reservas até à anulação financeira explícita.
- Intervalos de outros equipamentos da visita, lembretes associados e outros serviços do mesmo técnico continuam a impedir sobreposições. Um lembrete pode usar uma pausa livre entre intervalos do equipamento, respeitando o seu próprio comprovativo e conclusão.
- O verificador de dependência histórica é partilhado com os materiais. Os leitores anteriores conservam um ponto de entrada compatível. Origens modernas sem recibo, provas contraditórias e cadeias administrativas danificadas não se tornam origens históricas válidas.

## Parcela de trabalho

A parcela usa o custo LABOR já confirmado da visita. A versão 8 no mesmo mês incorpora o comprovativo completo dos tempos e a revisão de origem; entre meses mantém a versão 6 e os mesmos comprovativos completos. As versões anteriores continuam verificáveis.

O documento/base paga, atribuição original, stock, pagamentos e conclusão antiga não são reescritos. O tempo, montante e reservas continuam comuns aos equipamentos e lembretes. Mudar a origem ou corrigir os tempos assinala os custos anteriores para revisão; não repõe silenciosamente o seu saldo. A anulação da parcela conserva o recibo antigo e restitui o montante à visita no mês original.

## Interface e recuperação

A revisão de origem permite abrir o editor de tempos. O editor mostra a evidência consultada, o autor e a data da origem administrativa, identifica os tempos como históricos e mantém o original separado da declaração atual. A prévia financeira mostra os intervalos, as pausas excluídas, ambas as declarações e a indisponibilidade do recibo técnico original.

O pedido durável conserva rascunho, UUID e conta. A recuperação após perda de resposta consulta o comprovativo sem repetir a criação. Mudança de conta remove os dados apresentados. Comprovativo, histórico e auditoria são atómicos; uma origem alterada durante uma confirmação concorrente recusa a proposta ou deixa a declaração dependente por rever.

## Validação

- 537 testes unitários em 76 ficheiros, quatro testes técnicos; sintaxe 620 backend / 217 frontend / 62 scripts inline.
- Seis casos novos: intervalo único/múltiplo e milissegundos, vínculo à origem, contradições e limites temporais, anulação após mudança de técnico, prova financeira/destino comercial, reserva conservadora e equivalência Node/navegador. As regras de meses incluem a versão 8.
- Ensaio integrado com original antigo criado pela operação original, permissões, dois processos, UUID repetido, propostas concorrentes, mudança/anulação de origem, nova vinculação, histórico corrompido e três falhas transacionais. Verifica sobreposições com equipamento, lembrete e outra visita do técnico; a pausa de 10–15 segundos permanece utilizável pelo lembrete.
- Uma visita de 180 segundos é valorizada em 300 cêntimos pela base paga. Dois intervalos de equipamento totalizam 20 segundos e repartem 33 cêntimos; o remanescente continua na visita. Origem alterada mantém a parcela antiga reservada até à anulação explícita. Atribuição, stock, pagamentos e original antigo ficam iguais.
- Navegador real: evidência visível, rascunho com milissegundos, prova adulterada, confirmação dupla, resposta perdida, recuperação por consulta, parcela com ambas as provas e isolamento de sessão. Larguras 320/390/1440 e modo escuro.
- Regressões aprovadas: correção moderna de tempos, materiais históricos, recursos de lembretes associados e parcelas entre meses.
- Runner com 228 grupos; cache `cristalwater-field-20260924-v140`. Sem novas migrações, tabelas ou dependências; mantêm-se 39 migrações. CI nativo e restauro deste lote pendentes nesta versão documental.

## Continuação

Rever os critérios ainda abertos da matriz, incluindo devoluções parciais, restantes fontes financeiras, relatórios históricos, inventário de apresentação, volume e operação prolongada. Esta entrega não comprova presença física, cobertura financeira integral ou funcionamento em produção.
