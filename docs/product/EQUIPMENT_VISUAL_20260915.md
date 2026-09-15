# TASK109 — Percurso real de manutenção preventiva

`scripts/test-field-equipment-flow.js` exige servidor e base isolados com `NODE_ENV=test`, `QA_MODE=true` e `QA_ENVIRONMENT_SAFE=true`. Usa `CW_BASE_URL`, `CW_CHROMIUM_PATH` e as credenciais administrativas QA existentes. Cria piscina, cliente, técnico e visita em curso fictícios; nunca deve ser executado em produção.

O administrador entra pelo formulário real e cria um plano trimestral de revisão do filtro em Configurações operacionais. O teste verifica a gravação no PostgreSQL/Prisma. O técnico entra com PIN pelo formulário real, abre o separador Visita, consulta as instruções, regista as observações, confirma o trabalho realizado e submete pelo botão real.

A validação exige execução única, histórico técnico único, avanço da versão e próxima data três meses após o dia da execução em Lisboa, com ajuste ao último dia do mês quando necessário. Atualizar os painéis não pode duplicar o registo. A administração tem de mostrar a última execução do técnico. Não são usados mocks de API, sessões injetadas ou chamadas diretas de backend para completar a revisão.

Guarda quatro imagens reais dos painéis antes/depois, imagens de falhas e resultados em `reports/equipment-flow/<timestamp>/`. O percurso móvel verifica largura 390 px e altura 844 px; as capturas isoladas usam altura 1200 px para evitar sobreposição da navegação fixa em cartões longos. Credenciais são removidas dos campos antes de qualquer captura de falha.

Este cenário comprova o fluxo integrado em navegador com servidor QA. Não constitui inspeção física do filtro nem certifica a realização do trabalho pelo técnico.
