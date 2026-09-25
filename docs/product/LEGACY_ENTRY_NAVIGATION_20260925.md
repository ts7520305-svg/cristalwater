# TASK350 — entradas antigas e atalhos do cliente

As três entradas administrativas antigas passam a ter um único encaminhamento por perfil. O atalho Resumo do serviço dos dois menus do cliente abre o portal; o painel deixa de voltar a si próprio. [Evidência local](evidence/20260925_task350_local.json).

## Comportamento entregue

- `/admin-command-center`, `/admin-core-flow` e `/admin-operational-flow` usam um único script, sem a corrida anterior entre meta-refresh, scripts de entrada e navegação comum. ADMIN segue para `/admin-master-control`, CLIENT para `/client-portal` e TECHNICIAN/TEAM_LEADER para `/technician-field-mode`.
- A entrada lê os aliases de identidade existentes, exige papel e identidade coerentes com o token e verifica a expiração. Ausência, inconsistência, erro de armazenamento ou sessão expirada encaminham para o login. As identidades User e Technician do chefe de equipa conservam os seus domínios.
- Só um parâmetro `lang` PT/EN/FR/ES/DE reconhecido é encaminhado. Outros parâmetros e fragmentos, incluindo destinos externos ou dados de sessão, são descartados. O destino é fixo, da mesma origem. Se o JavaScript não carregar, permanece uma ligação para o login.
- O script de entrada não consulta APIs nem altera o armazenamento. As guardas e autenticação das páginas/API de destino continuam a decidir o acesso; descodificar o token para navegar não valida a sua assinatura.
- `/client-dashboard` e `/client-menu` mantêm as guardas de cliente e a navegação comum. Os cartões usam os destinos canónicos do portal, pagamentos, notificações e, no menu, histórico. O inventário passa a documentar os três encaminhamentos antigos e as cinco páginas com referência literal no novo ensaio.

## Validação

635 testes unitários em 89 ficheiros, quatro técnicos e sintaxe de 632 ficheiros backend, 232 frontend e 58 scripts inline aprovados. Três grupos integrados locais: entradas antigas, login/saída/preservação de trabalho e navegação comum. O novo grupo voltou a passar depois de fixar explicitamente a lista de entradas e cartões esperados no ensaio.

30 casos Chromium usam os três HTML e o novo script reais: quatro perfis, aliases canónicos/antigos, ausência, expiração, identidades divergentes, tokens incompatíveis e leitura de armazenamento recusada. Variantes sem extensão, `.html` e barra final são exercitadas. Cada caso verifica um único destino e preservação exata de identidade, filas, documentos, rascunhos e bytes antigos inválidos. As páginas de destino são substitutos controlados neste grupo; os testes de login e navegação existentes verificam os seus contratos próprios.

Os dois menus são abertos com os seus HTML, guardas e scripts comuns reais; os destinos de todos os cartões são comparados e o Resumo é efetivamente aberto. Seis capturas PT em 320/390/1440 são regeneradas em `reports/field-visual/legacy-entry/`; foram revistas `client-dashboard-320.png`, `client-menu-390.png` e `client-dashboard-1440.png`. A navegação comum voltou a passar em oito combinações página/perfil e quatro larguras, incluindo os dois menus.

A evidência conserva hashes das fontes, logs e seis capturas. Cache v162, runner com 249 grupos distintos, 40 migrações existentes. Inventário: 115 HTML, 86 páginas com referência literal em 270 scripts ativos, 29 na fila de pesquisa, nenhum recurso ausente do índice e duas imagens não materializadas nesta cópia. A referência literal não comprova revisão visual universal.

## Estado e limites

Publicada em `40659d55428fd2a7fa58469d9f74726af922bc20`, árvore `63df7d69deb3cdcd23068a5aa49cef2a7f8f3809`, idêntica à preparada e validada localmente. [CI 36110064522](https://github.com/ts7520305-svg/cristalwater/actions/runs/36110064522), job `107991263446`, aprovado: 249/249 grupos esperados distintos, 17 etapas e restauro de 127 tabelas/47 ficheiros com linhas e hashes iguais. [Evidência nativa](evidence/20260925_task350_ci.json).

TASK348 confirmada em [247/247 grupos esperados e restauro PostgreSQL](evidence/20260925_task348_ci.json), 17 etapas e 127 tabelas/47 ficheiros com linhas e hashes iguais. TASK349 confirmada em [248/248 grupos e restauro nativo](evidence/20260925_task349_ci.json) de 127 tabelas/47 ficheiros com linhas e hashes iguais.

O novo ensaio de entradas é de navegação, com credenciais de teste e destinos controlados; não substitui a autorização do servidor. A revisão visual é PT e não certifica cinco idiomas destas páginas ou de toda a navegação comum. A assinatura das credenciais, o conteúdo do portal e as APIs mantêm os respetivos contratos e testes. Restantes páginas, históricos financeiros e critérios de produção continuam abertos. Sem merge, deploy ou contactos reais; aplicação não declarada completa.
