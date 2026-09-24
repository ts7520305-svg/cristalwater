# TASK315 — associação explícita do lembrete à visita

## Resultado e âmbito

A administração pode associar um lembrete de serviço concluído a uma visita REGULAR ou EXTRA. Em Recursos do lembrete, a ligação Associar a uma visita abre `/reminder-visits`. O utilizador escolhe o tipo e a visita, confere a origem e as datas, indica o motivo e confirma a prévia. Não é feita uma escolha automática por proximidade de datas, numeração ou piscina.

A lista apresenta visitas concluídas do mesmo cliente e piscina históricos, com técnico, início e fim confirmados. Quando existe técnico atribuído ao lembrete, a visita deve pertencer a esse técnico. A pesquisa admite o número da visita e páginas de dez resultados. Os tipos REGULAR/EXTRA continuam distintos mesmo quando os identificadores numéricos coincidem com outro serviço ou lembrete.

A data de registo da conclusão do lembrete pode ser posterior à visita. O ecrã apresenta as duas datas; a associação é uma confirmação administrativa da origem, não uma dedução do intervalo próprio de trabalho. O autor e o momento da associação ficam registados separadamente da execução histórica.

## Proteção contra duplicações

A associação exige a revisão prévia de qualquer consumo próprio, declaração de recursos ou custo ativo do lembrete. A página apresenta os registos que impedem a operação, com ligações ao consumo/reposição, à declaração e às despesas ou composição financeira. Mesmo uma declaração explícita de ausência de materiais deve ser anulada antes de mudar a origem do serviço.

O consumo tem de ser anulado com a reposição integral confirmada no seu fluxo. A declaração e os custos são anulados expressamente nos respetivos fluxos. A associação não executa estas anulações nem transfere os valores. Os originais, pagamentos, decisões comerciais e movimentos mantêm-se conservados.

Enquanto existir associação ativa, mesmo que a origem precise de revisão, ficam bloqueadas novas declarações independentes, consumo próprio e atribuição independente de custos ao lembrete. A elegibilidade atual do destino financeiro reflete esse bloqueio. Anular a associação permite voltar a conferir uma declaração independente; os custos e declarações anteriormente anulados permanecem anulados.

As operações partilham o bloqueio do destino financeiro do lembrete, antes do bloqueio de recursos. A criação, revisão, correção de mês e anulação de custos manuais adotam esse bloqueio, já usado pela valorização e pelos recursos. Os ensaios com duas APIs confirmaram que uma associação concorrente com uma nova declaração ou atribuição manual não deixa ambas ativas. Duas visitas concorrentes pelo mesmo lembrete conservam uma única associação ativa.

## Comprovativos, revisão e anulação

O histórico usa pedidos próprios `FieldWriteRequest`, com âmbito `REMINDER_VISIT_ASSOCIATION` e base `ADMIN_EXPLICIT_REMINDER_VISIT`. Cada confirmação incorpora o lembrete original, o destino comercial confirmado, a visita tipada, cliente/piscina/técnico, prévia, motivo, autor e data. As operações aplicadas são encadeadas pelo hash da confirmação anterior. O mesmo UUID e conta recuperam exatamente o primeiro resultado; uma reutilização com outro conteúdo é recusada.

Anular exige a prévia da associação ativa, o original completo e um novo motivo. O primeiro comprovativo não é reescrito. Alterar a visita, o lembrete, o técnico ou a decisão histórica assinala a associação para revisão. Um comprovativo incoerente bloqueia alterações e custos independentes. A remoção do lembrete ou da visita conserva a consulta do histórico e permite anular uma associação íntegra, sem recriar os registos operacionais.

Os bloqueios de linhas conferem a execução, a decisão, declarações, comprovativos e movimentos históricos antes de guardar. Comprovativo, histórico técnico e auditoria são atómicos. Uma falha em qualquer um deles deixa a operação por aplicar, permitindo reenviar o pedido original.

Os contratos anteriores das declarações, consumos e custos não recebem novos campos nulos nem são reescritos. Sem associação, os destinos financeiros e hashes anteriores mantêm a mesma forma. O cliente registado diretamente na execução permanece a origem histórica após uma transferência da piscina ou arquivo do cliente.

## Ecrã e rotas

| Operação | Rota administrativa |
|---|---|
| Consultar origem, impedimentos e histórico | `GET /api/equipment-maintenance/reminders/:id/visit-association` |
| Pesquisar visitas compatíveis | `GET /api/equipment-maintenance/reminders/:id/visit-candidates?visitType=REGULAR&page=1&q=` |
| Rever a associação ou anulação | `POST /api/equipment-maintenance/reminders/:id/visit-preview` |
| Confirmar a operação | `POST /api/equipment-maintenance/reminders/:id/visit-association` |
| Recuperar o comprovativo original | `GET /api/equipment-maintenance/reminder-visit-requests/:requestId` |

O contrato partilhado `cw-reminder-visit-rules` verifica identidades, tipos, datas, campos, origem comercial, prévia e comprovativo no servidor e navegador. `reminderVisitJournal` consulta os pedidos por âmbito/destino, sem voltar a carregar as projeções financeiras ou de recursos. `reminderVisitService` reúne elegibilidade, pesquisa, confirmação e anulação. São usadas as tabelas e o índice de pedidos existentes; não há migrações, modelos ou dependências novos. Cache v130.

O navegador conserva o rascunho por conta/lembrete e os pedidos confirmados ou pendentes em IndexedDB. A prévia não conserva consentimento após recarregar. Mudança de seleção ou motivo invalida respostas atrasadas; offline impede a confirmação. Duplo clique, resposta perdida, consulta e reenvio conservam o pedido exato. A mudança de conta limpa os dados apresentados e impede novos envios dessa página. A visita selecionada aparece também fora da lista, para permitir ler todos os dados num ecrã estreito.

## Validação e publicação

Base `4ac49251b106dc9cbd06d2d72e5d2e80edac8c3a`, fecho documental da TASK314. Os 479 testes unitários/72 ficheiros incluem seis novos testes do contrato, compatibilidade Node/navegador, identidades tipadas, hashes recalculados com origens inválidas, autoria/datas e encadeamento do histórico. Sintaxe: 613 ficheiros backend, 213 frontend e 62 scripts inline. O esquema mantém as 38 migrações existentes.

O grupo `test-field-reminder-visits.js` verifica permissões, identificadores limitados, pesquisa/paginação, cliente histórico após transferência, técnico divergente, visita incompleta, bloqueios por recursos/consumo/custos, preservação de originais, prévia desatualizada, recusa recuperável, concorrência entre duas APIs, UUID exato, rollback de comprovativo/auditoria/histórico, origem removida e comprovativo alterado.

O navegador Chromium verifica seleção explícita e rascunho, prévia adulterada com hashes recalculados, origem alterada desde a lista, offline, duplo clique, resposta perdida, recuperação por consulta e reenvio, invalidação de resposta atrasada, bloqueio no ecrã de recursos, anulação e isolamento entre contas. Capturas claro/escuro e layouts 320/390/1440 px são revistos em `reports/field-visual/reminder-visits/`.

Passaram as seis regressões dirigidas: recursos, materiais e valorização do trabalho dos lembretes; atribuição de custos a manutenções, respetivo navegador e correção do mês. O grupo novo passou também após os ajustes finais da pesquisa e da confirmação da anulação. O runner passa a 218 grupos.

Código publicado `01c6d4be9728d3b2c306c7931a909902d0210c44`, árvore `410dd2a7aa742f91857b245da73eeafe972a3fb1`, igual à validada localmente. [CI 35990442576](https://github.com/ts7520305-svg/cristalwater/actions/runs/35990442576), job `107602993569`, aprovado entre 2026-09-24T10:59:56Z e 2026-09-24T11:26:39Z (26m43s): 17 etapas, 218/218 grupos previstos distintos, sem falhas, faltas, entradas inesperadas ou duplicações; 479 unitários/72 ficheiros, quatro testes técnicos, gate geral de navegador, sintaxe 613/213/62 e 38 migrações. Restauro PostgreSQL 16 de 127 tabelas/46 ficheiros, com linhas e hashes iguais. Evidência [evidence/20260924_task315_ci.json](evidence/20260924_task315_ci.json). Cache v130, sem novas migrações/tabelas/dependências. O fecho posterior altera apenas documentação; a aprovação refere-se ao código e árvore acima.

## Continuação e limites

Esta associação não atribui ao lembrete as horas, materiais, custos ou receitas integrais da visita. A declaração das parcelas próprias de um lembrete associado e a repartição dos custos confirmados do pai são o passo seguinte, com limites partilhados entre todos os serviços associados. Continuam abertos múltiplos intervalos, repartições entre meses, devoluções parciais, restantes custos/receitas, revisão histórica, páginas/PDFs/idiomas, volume, operação prolongada, fornecedores reais e piloto físico.

A pesquisa filtra os registos pelo cliente/piscina históricos antes de validar e paginar; a elegibilidade consulta os históricos do lembrete. A latência com volume representativo ainda tem de ser medida. O histórico permite detetar comprovativos incoerentes e ligações/anulações fora da sequência; não constitui prova independente contra a eliminação administrativa de todo o histórico da base de dados.

Publicar apenas em `work/field-readiness-20260915-simulation`, preservando `feature/technicians-v25` em `6f27081e1d183ff584a62255b016b373836734db`. Sem merge, deploy, contactos reais ou alterações destrutivas de produção neste lote. Fornecedores externos desligados nos ensaios. O sistema completo continua com critérios por fechar.
