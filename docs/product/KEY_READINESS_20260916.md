# Chaves da ronda — TASK212

Atualização em 17/09/2026: TASK211–212 publicadas e confirmadas no CI `35179629224`, com 115 grupos, 19 migrações e restauro de 110 tabelas/31 ficheiros. Água/bomba em ExtraVisit são tratadas posteriormente na TASK213 (`EXTRA_VISIT_SAFETY_20260917.md`).

## Falhas reproduzidas

A bateria completa local `reports/field-suite/1789594640698` revelou que a lista matinal não encontrava uma chave associada a uma visita do dia em America/Chicago. A rota convertia AAAA-MM-DD em meia-noite UTC e depois calculava o dia local, consultando o dia anterior. O seletor administrativo também usava a data UTC para preencher o dia atual.

A revisão confirmou que o filtro technicianId era opcional mesmo para técnicos/chefes, que o alias de consulta por código podia devolver piscinas de outros técnicos e que a lista matinal não consultava ExtraVisit. Datas inválidas, estados fechados alternativos, visitas futuras com date antigo e a truncagem silenciosa em mil visitas também foram tratados.

## Alterações

- Consultas de chaves privadas, sem cache. ADMIN conserva a consulta global; TECHNICIAN, TEAM_LEADER e contas User associadas a Technician ficam limitados às suas visitas abertas. Um identificador de outro técnico é recusado. A consulta por código filtra também as piscinas dentro de uma chave partilhada e oculta chaves não visíveis ao técnico.
- Data civil validada, intervalo local com limite final exclusivo e resposta com o mesmo dia pedido. Planeamento prevalece sobre a data antiga; visitas fechadas/arquivadas/canceladas não entram na lista.
- A lista inclui visitas regulares e extra, com visitType/visitKey próprios, mesmo quando os IDs numéricos coincidem. Chaves da piscina precisam de active, visibleToTechnician e requiredForVisit; acessos KEY do cliente conservam o contrato de chave geral. Não há truncagem silenciosa.
- O ecrã administrativo distingue visita regular/extra, abre o planeamento correto, apresenta carregamento/erro e elimina a lista antiga quando os filtros ou a sessão mudam. Uma resposta atrasada não substitui o dia escolhido. Textos longos ajustam-se à largura; botões da lista usam contraste legível.

## Evidência

- Ensaio inicial `run-1789595430616` falhou antes da correção; API e teste de interligações aprovaram em `run-1789595529210`.
- Fluxo completo da API e Chromium aprovado em `run-1789595689565`, incluindo acesso por quatro identidades, 29 de fevereiro, limites de meia-noite, visitas com o mesmo ID, chaves partilhadas, ocultas/opcionais/arquivadas, reatribuição e 1001 visitas com 2002 chaves sem omissões. O teste de interligações passou no mesmo executor.
- Repetição em Pacific/Auckland aprovada em `run-1789595734830`; o executor anterior usou America/Chicago. Ambos usam o mesmo fuso para servidor e testes.
- Interface real ensaiada a 320/390/1440 px, incluindo respostas fora de ordem, falha HTTP, recuperação e mudança de sessão. Imagem `reports/field-ui/KEYS_MORNING.png` inspecionada; corrigido contraste dos botões após essa inspeção.
- Novo grupo `scripts/test-field-key-scope.js` integrado no runner, que passa a 115 grupos. Sem nova migração; esquema permanece com 19 migrações aditivas e 110 modelos/tabelas esperadas para restauro.
- Validação conjunta final em `reports/field-suite/1789595774560`: 114/115 grupos aprovados em 497 segundos. O único grupo falhado foi `test-field-client-edit-preservation.js`: após o rollback forçado, o registo do servidor mostra `Server has closed the connection` e o middleware respondeu 401. A repetição isolada do mesmo teste, sem alteração de código/asserções, aprovou em `run-1789596283096`, incluindo rollback, recuperação e preservação financeira. A execução global terminou com código 1; não a descrever como um CI integralmente aprovado.
- O primeiro ensaio global esgotou o limite de dez ligações do adaptador local. O segundo usou 64 e registou até 53 ligações; esta alteração pertence apenas ao executor descartável de QA. Não substitui a verificação em PostgreSQL nativo. Na árvore funcional final também passaram 388 unitários, quatro testes de técnicos, 17 scripts de navegador e sintaxe de 536 ficheiros backend. A migração da TASK211, inalterada neste lote, já passara as 19 atualizações aditivas.

## Limites

Estes testes funcionais usam PGlite por TCP, sem evidência nova de desempenho do PostgreSQL nativo. Não equivalem a custódia física de chaves, revogação de dados já consultados ou atribuição organizacional avançada de equipas. O inventário geral de APIs e das escritas administrativas continua separado. A publicação/CI/restauro nativo destes lotes aguarda autorização explícita exigida pela revisão automática; a última versão remota confirmada continua a TASK210.
