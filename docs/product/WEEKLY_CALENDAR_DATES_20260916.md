# Datas civis do plano semanal — TASK209

## Falha e correção

A consulta `/api/rounds/week?date=2032-02-29` interpretava a data civil como meia-noite UTC e calculava depois a semana no fuso local. Em America/Chicago, o domingo pedido passava a sábado da semana anterior e ficava fora do plano. O grupo Route OS reproduziu a falha em `run-1789590233409`; a mesma consulta passava em UTC.

`AdminWeeklyPlanningBusiness` passa a interpretar `AAAA-MM-DD` à meia-noite local do servidor. A semana continua a começar no domingo e a terminar no domingo seguinte, com limite exclusivo. Instantes ISO com fuso explícito conservam a sua semântica de instante; formatos ambíguos, datas impossíveis e valores que não sejam texto recebem HTTP 400 e `INVALID_WEEK_DATE`, antes da consulta à base.

A resposta acrescenta `referenceDate`, `weekStartDate`, `weekEndDate` e `days[].calendarDate` para identificar as datas civis sem cortar um instante UTC. Os campos ISO existentes são conservados, incluindo os usados na aplicação das atribuições de técnicos. Não altera recorrências, duração de períodos nem dados persistidos.

## Evidência

- Cinco processos com fusos independentes: UTC, America/Chicago, Europe/Lisbon, Asia/Tokyo e Pacific/Auckland. Verificam sete dias à meia-noite local, inclusão da data pedida, ano bissexto, passagem de ano, recorrência mensal, agrupamento de visitas e semanas de 167/169 horas nas mudanças de hora de Chicago/Lisboa.
- Onze entradas inválidas recusadas antes de qualquer leitura da base; instante ISO explícito conserva o comportamento anterior.
- Route OS aprovado em `run-1789590728231` com o fuso America/Chicago que reproduzia a falha. Inclui a consulta do dia bissexto, erros HTTP, recorrências, atribuições e jornada.
- 387 testes unitários em 62 ficheiros e sintaxe de 533 ficheiros backend aprovados. O runner conserva 112 grupos; sem migração nova. Confirmar o CI e restauro da árvore publicada.

## Limites

O calendário usa o fuso configurado no servidor, sem introduzir uma configuração por empresa ou utilizador. Esta revisão cobre o plano semanal administrativo `/api/rounds/week` e o respetivo alias; outros planeadores têm contratos próprios e não foram declarados validados em todos os fusos.
