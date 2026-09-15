# TASK152 — Fatura de reparação com origem e transação única

## Problema

`RepairBusiness.generateRepairInvoice` abria uma transação, mas chamava a criação e emissão internas através de ligações independentes. O estado da reparação e os registos operacionais eram gravados posteriormente. Além disso, `FinanceOsBusiness.createDraftInvoice` descartava `referenceId` e `lineType`, apesar de a linha de reparação os fornecer.

O ensaio inicial `field-qa-runtime/run-1789499174407` interrompeu o servidor com P2028 ao tentar abrir a transação interna no adaptador PGlite; o controlador não tratava a exceção. A perda da referência e a separação das transações foram confirmadas na leitura do código.

## Correção

- Criação e emissão internas recebem a mesma transação da reparação. Fatura/linha, estado INVOICED, histórico técnico, auditoria e notificação interna ficam confirmados em conjunto; os três últimos registos deixam de ignorar erros neste percurso.
- O cliente e a reparação são bloqueados e relidos antes da transição. Um cliente Prisma de raiz recebido por parâmetro também abre uma transação; um cliente transacional reutiliza a transação do chamador.
- As referências das linhas são preservadas. Referências inválidas, pertencentes a outro cliente, repetidas no documento ou já presentes noutro documento são recusadas antes de criar a fatura. Uma reparação historicamente INVOICED não é faturada de novo, mesmo sem referência antiga recuperável.
- O serviço comum `repairInvoiceSourceService` coordena as referências por ID, em ordem, entre Finance OS e os três geradores mensais. Estes mantêm a exclusão histórica da TASK151.
- Os eventos existentes são emitidos depois do commit quando este negócio controla a transação. Com uma transação fornecida pelo chamador, não se emitem eventos antes do seu commit. Não foi criada uma fila durável de eventos.
- IDs, meses e valores de substituição malformados são recusados; o controlador devolve um erro tratado em vez de deixar uma exceção terminar o processo.

O campo `invoiceIssued` mantém o significado interno anterior; esta tarefa não liga nenhum prestador fiscal nem transmite documentos.

## Testes

Em `field-qa-runtime/run-1789499358841`, passaram a preservação de referências, bloqueio de repetições, validação de origem, seis pedidos dedicados simultâneos, competição com geração mensal e a reversão após falha no estado da reparação. O adaptador local fechou uma ligação no reenvio posterior à falha forçada, provocando 401 na consulta de autenticação; não se alterou o teste para aceitar esse resultado.

Passaram os cinco grupos de regressão: reparações entre meses, Repair OS operacional completo, orçamentos comerciais, Finance OS operacional e faturação de alertas. A versão final do novo grupo inclui também estado INVOICED legado, valores/meses inválidos e falhas em histórico, auditoria e notificação. Sintaxe aprovada em 506 ficheiros backend, 323 testes unitários e quatro testes de técnicos aprovados. Confirmar o workflow final em PostgreSQL 16 com 57 grupos e restauro.

Nove ficheiros: três negócios, controlador de reparações, serviço comum, teste, runner, relatório e checkpoint. Sem migração ou reescrita histórica. Documentos antigos sem referência e reparações cujo estado já foi alterado exigem revisão explícita; não se infere uma ligação a partir de texto livre.
