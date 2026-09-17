# Cadastro de clientes em campo — diagnóstico para a próxima correção

Diagnóstico anterior preservado em 17/09/2026. Cadastro e aprovação foram depois implementados e ensaiados nas TASK242–243; ver `FIELD_CLIENT_INTAKE_RECOVERY_20260917.md` para estado do CI e limites. O relatório ADMIN no final continua por corrigir. Base examinada: `9b392f18a528608176d8e01d32dc294aa9850038`.

## Resultado observado

Ensaio local isolado `run-1789674821158`, executado com o router de produção, autenticação real e PGlite. Todos os dados e intervenientes foram criados para QA, com fornecedores externos desligados.

| Percurso | Reprodução | Resultado |
|---|---|---|
| Permissões do formulário | Técnico autenticado consulta `/api/technician-intake/settings` depois de se criar uma configuração QA alheia ao cadastro | HTTP 200 inclui a configuração sentinela no mapa completo. Prova de âmbito excessivo; não houve leitura ou exposição de segredos reais. |
| Reenvio após resposta perdida | A resposta HTTP é destruída depois do commit; repete-se o mesmo pedido de cliente/piscina | Dois clientes criados. O endpoint não possui UUID/comprovativo de operação. |
| Validação numérica | Submeter latitude 500, longitude -999 e volume -5 | HTTP 200, valores inválidos persistidos. O código verifica conversão finita, sem limites geográficos/volume positivo. |
| Aprovação parcial | Depois de criar uma ficha pendente, injetar falha no método de atualização das piscinas e aprovar o cliente | HTTP 500; cliente fica aprovado e piscina continua pendente. As duas escritas não partilham transação. |
| Autor da aprovação | Nessa aprovação, enviar o ID de outro administrador no body | O cliente guarda o ID enviado, diferente do administrador autenticado. |

A falha da aprovação foi injetada no método `prisma.pool.updateMany` do processo HTTP isolado, depois da atualização real do cliente. Não foi apresentada como falha de produção nem ensaio PostgreSQL nativo. Uma tentativa anterior com triggers (`run-1789674772718`) encontrou erro de protocolo/ligação no adaptador local e não é usada para afirmar sucesso falso ou rollback do cadastro.

## Inspeção adicional e âmbito necessário

`technician-new-client.js` repõe o formulário ao receber um `ok` genérico; ainda não conserva um pedido/rascunho próprio nem confirma conta, cliente, piscina e conteúdo originais. A autoria do técnico já é validada na API: o diagnóstico não a apresenta como uma falha nova. A consulta é autenticada; a lacuna é devolver todas as configurações ao técnico em vez das três capacidades do cadastro.

A criação já usa uma transação para cliente/piscina, mas tolera falhas de tarefa/auditoria com `catch`. O comportamento em PostgreSQL nativo perante essas falhas precisa de um ensaio próprio. Não se deduz aprovação global nem sucesso falso desse padrão apenas por leitura de fonte.

O âmbito de implementação identificado neste diagnóstico foi cadastro e aprovação separadamente: permissões limitadas ao necessário, validação explícita, autoria da sessão, escritas/auditoria obrigatórias, UUID/comprovativo, revisão de versões na aprovação e recuperação do formulário. Preservar fichas históricas e rascunhos existentes sem lhes atribuir autoria presumida. Os testes deverão cobrir reenvio, falhas em cada escrita, duas janelas, troca de conta e aprovação parcial.

## Relatório administrativo — diagnóstico separado

O ecrã real `/admin-reports` foi depois exercitado em Chromium, com conta ADMIN de QA e respostas HTTP controladas (`run-1789675099019`, 2388 ms):

- Selecionar fevereiro de 1999 e atualizar volta a pedir `/api/admin/reports`, `/api/core/dashboard` e `/api/communications` sem período. O valor global fornecido pelo ensaio permanece igual, agora acompanhado pelo mês escolhido. Esta prova verifica o comportamento do ecrã/transporte; não é um apuramento financeiro real desse mês.
- Ao devolver HTTP 503 nas três fontes, a página apresenta valores zero e «Relatorios atualizados.» com estado de sucesso. A falha deixa de ser distinguível de ausência de atividade.

A inspeção de `admin-reports.js` confirma a causa: `readJson` devolve fallbacks e `load` anuncia sucesso incondicionalmente; selectedMonth só é usado na legenda. Esta lacuna ainda não foi corrigida. Deverá ser tratada com fontes e período explícitos, erro/recuperação e preservação da diferença entre valor zero e informação indisponível, reutilizando os serviços financeiros existentes.
