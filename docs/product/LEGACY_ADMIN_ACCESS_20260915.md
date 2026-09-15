# TASK170 — Autenticação da administração antiga

Em 15/09/2026, a reprodução isolada `field-qa-runtime/run-1789507590507` confirmou que `GET /api/pools` devolvia 200 sem sessão. A revisão dos routers montados encontrou o mesmo tipo de ausência de guarda em operações de gestão, planeamento, históricos e IA administrativa.

`legacyAdministrationAccess.js`, instalado antes dos routers em `server.js`, exige ADMIN ativo em 30 prefixos explícitos, incluindo os aliases antigos. Reutiliza a validação de sessão e perfil existente. A correspondência de segmentos do Express preserva `/api/route`, os percursos específicos de campo/cliente e os logins. Leituras globais, escritas, ensaios de IA e o antigo GET de criação de localizações ficam abrangidos. A lista exata está no módulo; não se trata de uma autorização administrativa universal para todos os endpoints.

O ensaio final `field-qa-runtime/run-1789507700323` passou três grupos: nova matriz HTTP, matriz anterior de acesso e percurso real Chromium de configuração e execução de manutenção por um técnico. Verifica anónimo, CLIENT, TECHNICIAN, TEAM_LEADER, token inválido e técnico desativado; recusa de mutações sem alterar piscinas/zonas/localizações/encerramentos; aliases e maiúsculas; leitura e alteração legítimas pelo ADMIN; portal CLIENT e otimização de rota TECH. Os 323 testes unitários e quatro testes de técnicos passaram. Sintaxe dos ficheiros alterados validada.

Ficheiros: novo middleware, `server.js`, teste integrado, runner, este relatório e checkpoint (seis). Sem migração nem alteração dos payloads autorizados. Os ecrãs administrativos atuais usam o cabeçalho de autenticação comum de `cw-auth.js`.

Limites: esta tarefa protege a entrada das APIs globais antigas; não torna as suas mutações atómicas ou idempotentes. Chats por piscina/serviço, chat interno e perfil antigo do cliente precisam de regras próprias de titularidade. Rever também o resultado do lembrete manual antigo: atualmente faz chamadas internas sem sessão e ignora o estado HTTP. Não declarar conclusão global com estes pontos em aberto.

Base anterior confirmada: TASK168/TASK169, commit remoto `42455e1c3131a15c38a95e38e3690ea850b975f7`, workflow `35024969768`: 73 grupos aprovados e restauro de 99 tabelas/11 anexos com hashes iguais.
