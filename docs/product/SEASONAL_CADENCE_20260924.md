# TASK327 — Cadências semanais e mensais com data de referência

O editor de serviços por época permite repetir os horários a cada 1–52 semanas ou 1–24 meses. Intervalos superiores a um exigem uma data de referência: a semana começa à segunda-feira, o mês é civil, e nenhuma visita ocorre antes dessa data. O ciclo continua entre meses, épocas e anos; uma época não reinicia silenciosamente a contagem. Dias mensais 29–31 mantêm o ajuste ao último dia do mês.

O número de visitas refere-se à semana ou mês ativo. Horários incompletos permanecem pendentes apenas nos ciclos ativos. Uma frequência de duas semanas não corresponde a duas visitas por mês. A mensalidade continua a ser o valor total acordado e não é multiplicada ou reduzida pela frequência.

Os acordos semanais/mensais anteriores conservam a estrutura normalizada original. A alteração passa pela simulação, versão imutável, confirmação recuperável e aplicação transacional existentes. Visitas iniciadas ou alteradas manualmente continuam protegidas. Não foram criadas migrações, tabelas ou dependências; cache v144.

## Verificação

- 554 testes unitários em 77 ficheiros, quatro técnicos e sintaxe 620 backend / 217 frontend / 62 scripts inline aprovados.
- Seis novos testes: semanas alternadas atravessando o ano, referência ao domingo, meses trimestrais e fevereiro bissexto, compatibilidade de snapshots/preços, validação e dois anos de contagem independente.
- API numa base descartável com as 40 migrações: doze meses de visitas quinzenais e trimestrais, datas verificadas por sequência independente, concorrência, repetição exata, revisão de frequência, acordos anteriores e execução preservados. Regressão sazonal existente de 24 meses e três geradores de documentos também aprovada.
- Chromium real: edição, referência, rascunho após recarga, gravação da versão e preço preservado. Regressões do editor a 320/390/1440, claro/escuro, resposta perdida, offline, armazenamento indisponível e mudança de conta aprovadas.

Ensaios executados em PGlite/socket e Chromium isolados, com fornecedores externos desligados. O CI completo em PostgreSQL 16 e restauro desta alteração permanece pendente. Exceções datadas e preço por visita continuam requisitos próprios.


## CI inicial e preparação temporal corrigida

O CI inicial da TASK327, [36038686127](https://github.com/ts7520305-svg/cristalwater/actions/runs/36038686127), job `107765087773`, executou os 229 grupos: 228 passaram e `test-field-equipment-history-time.js` falhou com `VISIT_REVIEW`. O restauro ficou por executar. O ensaio arredondava a conclusão para o segundo seguinte; numa execução rápida, a associação do lembrete chegava antes dessa hora. A proteção da aplicação recusou corretamente a conclusão futura. O ensaio passa a aguardar esse instante durante a preparação, conservando os 180 segundos, a conclusão original do equipamento e todas as verificações da aplicação. [Evidência inicial](evidence/20260924_task327_initial_failure.json). Confirmar um novo CI completo e restauro antes de aprovar o lote.
