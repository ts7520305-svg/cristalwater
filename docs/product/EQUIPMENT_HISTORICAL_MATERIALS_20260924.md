# TASK324 — Materiais e parcelas de custo de equipamentos históricos

Base funcional: TASK323, código `f78e3a9dfb45dcda2ff3567232488ec1ca9f6a31`. Publicação na branch `work/field-readiness-20260915-simulation` após o fecho documental desse lote.

## Capacidade

A administração pode declarar, completar, corrigir, confirmar a ausência ou anular materiais de uma manutenção antiga cuja origem foi expressamente revista na TASK323. O original antigo continua sem comprovativo técnico. A evidência de origem e a declaração de materiais têm autores, datas, motivos e comprovativos administrativos próprios.

Os materiais declarados são conferidos contra o consumo líquido da visita. Quando compatíveis, podem receber uma parcela da atribuição MATERIAL já confirmada pela linha histórica de compra. Não há novo movimento de stock, nova compra, novo pagamento ou reescrita da conclusão antiga. Os tempos históricos continuam sujeitos ao lote seguinte.

## Vínculo e revisão

- A declaração de materiais histórica usa esquema 2 e identifica o hash da revisão de origem. O comprovativo da declaração incorpora a revisão de origem completa; o formato moderno de esquema 1 fica conservado.
- A elegibilidade atual verifica novamente o original antigo, a cadeia administrativa, a visita e a decisão comercial. Apenas a revisão de origem exata que sustentou os materiais os mantém confirmados. Uma revisão posterior não reautoriza automaticamente a declaração anterior.
- Alterar ou anular a origem assinala os materiais e as parcelas existentes para revisão. As quantidades e cêntimos das parcelas continuam reservados até à sua anulação financeira explícita. É possível confirmar de novo as mesmas quantidades, vinculando-as expressamente à nova revisão de origem.
- Depois de anular a origem, a declaração de materiais anterior pode ser anulada com a prova que a sustentou. Novas declarações exigem uma origem atual confirmada. Históricos danificados ou originais modernos sem recibo não entram por este percurso.
- Declarações de equipamentos e lembretes associados partilham os limites do consumo líquido. Parcelas de compras diferentes partilham a quantidade própria declarada. Uma origem por rever não liberta silenciosamente reservas nem faz desaparecer o custo antigo.

## Comprovativo financeiro

A parcela de materiais históricos no mesmo mês usa a versão 7, incluindo o comprovativo completo dos materiais e, dentro dele, o da origem histórica. A parcela entre meses continua na versão 6 da TASK322 e inclui os mesmos comprovativos. A quantidade, o técnico, o cliente, a piscina, a origem tipada, a declaração efetiva e o destino comercial têm de coincidir.

As versões anteriores continuam verificáveis. Omissão de prova histórica, alteração de evidência, mudança de origem e regressão artificial de versão são recusadas, mesmo com hashes exteriores recalculados. A projeção financeira e a anulação seguem as regras anteriores de conservação de cêntimos e meses.

## Interface e recuperação

O editor identifica a declaração de materiais como administrativa e histórica, mostra a evidência, o autor e a data da revisão de origem e permite consultá-la. A página da origem dá acesso aos materiais. Na prévia da parcela, a administração vê as duas declarações, a evidência e a indicação de que o recibo técnico original está indisponível.

Os pedidos conservam rascunho, confirmação explícita, UUID e recuperação pela conta original. Confirmar duas vezes ou perder a resposta não duplica a declaração. Alterar a origem durante uma declaração concorrente deixa o resultado dependente por rever ou recusa a proposta desatualizada. Os mesmos bloqueios da visita conservam a coerência com as parcelas e os consumos.

## Validação

- 531 testes unitários em 76 ficheiros, quatro testes técnicos; sintaxe 619 backend / 217 frontend / 62 scripts inline.
- Seis casos novos verificam o vínculo à origem administrativa, recusa de provas contraditórias, anulação com a origem anterior, formatos modernos conservados, nova confirmação com quantidades iguais e equivalência Node/navegador. As regras de meses incluem a versão 7.
- Ensaio integrado cria um original antigo pela operação original, sem fabricar ou editar recibos. Confirma permissões, duas instâncias, duplicação de UUID, reservas entre compras, origem alterada/anulada, nova vinculação, comprovativo original recuperado, concorrência e rollback de comprovativo/histórico/auditoria.
- Confirma explicitamente a conservação do original antigo, atribuições, stock e pagamentos, bem como a continuidade do bloqueio dos tempos históricos. Uma parcela de 0,1 kg conserva 33 cêntimos de uma atribuição de 100 cêntimos/0,3 kg; o restante permanece na visita.
- Navegador real: evidência consultável, rascunho, prova adulterada, clique duplo, resposta perdida, recuperação por GET sem novo POST, parcela com os dois comprovativos e limpeza ao mudar de conta. Larguras 320/390/1440 e modo escuro, incluindo contraste do link para a origem.
- Regressões aprovadas: revisão de origem histórica, correção de materiais, partilha de materiais e repartições entre meses de equipamentos/lembretes.
- Runner com 227 grupos; cache `cristalwater-field-20260924-v139`. Sem novas migrações, tabelas ou dependências; mantêm-se 39 migrações. CI nativo e restauro deste lote pendentes nesta versão documental.

## Continuação

Prosseguir os tempos históricos e as suas parcelas de trabalho com a mesma separação de comprovativos. Mantêm-se os restantes critérios de custos/receitas completos, documentos, volume, operação prolongada e dependências de produção.
