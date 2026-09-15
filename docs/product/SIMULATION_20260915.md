# Cristal Water — simulação prolongada de 15/09/2026

## TASK 79 — histórico GPS após uso prolongado

A versão separada foi validada no GitHub numa branch de testes, sem alterar o servidor ou a branch principal. Execução inicial: https://github.com/ts7520305-svg/cristalwater/actions/runs/34928734754.

Resultado inicial com PostgreSQL 16: 158 testes unitários, quatro testes específicos de técnico, 20 cenários de navegador e 19 grupos integrados aprovados. As cinco migrações aditivas preservaram os dados anteriores. O ensaio de recuperação restaurou 94 tabelas e 11 ficheiros enviados, com comparação do conteúdo das tabelas e hashes dos ficheiros.

Foi acrescentada uma simulação acelerada por API de 01/01/2027 a 31/12/2028: 731 dias de calendário, 104 semanas, três piscinas, dois técnicos com viaturas e guias, 312 visitas concluídas, 48 reenvios de conclusão, 156 kg de consumo esperado, 72 faturas mensais e 144 pagamentos parciais concorrentes. Os pedidos repetidos de geração de fatura devem responder 409 e conservar uma única fatura. Os clientes de teste têm mensalidade apenas na piscina, para não somar duas parcelas no cenário.

O calendário foi ainda exercitado durante 25 anos (2020–2044), em UTC e Europe/Lisbon: 9.132 dias por fuso, 300 finais de mês e sete dias bissextos. Verifica recorrência diária, semanal, mensal, próxima data e semanas sem dias duplicados.

Falha reproduzida: com 1.100 posições GPS, o endpoint devolvia as primeiras 1.000 e ocultava as mais recentes. Evidência local antes da correção: `run-1789446570457`. A consulta passou a selecionar as posições mais recentes, com desempate pelo ID, e a devolvê-las por ordem cronológica para conservar o percurso no mapa. Os filtros de identidade e o limite mantêm-se.

Ficheiros da tarefa: `src/business/technician/TechnicianGpsBusiness.js`, `scripts/test-field-two-year-api.js`, `scripts/test-field-suite.js`, `tests/round-calendar-years.test.js` e este relatório. A bateria integrada passa a ter 20 grupos. Antes do commit: 160 testes unitários e quatro específicos de técnico aprovados; sintaxe dos três ficheiros JavaScript alterados/adicionados aprovada.

Limites: as datas de visitas são históricas/futuras simuladas; não se acelera o relógio do servidor nem se demonstra disponibilidade contínua durante dois anos. O percurso prolongado usa autenticação administrativa para criar e concluir visitas; as permissões e percursos próprios dos técnicos/clientes continuam nos outros grupos. As posições GPS históricas são uma massa de dados de teste, não deslocações reais. Não houve envio de mensagens externas nem instalação no servidor. A validação final com estas alterações é registada no histórico de Actions da branch `work/field-readiness-20260915-simulation`.
