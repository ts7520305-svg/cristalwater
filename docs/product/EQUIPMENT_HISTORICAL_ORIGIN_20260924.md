# TASK323 — Revisão administrativa da origem histórica de equipamento

Base funcional: TASK322, código `8716f28f1f65356a7f96d5d1e6b4c0b8e54501ac`. Publicação na branch `work/field-readiness-20260915-simulation` após o fecho documental desse lote.

## Objetivo

Permitir à administração confirmar, corrigir ou anular a declaração de origem de um registo antigo de manutenção de equipamento que nunca teve um comprovativo técnico recuperável. A evidência consultada, o técnico escolhido, a visita, o cliente, a piscina, o autor administrativo, a data e o motivo ficam num histórico próprio. A conclusão original, a sua autoria literal, o pedido e a resposta antigos permanecem conservados.

Esta declaração não transforma uma observação antiga num comprovativo técnico. Também não declara materiais, intervalos de trabalho ou custos. A utilização desta origem revista nesses percursos é um lote posterior; os editores de recursos continuam a recusar o original antigo nesta entrega.

## Elegibilidade e prova

- Só é elegível o formato antigo exato da resposta de conclusão, com versão, datas, plano e fingerprint original SHA-256 compatíveis com o pedido antigo. O fingerprint mantém a ordem de serialização usada nessa operação; não é substituído pelo hash canónico das operações atuais.
- O registo tem de ter exatamente uma visita tipada REGULAR/EXTRA e uma origem atual confirmável. A visita deve estar concluída, com cliente, piscina, técnico e datas compatíveis, e a decisão comercial da manutenção tem de estar revista.
- A administração escolhe explicitamente o técnico da visita, sem pré-seleção na primeira declaração, descreve a evidência consultada entre 10 e 2000 caracteres e indica um motivo entre 3 e 500 caracteres. O cliente e a piscina são conferidos na proposta; não há alteração implícita da visita.
- Registos modernos, incluindo os que perderam o comprovativo ou o tenham danificado, ficam excluídos deste percurso. A existência de um comprovativo técnico também impede a elegibilidade como original antigo sem recibo.
- A prova administrativa conserva a fotografia do original, a origem tipada, a visita e a decisão comercial. Mudanças posteriores da origem levam a revisão. A anulação conserva todos os comprovativos anteriores; não modifica a conclusão antiga.
- O comprovativo usa `EQUIPMENT_HISTORY_REVIEW`, distinto de `EQUIPMENT_MAINTENANCE`, e o histórico encadeia as revisões anteriores. Servidor e navegador verificam o mesmo conteúdo, identidade administrativa, operação, motivo, origem e hashes. Histórico danificado bloqueia novas declarações.

## Concorrência, conservação e interface

O pedido é guardado antes do envio, fica associado à conta e pode ser consultado ou reenviado com o mesmo UUID. Pedidos iguais concorrentes devolvem a mesma confirmação. Uma proposta que perdeu a validade conserva uma resposta de não aplicação. Comprovativo, histórico técnico e auditoria são gravados na mesma transação; uma falha em qualquer dos três impede gravações parciais.

A revisão usa os bloqueios da origem e da decisão comercial existentes. A recuperação de um pedido confirmado continua possível depois de mudar o técnico da visita. Compras, pagamentos, atribuições de custo, movimentos de stock e a linha original de conclusão não são alterados.

A página abre pela revisão comercial de equipamentos e mostra o original, a declaração administrativa atual, a evidência e o histórico. Identifica a indisponibilidade do recibo técnico e conserva o identificador literal de autoria antiga. Reutiliza o editor administrativo e a persistência existentes, com espaço de pedidos e rascunhos separado. Textos da evidência e observações são apresentados como texto, incluindo conteúdo com aparência de HTML.

## Validação

- 525 testes unitários em 76 ficheiros, quatro testes técnicos; sintaxe 618 backend / 217 frontend / 62 scripts inline.
- Seis casos unitários novos: reconhecimento do formato e fingerprint antigos, exclusão de fontes modernas/danificadas, técnico e evidência explícitos, contradições com hashes recalculados, vinculação do comprovativo e equivalência Node/navegador.
- Ensaio integrado da API: permissões, identificadores estritos, origem inválida, substituição/anulação, dois processos, pedido repetido, propostas concorrentes, três falhas transacionais, alteração do técnico, recuperação exata, histórico e original adulterados. Verifica a conservação da conclusão original, stock, despesa e pagamentos, e a manutenção do bloqueio dos editores de recursos antigos.
- Navegador real: exclusão do registo moderno, técnico inicialmente vazio, texto sem execução de HTML, rascunho após recarga, proposta adulterada, resposta perdida, clique duplo, recuperação por consulta sem novo POST, anulação e limpeza ao mudar a conta. Verificação visual em 320/390/1440 e modo escuro.
- Regressões dirigidas dos editores de materiais e tempos, que partilham o mesmo componente de interface.
- Runner com 226 grupos; cache `cristalwater-field-20260924-v138`. Sem novas migrações, tabelas ou dependências; mantêm-se 39 migrações. CI nativo e restauro deste lote pendentes nesta versão documental.

## Continuação

Integrar a origem administrativa verificada nas declarações históricas de recursos, conservando a ausência do comprovativo técnico original e revendo explicitamente os custos quando a origem ou os recursos mudam. Mantêm-se os restantes critérios da matriz, incluindo cobertura financeira integral, operação prolongada e dependências de produção.
