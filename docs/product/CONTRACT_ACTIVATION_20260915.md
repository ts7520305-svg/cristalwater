# TASK153 — Ativação de contratos e recebimento inicial

A reprodução `field-qa-runtime/run-1789499949180` confirmou que ativar com 10 EUR substituía os 5 EUR de crédito existentes por 10 EUR, perdendo saldo. Os quatro percursos de ativação passam pelo mesmo negócio e reutilizam o registo comum de recebimentos dentro de uma única transação.

O recebimento paga primeiro dívida elegível e acrescenta apenas o excedente ao crédito anterior. Sem recebimento, a ativação conserva saldo, estado e data do histórico de pagamentos. Cliente, recebimento, auditoria, comunicação interna e confirmação do pedido são confirmados ou revertidos em conjunto.

Um UUID v4 identifica a operação e permite recuperar a confirmação original através de qualquer um dos quatro percursos. Alterar os dados, responsável ou reutilizar a chave noutro tipo de pagamento devolve 409. A ativação positiva de um contrato já ativo é recusada; novos recebimentos usam o percurso de pagamentos. Integrações antigas sem UUID continuam aceites, mas uma repetição positiva após ativação é recusada. Só administradores podem ativar.

Em `field-qa-runtime/run-1789500059859`, passaram o novo grupo de ativação, a regressão de recebimentos e a simulação de dois anos (24 meses, 72 faturas e 144 pagamentos parciais). Cobertura: quatro APIs, saldo anterior, dívida antiga, ausência de recebimento, oito pedidos simultâneos, competição com recebimento independente, dados inválidos, ausência de autenticação e reversão integral após falha forçada de auditoria. O runner passa a 58 grupos.

Nove ficheiros: novo negócio, dois negócios existentes, controlador, router, teste, runner, relatório e checkpoint. Sem alteração de esquema. A recuperação persistente do pedido no formulário ainda exige trabalho próprio; esta entrega fecha o percurso da API. Não reescreve ativações históricas nem recupera valores anteriormente perdidos sem evidência.
