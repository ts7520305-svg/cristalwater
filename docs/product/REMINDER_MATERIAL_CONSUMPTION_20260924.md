# TASK314 — consumo e custo dos materiais próprios dos lembretes

## Resultado e âmbito

A administração pode confirmar o consumo dos materiais declarados num lembrete independente. Em Recursos do lembrete, a ligação Consumo e custos dos materiais abre a declaração, as origens de stock e o histórico. Cada produto exige uma escolha explícita do saldo de armazém ou viatura. A prévia apresenta a quantidade, a origem e o saldo antes/depois; o motivo e a confirmação são obrigatórios.

O consumo abrange todos os materiais e quantidades da declaração ativa. Mantém-se um consumo ativo por lembrete. A operação cria movimentos de consumo e altera os saldos de origem na mesma transação do comprovativo, auditoria e histórico. O momento do registo é a data atual; a data histórica da execução continua a pertencer ao lembrete. O ecrã pede confirmação de que o consumo ainda não foi registado noutro serviço.

Em Despesas, uma compra confirmada pode financiar o consumo por produto/unidade. A administração escolhe o lembrete, a linha de compra, a quantidade e confirma o cálculo. O custo usa a linha histórica de compra, respeita os limites comuns e fica atribuído ao mês UTC da execução. O pagamento e a despesa originais continuam a ser a origem financeira da atribuição.

## Origem, stock e concorrência

- A origem é o comprovativo completo da declaração TASK312, com cliente histórico, piscina, técnico, execução e decisão comercial. Materiais desconhecidos ou ausência explícita não permitem criar um consumo.
- A seleção identifica o saldo concreto de cada produto. A comparação normaliza nome e unidade; o movimento conserva a grafia original, produto, categoria, viatura e restantes identidades da origem. Uma categoria desconhecida não é preenchida por um valor genérico ao consumir ou repor.
- O saldo físico e as reservas aprovadas de reparações são conferidos antes do consumo. A prévia apresenta reservas relevantes e não permite consumir a quantidade reservada. Reservas malformadas exigem revisão.
- Os bloqueios usam a mesma chave física de stock dos restantes fluxos. Criar reservas de reparações passa a adquirir essas chaves antes de verificar a disponibilidade e guardar a reserva, impedindo uma reserva nova entre a conferência e o consumo independente.
- Todos os saldos são bloqueados numa ordem estável, antes de alterar qualquer produto. A seleção, saldo e reservas são recalculados na confirmação. Uma prévia desatualizada recebe uma recusa durável, sem movimentos parciais.
- O histórico dos consumos usa pedidos `FieldWriteRequest` próprios, encadeados por hash, com original, movimentos e eventual anulação. O comprovativo é recuperado pelo UUID e conta originais. Pedidos repetidos não voltam a alterar stock.

Alterações posteriores a movimentos, comprovativos, declaração ou execução assinalam a origem para revisão. Alterar o saldo por outras operações normais não reescreve nem invalida o consumo histórico. Sobreposição de horas afeta a valorização de trabalho; por si só, não transforma materiais íntegros em horas ou em consumo duplicado.

## Custo e correção

A fonte MATERIAL tem versão 8 e base `CONFIRMED_INDEPENDENT_REMINDER_CONSUMPTION`. Incorpora o comprovativo do consumo, incluindo a declaração original, e conserva o movimento exato do produto selecionado. A linha de compra tem de corresponder ao produto/unidade e, quando conhecidos, aos identificadores do produto. A compra deve ser anterior ou coincidente com a execução.

O cálculo existente conserva quantidades com seis casas decimais e cêntimos inteiros. A compra e o consumo partilham limites com outras atribuições; outra compra não permite voltar a financiar a mesma quantidade do lembrete. O saldo final absorve o último cêntimo: três unidades financiadas por 100 cêntimos foram distribuídas em 33, 33 e 34 cêntimos no ensaio. O filtro do destino conserva o denominador mensal existente.

Anular o consumo exige rever e confirmar a reposição integral no stock original. A prévia mostra os custos MATERIAL ativos que ficarão por rever, com ligações às despesas. Criar ou anular um custo depois dessa prévia obriga a recalculá-la. Os movimentos de consumo originais são conservados e novos movimentos RETURN documentam a reposição. Identidades de stock alteradas ou comprovativos incoerentes bloqueiam a reposição até revisão.

Os custos e reservas financeiros permanecem intactos depois da reposição e ficam por rever. São libertados pela anulação explícita da atribuição na despesa. A declaração de recursos só pode ser anulada depois da anulação do consumo ativo, para apresentar e confirmar primeiro os efeitos no stock e nos custos. Remover o lembrete operacional conserva histórico, revisão financeira, recuperação de pedidos e reposição verificável.

## Implementação

`reminderMaterialService` mantém o histórico, confere a declaração, bloqueia os saldos e confirma consumo/reposição. Usa as tabelas existentes; não cria modelos nem dependências. As rotas administrativas são:

| Operação | Rota |
|---|---|
| Consultar materiais e histórico | `GET /api/equipment-maintenance/reminders/:id/materials` |
| Rever consumo ou reposição | `POST /api/equipment-maintenance/reminders/:id/material-preview` |
| Confirmar operação | `POST /api/equipment-maintenance/reminders/:id/materials` |
| Recuperar comprovativo | `GET /api/equipment-maintenance/reminder-material-requests/:requestId` |

O contrato partilhado `cw-reminder-material-rules` verifica no servidor e navegador a declaração incorporada, origem, movimentos, quantidades, datas, reposição e cálculo do custo. A valorização e a anulação financeira reutilizam os comandos existentes de Despesas. A migração `20260924110000_reminder_material_valuation` estende as restrições das atribuições medidas e verifica a forma da origem própria, preservando todos os registos anteriores.

O ecrã `/reminder-materials` conserva rascunhos e pedidos por conta em IndexedDB. A prévia não equivale a consentimento depois de recarregar. Offline, mudança de conta, respostas alteradas, duplo clique ou resposta perdida conservam o pedido para consulta/reenvio exatos. O histórico da atribuição financeira liga ao consumo do lembrete. Cache v129.

## Validação local e publicação

Base `8c5d5bdf8cf1df4a66c5f249696cb4b22825c6eb`, fecho da TASK313. Passaram 473 testes unitários/71 ficheiros, incluindo sete testes novos do contrato e cálculo. Sintaxe: 611 ficheiros backend, 211 frontend e 62 scripts inline. Atualização de 38 migrações com dados anteriores preservados e igualdade do esquema final.

O novo grupo `test-field-reminder-materials.js` verifica permissões, identidades e origem, stock reservado, prévia desatualizada, recusa recuperável, UUID repetido, duas APIs concorrentes pelo mesmo saldo, vários produtos e origens, rollback de histórico/auditoria, compras concorrentes pela mesma medição, cêntimo final, cliente histórico após transferência, categoria desconhecida preservada, movimento adulterado, origem removida, reposição e anulação financeira explícitas.

O navegador Chromium passou seleção de origem, rascunho sem consentimento, prévia e movimento adulterados, bloqueio offline, duplo clique, resposta perdida e consulta/reenvio exatos. A atribuição MATERIAL valida a fórmula e o mês, apresenta os custos afetados na reposição e conserva a reserva até à anulação financeira. Mudança de conta limpa a informação apresentada. Layout a 320/390/1440 px, sem transbordo horizontal, e capturas claro/escuro revistas em `reports/field-visual/reminder-materials/`.

Regressões dirigidas: recursos e custo do trabalho dos lembretes, materiais e conclusão sem materiais das reparações, correção de materiais de equipamento e repartição MATERIAL das manutenções. O runner passa a 217 grupos. A validação local usa PostgreSQL embebido; o CI completo com PostgreSQL 16 e restauro da árvore publicada tem de ser confirmado antes do fecho.

## Continuação e limites

Prosseguir a associação explícita de lembretes a visitas REGULAR/EXTRA, prevenindo dupla declaração e dupla atribuição, e os restantes pontos da matriz. Mantêm-se abertos múltiplos intervalos separados, repartições entre períodos/meses, restantes gastos/ajustes/origens de receita, históricos/ecrãs/PDFs/idiomas, volume, operação prolongada, fornecedores reais e piloto físico.

O consumo é integral por declaração e a reposição é integral por consumo; devoluções físicas parciais exigem um fluxo próprio. Os movimentos identificam o saldo físico; uma linha de compra só é selecionada na valorização administrativa, sem dedução automática de lote físico. As consultas de candidatos e históricos ainda requerem validação com volume representativo. A tarefa não confirma cobertura financeira integral nem lucro.

Publicar apenas na branch `work/field-readiness-20260915-simulation`, preservando a principal `feature/technicians-v25` em `6f27081e1d183ff584a62255b016b373836734db`. Sem merge, deploy, contactos reais ou alterações destrutivas de produção neste lote. Fornecedores e notificações externas desligados nos ensaios.
