# Cristal Water — simulação prolongada de 15/09/2026

## TASK 79 — histórico GPS após uso prolongado

A versão separada foi validada no GitHub numa branch de testes, sem alterar o servidor ou a branch principal. Execução inicial: https://github.com/ts7520305-svg/cristalwater/actions/runs/34928734754.

Resultado inicial com PostgreSQL 16: 158 testes unitários, quatro testes específicos de técnico, 20 cenários de navegador e 19 grupos integrados aprovados. As cinco migrações aditivas preservaram os dados anteriores. O ensaio de recuperação restaurou 94 tabelas e 11 ficheiros enviados, com comparação do conteúdo das tabelas e hashes dos ficheiros.

Foi acrescentada uma simulação acelerada por API de 01/01/2027 a 31/12/2028: 731 dias de calendário, 104 semanas, três piscinas, dois técnicos com viaturas e guias, 312 visitas concluídas, 48 reenvios de conclusão, 156 kg de consumo esperado, 72 faturas mensais e 144 pagamentos parciais concorrentes. Os pedidos repetidos de geração de fatura devem responder 409 e conservar uma única fatura. Os clientes de teste têm mensalidade apenas na piscina, para não somar duas parcelas no cenário.

O calendário foi ainda exercitado durante 25 anos (2020–2044), em UTC e Europe/Lisbon: 9.132 dias por fuso, 300 finais de mês e sete dias bissextos. Verifica recorrência diária, semanal, mensal, próxima data e semanas sem dias duplicados.

Falha reproduzida: com 1.100 posições GPS, o endpoint devolvia as primeiras 1.000 e ocultava as mais recentes. Evidência local antes da correção: `run-1789446570457`. A consulta passou a selecionar as posições mais recentes, com desempate pelo ID, e a devolvê-las por ordem cronológica para conservar o percurso no mapa. Os filtros de identidade e o limite mantêm-se.

Ficheiros da tarefa: `src/business/technician/TechnicianGpsBusiness.js`, `scripts/test-field-two-year-api.js`, `scripts/test-field-suite.js`, `tests/round-calendar-years.test.js` e este relatório. A bateria integrada passa a ter 20 grupos. Antes do commit: 160 testes unitários e quatro específicos de técnico aprovados; sintaxe dos três ficheiros JavaScript alterados/adicionados aprovada.

Limites: as datas de visitas são históricas/futuras simuladas; não se acelera o relógio do servidor nem se demonstra disponibilidade contínua durante dois anos. O percurso prolongado usa autenticação administrativa para criar e concluir visitas; as permissões e percursos próprios dos técnicos/clientes continuam nos outros grupos. As posições GPS históricas são uma massa de dados de teste, não deslocações reais. Não houve envio de mensagens externas nem instalação no servidor. A validação final com estas alterações é registada no histórico de Actions da branch `work/field-readiness-20260915-simulation`.

## TASK 80 — diagnóstico visível de falhas de integração

A execução 34929183943 aprovou os 19 grupos anteriores, mas a simulação nova falhou em PostgreSQL real. O runner só mostrava o código de saída e remetia o erro para o artefacto ZIP. Passa a aguardar o fecho dos streams e a mostrar as últimas 12.000 posições do log do teste falhado no próprio job, sem alterar as verificações nem ocultar falhas. Ficheiros: runner e este relatório. A repetição em CI identifica a causa antes de qualquer declaração de sucesso final.

## TASK 81 — pagamentos simultâneos sem perda de saldo

A execução 34929473933 reproduziu a falha no PostgreSQL real: dois pagamentos de 20 EUR constavam dos registos, mas `amountPaid` da fatura ficava em 20 EUR em vez de 40 EUR. As duas transações liam o mesmo saldo e a última escrita substituía a anterior. A simulação local PGlite não reproduzia esta concorrência, pelo que não era suficiente para validar este cenário.

O pagamento do fluxo core passa a uma Business própria, reutilizando os cálculos e o serviço de crédito existentes. A transação bloqueia a linha da fatura antes de ler o saldo e de criar o pagamento. Assim, cada pagamento concorrente lê o resultado confirmado do anterior. A rota delega a operação e conserva o formato da resposta, os erros de fatura inexistente/valor inválido e a conversão de excedente em crédito. Não se altera a estrutura da base de dados.

Ficheiros: `src/business/finance/CoreInvoicePaymentBusiness.js`, `src/routes/coreFlowRoutes.js` e este relatório. O teste mantém os 144 pagamentos concorrentes e exige a reconciliação entre pagamentos, valor pago, saldo aberto e estado da fatura. A correção incide neste endpoint; não constitui certificação de todos os outros percursos financeiros ou de reenvios de pedidos de pagamento.
