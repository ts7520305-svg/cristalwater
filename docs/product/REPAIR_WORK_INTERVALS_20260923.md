# TASK298 — intervalos de trabalho nas reparações

## Resultado e âmbito

A partir de Execução de reparações, a administração e os técnicos podem abrir Tempos de reparação. Cada registo identifica expressamente o técnico, início, fim e trabalho realizado. São intervalos declarados e confirmados, com precisão de segundos e horários UTC. A duração resulta desses horários; não é inferida de agendamento, preço, faturação ou da data isolada de conclusão. Esta etapa prepara a base de trabalho e não acrescenta ainda a valorização LABOR das reparações.

A reparação tem de ter execução autenticada válida, com materiais reservados ou declaração sem materiais. O intervalo tem de estar entre a criação da reparação e a data da confirmação, com fim posterior ao início e sem datas futuras. Pausas são excluídas através de intervalos separados. Vários técnicos podem registar períodos simultâneos; o total é tempo de pessoas (`PERSON_SECOND`), não o tempo decorrido da reparação.

A administração escolhe o técnico; um técnico só regista, consulta e anula os seus próprios intervalos, incluindo quando usa uma conta User associada a Technician. Os técnicos recebem apenas os seus nomes/intervalos e o contexto operacional, sem nomes/contactos do cliente ou preços. Clientes históricos inativos e mudanças de titular da piscina conservam a identidade original da prova de execução. Técnicos históricos inativos podem ser escolhidos pela administração para tempos anteriores.

## Evidência, revisão e concorrência

`RepairWorkInterval` conserva reparação, cliente, piscina, técnico e nome original, horários, segundos, justificação, autor autenticado, data de registo, fotografia da prova de execução e impressões canónicas. As identidades históricas não têm relações que apaguem ou transfiram o intervalo quando a origem operacional é removida. Renomear o técnico ou alterar preços comerciais não reescreve o registo. Uma alteração do nome/estado do técnico entre consulta e gravação exige nova revisão do formulário.

A confirmação verifica sobreposições conhecidas do mesmo técnico com intervalos ativos de outras reparações e horários registados nas visitas REGULAR/EXTRA. Intervalos adjacentes são aceites. Um registo por rever continua a reservar o seu intervalo até ser explicitamente anulado. Tempos de técnicos diferentes não entram em conflito. Os identificadores iguais de reparações e visitas não misturam as fontes.

A leitura reavalia a prova, a existência do técnico, a integridade do intervalo e sobreposições registadas posteriormente. Fontes alteradas/ausentes ou novos conflitos deixam o intervalo por rever e excluem-no do total confirmado. As visitas mantêm os seus percursos e bloqueios existentes: esta etapa verifica os horários conhecidos na confirmação e reavalia mudanças posteriores; não transforma o agendamento ou o início de visitas num bloqueio geral de capacidade.

O pedido por conta/UUID, intervalo, auditoria e recibo são gravados na mesma transação. Pedidos repetidos recuperam exatamente a resposta original. Os bloqueios por reparação e técnico serializam declarações concorrentes, incluindo em reparações diferentes; cliente original, reparação, prova e movimentos usam as proteções da execução. Uma chave ativa única impede a duplicação do mesmo intervalo. Recusas por versão ou sobreposição também ficam guardadas e são recuperáveis.

A anulação exige consultar o intervalo exato, motivo e confirmação. Preserva os dados originais e a impressão da prova, regista autor/data/motivo e liberta a chave ativa. Corrigir exige anular e criar outro registo. É possível anular após a remoção da reparação ou alteração da execução; o recibo original continua recuperável. A operação não altera stock, conclusão, preços, faturas, pagamentos ou atribuições de despesas.

## Interface e recuperação

A página mostra a janela de datas admitida, técnico, duração calculada do intervalo, origem e histórico completo dos tempos apresentados. O total distingue confirmados, por rever e anulados. O rascunho por conta/reparação conserva os campos, sem restaurar o consentimento. Alterar um campo retira a confirmação.

Antes do envio, o pedido e o contexto revisto ficam guardados em IndexedDB; o bloqueio entre janelas impede o envio simultâneo. Perda de resposta, recarregamento, consulta de resultado e repetição conservam o mesmo UUID e conteúdo. O navegador verifica o recibo, a fotografia da execução, identidade original, técnico, horários e dados preservados na anulação. Uma resposta adulterada, mesmo com impressões recalculadas, não elimina o pedido pendente.

Falhas de leitura ou mudança de sessão limpam nomes, horários e totais apresentados. Armazenamento incoerente bloqueia novas gravações e permite consulta. A retoma de rede não reenvia automaticamente. Texto livre é apresentado literalmente. Cache v114; larguras 320/390/1440 e modo escuro ensaiados. Os horários mantêm legibilidade no ecrã de 320 px.

## Migração e validação local

A 30.ª migração cria apenas `RepairWorkInterval`, sem preencher históricos ou alterar dados anteriores: passam a existir 122 tabelas. Restrições verificam identidades positivas, autor, datas, duração exata em segundos, impressões, forma da fotografia, motivo, chave ativa e estado completo de anulação. Índices por reparação/data e técnico/intervalo apoiam a leitura. Não há dependências novas.

- API: autenticação, separação ADMIN/técnico/CLIENT, cliente original inativo e piscina transferida, ambas as formas de execução, recusa de históricos/pendentes, campos extra, datas inválidas/futuras, consentimento, períodos fora da execução, identidades e privacidade.
- Três pedidos iguais em processos distintos recuperam o mesmo recibo; declarações de reparações diferentes para o mesmo técnico disputam o intervalo; adjacências e equipas são tratadas separadamente. Sobreposição com REGULAR e EXTRA, mesmo com o ID da reparação, é recusada.
- Falhas forçadas após criar/alterar o intervalo, após auditoria e no recibo revertem integralmente o conjunto. Repetição posterior recupera o pedido; recusas de versão são duráveis. Mudanças posteriores de execução/visita exigem revisão; preço e nome posterior do técnico não alteram a prova original. Histórico/anulação/recibo sobrevivem à remoção da reparação.
- Navegador real: ligação desde a execução, duração UTC, rascunho sem consentimento, clique duplo, resposta perdida/recarregamento, consulta sem POST, repetição exata, recibo de outro cliente com impressões recalculadas, duas janelas, offline, anulação/correção, origem alterada, respostas inválidas/atrasadas, sessão A–B–A, armazenamento corrompido e privacidade do técnico.
- Migração: preservação das reparações, provas, recibos e parcelas anteriores; tabela nova vazia, restrições SQL, chave única, conservação após apagar a reparação, anulação e novo intervalo; esquema final coincidente.

401 testes unitários/64 ficheiros e sintaxe 593 backend/195 frontend/61 scripts inline aprovados. 30 migrações aprovadas. API/UI novas e regressões de conclusão autenticada, reparações sem materiais, execução no navegador e materiais valorizados API/UI aprovadas localmente. Logs `/tmp/cw298-api.log`, `/tmp/cw298-regressions.log`, `/tmp/cw298-final-work.log`, `/tmp/cw298-migrations.log`, `/tmp/cw298-unit.log` e `/tmp/cw298-syntax.log`. Visuais em `reports/field-visual/repair-work-1790149758149/`.

A validação local usa o adaptador PostgreSQL PGlite e Chromium 149. Os 195 grupos completos, concorrência nativa e restauro foram posteriormente confirmados no CI PostgreSQL 16 da versão publicada, conforme a evidência abaixo.

## Continuidade e limites

Base `c144c3e4024537dbde87d0fe15756b25bc6433e9`, branch `work/field-readiness-20260915-simulation`. Principal `feature/technicians-v25` conservada em `6f27081e1d183ff584a62255b016b373836734db`; sem merge, instalação no VPS ou contactos reais.

Próximo: valorização explícita destes intervalos com a despesa/base de tempo pago confirmada, respeitando técnico, períodos, limites, sobreposições e anulações. Manter a base declarada identificada e a revisão da origem; não alterar as impressões dos destinos já usados por materiais/parcelas manuais para acrescentar o tempo. Vários técnicos, múltiplos períodos e base composta exigem correspondência própria, sem repartir custos automaticamente.

Custos/receitas completos, correção explícita de períodos, margem, restantes origens/ajustes, volume, fornecedores reais e piloto físico continuam por fechar. O registo autenticado não constitui verificação física independente. IVA e emissão fiscal permanecem externos; preços e frequências dependem de cada cliente/época.

## Publicação e CI

Código publicado sem força em `024c20b8eb36d23ff39fb1d9621f30d1b9ded78e`, árvore `d25b1bc72f19c8b601de8d3b15f54c73e1a4abf0`, igual à validada localmente. Backup `backup/repair-work-local-20260923` (`d02431f88d5003bc01dab72b8e14c399c37923e1`). [CI 35834464344](https://github.com/ts7520305-svg/cristalwater/actions/runs/35834464344), job `107094492470`, aprovado em 23/09/2026: 07:57:50–08:24:36 UTC, 26m46s, 17 etapas aprovadas.

Logs completos conferidos contra a lista do runner: 195/195 grupos previstos distintos, todos com código zero e sem sinal; nenhuma falta, entrada inesperada ou duplicação. 401 testes unitários/64 ficheiros, quatro testes técnicos e gate geral do navegador aprovados. Sintaxe 593 ficheiros backend/195 frontend/61 scripts inline. 30 migrações aditivas preservam os dados anteriores e coincidem com o esquema atual.

API/UI de tempos de reparações aprovadas em 2493/6160 ms; execução por comandos 1111 ms, execução no navegador 7598 ms e materiais valorizados API/UI 3526/11932 ms. O restauro PostgreSQL 16 confirmou 122 tabelas e 46 ficheiros enviados, com linhas da base de dados e hashes dos ficheiros iguais.

Evidência completa em `evidence/20260923_task298_ci.json`. O fecho posterior altera apenas documentação e conserva a árvore do código, migrações e testes aprovados. A valorização do trabalho de reparações pela base paga continua pendente, assim como restantes custos/receitas, correções de período e margem completa. Esta aprovação não abrange instalação no VPS, fornecedores reais ou piloto físico.
