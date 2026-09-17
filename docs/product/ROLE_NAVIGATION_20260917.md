# TASK224 — Navegação correspondente ao perfil da página

## Reprodução

A revisão em API/base reais (`run-1789644423587`) abriu doze combinações de página/perfil. O prefixo do URL escolhia o menu: um cliente em `/settings`, `/config-notifications` ou `/help-center` recebia navegação ADMIN; um administrador em `/technician-profit` recebia navegação técnica. Cinco atalhos técnicos apontavam para páginas administrativas, cujas guardas devolviam corretamente o técnico ao modo de campo. Não houve concessão de acesso às APIs.

## Correção

- O menu comum usa o papel declarado pela página; na ausência dessa indicação, consulta o papel da sessão e só depois o prefixo do URL. TEAM_LEADER usa o menu técnico. A indicação de menu não substitui nenhuma guarda ou autorização da API.
- Foram retirados do menu técnico os quatro atalhos para gestão administrativa de piscinas, ficha técnica, reparações e inventário. A execução e os registos mantêm as entradas existentes Rota do dia e Visita. O atalho Viatura e stock abre a guia técnica existente; Histórico e Perfil abrem as páginas próprias já disponíveis.
- ADMIN mantém a central Configurações gerais. Foi removido o atalho duplicado que levava à página CLIENT de som. Avisos de manutenção abre os controlos existentes da central, com um nome correspondente à função, sem anunciar um editor geral de modelos/regras inexistente.
- Dezasseis entradas do catálogo foram alinhadas com as guardas existentes: oito CLIENT, seis TECHNICIAN/TEAM_LEADER e duas ADMIN de rentabilidade. Não foram alteradas permissões. O inventário atualizado tem 101 HTML, zero recursos locais em falta, referências literais a 43 páginas em 141 scripts ativos e três divergências de ajuda/configurações por tratar. Service worker v53.

## Validação

`run-1789644599897` aprovou o grupo TEAM_LEADER ampliado: o menu real abre guia, histórico e perfil, sem atalhos ADMIN nem perda de sessão; os restantes percursos PIN/email, offline, recusa e recuperação de rascunhos continuam a passar. A revisão das doze combinações confirmou menu CLIENT nas três páginas genéricas e ADMIN na página de rentabilidade. As cinco páginas administrativas continuam a recusar o técnico quando abertas diretamente, conservando os dados locais.

388 testes unitários aprovados localmente; sintaxe dos scripts alterados e diff verificados. TASK224 confirmada no commit `9006df083a03e624bf25f2fef9b625a4d1ae5bcd`, árvore `7009dca7c1cbb3bfc115f977d10a8040ecc901f6`, CI `35216365688`: 124/124 grupos, 388 unitários/quatro técnicos, 17 scripts de navegador, 20 migrações e sintaxe de 539 ficheiros. Restauro de 110 tabelas e 32 ficheiros com linhas e hashes iguais em PostgreSQL 16. A validação conjunta da TASK222–223 é distinta e não foi usada como prova automática desta navegação posterior.

## Limites confirmados

- `/settings` continua a receber 403 ao consultar preferências pertencentes a `User` com uma identidade CLIENT; a interface antiga tenta ler `settings.find` numa resposta sem essa lista. O teste simulado de entrada da TASK222 não era uma validação desse contrato de API. Corrigir o percurso e a mensagem sem alargar o acesso à tabela User.
- `/help-center` continua com guarda CLIENT e conteúdo/atalhos administrativos; ADMIN regressa ao centro de comando. O menu lateral CLIENT foi corrigido, mas o conteúdo da ajuda exige revisão própria.
- `/config-notifications` continua a usar preferências locais antigas. Deixou de ser promovido no menu ADMIN como um editor de modelos/regras.
- O inventário estático e estas combinações não constituem uma revisão visual completa de todas as páginas, estados, idiomas e PDFs. As versões anteriores ficam no Git.

Sem alterações a APIs, schema, main, deploy, serviços externos ou ao PNG não publicado perdido anteriormente.

Atualização posterior: a TASK225 trata o erro da página de preferências e permite a entrada dos perfis autenticados, mantendo a autorização User no servidor. CLIENT/PIN recebem indisponibilidade explícita; uma identidade User autorizada consulta/grava o próprio registo. A ajuda e a configuração local antiga permanecem por rever.
