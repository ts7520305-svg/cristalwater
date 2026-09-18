# TASK264 — Idioma dos relatórios abertos pelos alertas

## Comportamento

O painel de alertas permite escolher Português, English, Français ou Español antes de abrir o relatório ADMIN de uma visita REGULAR ou EXTRA. Usa o catálogo e a projeção PDF já aprovados na TASK263. A escolha aplica-se aos títulos e mensagens, preservando notas e valores introduzidos no registo.

O pedido envia lang explicitamente e exige Content-Language correspondente, além das verificações de tipo de documento, tipo/ID de visita, cliente e vista ADMIN. Idioma vazio/desconhecido ou seletor ausente não gera um pedido. Mudar o idioma invalida a operação anterior, incluindo uma sequência A-B-A enquanto a resposta está em voo. A sessão alterada bloqueia seletor e botões. Atualização, filtros, recusa de resposta incorreta, offline e libertação das URLs temporárias mantêm as proteções anteriores.

A escolha é local à página e começa em português; não grava preferência de cliente nem altera o idioma geral da aplicação. O seletor não filtra alertas nem traduz a lista de alertas. Centro mensal é um relatório financeiro distinto: a sua tradução e seleção de idioma exigem tarefa própria. Restantes preferências por cliente ficam para percurso posterior.

## Verificação

Run local `run-1789739603832`: abertura pelos alertas e relatório EXTRA aprovados. O percurso abre os dois tipos nos quatro idiomas com a API real, confirma título e notas originais, cancela ao trocar de idioma (incluindo A-B-A), recusa seleção inválida sem pedido, recusa idioma de resposta errado ou ausente, e confirma bloqueio após troca de sessão. Regressões de IDs coincidentes, clientes diferentes, associações ambíguas, filtros, atualização, offline e respostas incompletas preservadas. Contadores de efeitos financeiros e operacionais mantidos.

396 unitários/63 ficheiros e quatro técnicos; sintaxe 556 backend/182 frontend/56 inline. Runner 151, 21 migrações mantidos. Cache v84. Sem API, dependências ou alterações de esquema. Seletor revisto em 320/390/1440 px, dentro do ecrã e altura mínima de 44 px. Evidência sintética: `reports/field-visual/extra-alert-report-1789739610418`. Contraste do botão de relatório 6,51:1.

Seis ficheiros: admin-alerts.html, admin-alerts.js, sw.js, test-field-alert-report-opening.js e os dois documentos de checkpoint. Código PDF, fontes e catálogo da TASK263 mantidos.

CI nativo/restauro aprovados no registo abaixo. Branch de trabalho autorizada, sem merge/deploy. Frequência individual por cliente/época/instalação preservada: três ou mais visitas conforme cada caso.

## Aprovação nativa

Commit `f754d2fccca80c1ac3a9b4a583e7391a03a9b754`, árvore `434348980ec3f650ba26ed33a0db171806de403a`, [CI 35353107144](https://github.com/ts7520305-svg/cristalwater/actions/runs/35353107144), job `105625750125`, concluído em 18/09/2026 às 14:12:02 UTC. 151/151 grupos distintos com código zero e sem sinal, 396 unitários/63 ficheiros, quatro técnicos, gate de navegador, 21 migrações aditivas e sintaxe 556/182/56. Abertura pelos alertas com idiomas: 20078 ms. Restauro isolado de 110 tabelas/46 ficheiros, com linhas e hashes iguais. Cache v84. Esta atualização posterior altera apenas documentação e conserva o código/testes validados. Publicação na branch autorizada, sem merge/deploy. Backup `backup/alert-language-local-20260918`.
