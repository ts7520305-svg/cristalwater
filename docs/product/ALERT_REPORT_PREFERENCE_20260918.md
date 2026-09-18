# TASK267 — Preferência do cliente na abertura pelos alertas

Os alertas ADMIN passam a começar em "Idioma preferido do cliente". Cada abertura REGULAR/EXTRA consulta as configurações do cliente confirmado pelo alerta, confirma PT/EN/FR/ES e a versão e pede o PDF com esses valores. A resposta deve confirmar idioma, versão, cliente, tipo e ID da visita e vista ADMIN antes de apresentar o ficheiro. Sem preferência guardada, o serviço existente confirma português. O estado de sucesso identifica o idioma recebido. Seleção explícita PT/EN/FR/ES continua válida apenas para essa abertura e não consulta nem modifica a preferência.

O controlador de abertura partilhado reserva a janela dentro do clique, antes da consulta assíncrona. A resolução da preferência usa a mesma credencial, limite de tempo, cancelamento, contexto e proteção de sessão do PDF. Resposta inválida ou consulta falhada impede o pedido de PDF; mudança das configurações entre os dois pedidos é recusada pelo servidor e exige nova abertura. Mudança de idioma A-B-A, atualização da lista e mudança de conta anulam uma consulta em curso. Não há novas rotas, escritas, migrações ou dependências.

## Validação local

Run `run-1789753766874`: regressões de abertura mensal/individual e configurações recuperáveis aprovadas. O novo ensaio de 401 esperava incorretamente um estado de erro na página; o guarda global encaminhou corretamente para login. O teste foi corrigido para verificar esse encaminhamento e ausência de pedido PDF, sem alterar a proteção da aplicação.

Run final `run-1789753856457`: alertas aprovados. Verifica preferências francesas/espanholas em clientes diferentes com IDs de visita coincidentes, títulos e notas dos PDFs, credenciais nos dois pedidos, idioma explícito sem leitura da preferência, português confirmado quando não há registo, resposta de outro cliente/idioma/versão inválidos, 202/503, identidade da resposta PDF, alteração concorrente da preferência, nova abertura com o valor atualizado, cancelamento durante a consulta, 401 e sessão alterada. Registos de preferências e contadores financeiros/operacionais iguais antes/depois das leituras; alterações da fixture são repostas. Percursos anteriores de referências ambíguas, isolamento REGULAR/EXTRA, filtros, atualização, janela bloqueada, rede e conteúdo truncado preservados.

396 unitários/63 ficheiros, quatro técnicos e sintaxe 557 backend/182 frontend/56 inline aprovados. Capturas `reports/field-visual/extra-alert-report-1789753862675`, 320/390/1440 px, revistas. Contraste dos botões 6,51:1. Cache v87, runner 151 e 21 migrações existentes mantidos. CI nativo e restauro aprovados no registo abaixo.

## Âmbito e retoma

Sete ficheiros: admin-alerts.html, admin-alerts.js, cw-report-download.js, sw.js, test-field-alert-report-opening.js e dois documentos de checkpoint. Publicação apenas na branch de trabalho autorizada; sem merge/deploy. Preferência de idioma e notas originais preservadas. Frequência por cliente/época/instalação continua caso a caso, três ou mais visitas quando necessário.

Próximo percurso: rever os restantes pontos de acesso a documentos e relatórios nos perfis ADMIN/TÉCNICO/CLIENTE, começando pelos que ainda usam links diretos, para confirmar autenticação, contexto e experiência de abertura. Não aplicar automaticamente o controlador ADMIN a outros perfis.

## Aprovação nativa

Commit `4207885d754091886f9048563346fa72e7bc5499`, árvore `b9edaa59f9a0f9927603b867ff9882ce40b4022e`, [CI 35376929900](https://github.com/ts7520305-svg/cristalwater/actions/runs/35376929900), job `105703681708`, concluído em 18/09/2026 às 18:09:32 UTC. 151/151 grupos distintos com código zero e sem sinal, 396 unitários/63 ficheiros, quatro técnicos, gate de navegador, 21 migrações aditivas e sintaxe 557/182/56. Abertura pelos alertas: 28972 ms; abertura mensal/individual: 9807 ms; configurações recuperáveis: 33861 ms; relatório extra: 4059 ms. Restauro isolado de 110 tabelas/46 ficheiros, com linhas e hashes iguais. Cache v87. Esta atualização posterior altera apenas documentação e conserva o código/testes validados. Publicação na branch autorizada, sem merge/deploy. Backup `backup/alert-preference-local-20260918`.
