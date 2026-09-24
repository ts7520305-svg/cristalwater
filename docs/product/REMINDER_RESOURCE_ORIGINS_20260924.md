# TASK312 — recursos próprios de lembretes de serviço

## Resultado e âmbito

A administração pode declarar os materiais e um intervalo de trabalho efetivo de um lembrete de serviço realizado de forma independente. O acesso parte do cartão de cobrança do lembrete, em Manutenções. O ecrã apresenta cliente, piscina, conclusão, técnico, declaração ativa e histórico. A confirmação posterior tem autor e data administrativos; não é apresentada como um recibo técnico de campo retroativo.

Uma declaração ativa por lembrete combina materiais e/ou um intervalo contínuo. Os materiais podem ser desconhecidos, explicitamente inexistentes (`NONE`) ou uma lista de até vinte produtos/unidades distintos, com quantidade positiva até 100000 e seis casas decimais. Pelo menos um recurso deve ser declarado. Sem intervalo, o tempo permanece desconhecido. Uma declaração de materiais não é um movimento de stock nem atribui custo zero.

Para corrigir recursos, a administração anula primeiro a declaração ativa com motivo e depois confirma uma nova. A anulação conserva o original, recibo, autoria e datas. A consulta e o reenvio de um pedido confirmado recuperam o resultado exato, mesmo após anulação ou alteração da origem. A operação não reescreve a conclusão, a decisão comercial, despesas, atribuições, compras, stock ou pagamentos existentes.

## Origem e tempos

- São elegíveis as categorias `TECHNICAL_PERIODIC_SERVICE` e `POOL_SERVICE_REMINDER`, concluídas e com decisão comercial histórica confirmada. Cliente e piscina vêm da execução original; uma transferência posterior da piscina não muda o cliente desta declaração.
- O técnico é identificado expressamente e deve existir. Havendo um técnico atribuído ao lembrete, tem de coincidir. Um técnico atualmente inativo pode ser identificado numa execução histórica; o estado é mostrado no seletor.
- Início e fim são instantes UTC com precisão de segundos, fim posterior ao início e anterior ou igual à conclusão e à hora atual. Não se deduz duração da data prevista ou da criação do lembrete. O navegador apresenta horários locais, o fuso e os instantes UTC na revisão.
- Intervalos independentes não podem sobrepor visitas REGULAR/EXTRA, reparações ou outros lembretes do mesmo técnico. A verificação atravessa clientes e meses. Limites adjacentes são permitidos; trabalho em curso reserva o tempo. O mesmo bloqueio por técnico usado no registo de reparações serializa as confirmações de lembretes.
- A leitura comum `recordedWorkTimeService` inclui os lembretes ativos. Uma intervenção sobreposta registada posteriormente assinala os tempos afetados para revisão. Declarações ainda ativas continuam a reservar o seu intervalo quando a origem ou o comprovativo precisa de revisão.

## Persistência, integridade e concorrência

A migração aditiva `20260924090000_reminder_resource_declarations` acrescenta `ReminderResourceDeclaration`. Não preenche recursos para lembretes antigos nem modifica tabelas anteriores. Mantém identidades e instantâneos próprios, seguindo o modelo de história dos intervalos de reparação; a remoção do lembrete não elimina as declarações.

O registo contém origem, técnico, materiais/horário, revisão confirmada, motivo, autor, pedido, datas, fingerprint e resposta original. A chave ativa é única por lembrete; o pedido é único por conta. Restrições SQL verificam identidades, intervalo integral em segundos, data de criação e estados coerentes de anulação. A anulação só altera os seus campos próprios e liberta a chave ativa.

O diário existente `FieldWriteRequest`, âmbito `REMINDER_RESOURCES`, conserva o envelope e resultado por UUID/conta. Prévia, gravação, recibo, `TechnicalHistory` e `UserAuditLog` são atómicos. A confirmação volta a verificar origem, decisão, técnico, histórico e sobreposições. Duas APIs concorrentes recuperam o mesmo resultado para o mesmo pedido; pedidos incompatíveis não criam declarações duplicadas. Uma recusa confirmada também fica recuperável.

A leitura verifica o registo e o recibo originais, incluindo o comprovativo da anulação. Registos adulterados, comprovativos em falta e recibos de declarações sem a respetiva linha bloqueiam nova declaração. Alterações posteriores na execução, identidade ou atribuição do técnico produzem `REVIEW`, preservando o original. Um lembrete removido conserva consulta, recuperação e anulação explícita do registo íntegro.

## Navegador

O formulário conserva rascunho por conta/lembrete, incluindo quantidade com vírgula, seleção de técnico, materiais, horários e motivo. Uma edição invalida a prévia. O pedido é gravado em IndexedDB antes do envio e protegido entre janelas; prévia e recibo são verificados pelo contrato partilhado com o servidor. Falha de ligação, resposta alterada ou perdida preservam o pedido para consulta ou reenvio exato. A recuperação não depende da validade atual da origem.

Duplo clique, resposta atrasada após edição, modo offline e mudança transitória de conta não podem confirmar um contexto anterior. A limpeza do rascunho compara o pedido confirmado; recusas conservam o conteúdo. Nomes são apresentados como texto. O técnico selecionado também aparece fora do seletor, para permitir ler nomes extensos no telemóvel. Ecrã em português, estilos partilhados claro/escuro e cache v127.

## Validação local

Base `8751e7550a6a6f9ad79abdb6899ff1d771988d4a`, fecho documental da TASK311. Passaram 458 testes unitários/69 ficheiros, incluindo oito novos testes do contrato e um novo teste de sobreposições. Sintaxe: 609 ficheiros backend, 208 frontend e 62 scripts inline.

O ensaio de atualização executou as 36 migrações sobre o esquema anterior, preservou os dados e confirmou a igualdade do esquema resultante. Verificou ainda os índices únicos, os estados inválidos de anulação, intervalos incoerentes, substituição após anulação e conservação após remoção do lembrete. A nova tabela não substitui nem reescreve os registos antigos.

`test-field-reminder-resources.js` passou com base isolada e duas APIs: permissões, outra conta administrativa real, origem histórica após transferência, ausência distinta de desconhecido, preservação comercial/financeira/stock, recibos exatos, UUID reutilizado, duas declarações concorrentes, dois lembretes concorrentes pelo mesmo horário, visitas/reparações adjacentes ou sobrepostas, revisão posterior, fontes alteradas/removidas, comprovativo adulterado ou órfão e rollback de recibo/auditoria/histórico.

O navegador Chromium passou rascunho/recarregamento, normalização de quantidades, fuso Europe/Lisbon, instantes UTC, prévia e resposta adulteradas, duplo clique, reenvio idêntico, resposta perdida com consulta, anulação recuperada, prévia atrasada, recusa obsoleta com rascunho conservado, offline e mudança de conta. Layout a 320/390/1440 px sem transbordo horizontal. Registos e capturas locais em `reports/field-visual/reminder-resources/`.

Regressões dirigidas aprovadas: registo de trabalho das reparações, valorização LABOR das reparações, repartição LABOR das manutenções e correção de materiais de equipamento, incluindo os respetivos percursos de API e navegador. Os ensaios locais utilizam PostgreSQL embebido. O CI completo com PostgreSQL 16 e restauro desta árvore ainda tem de ser confirmado. O runner passa a 215 grupos; não há dependências novas.

## Continuação e limites

Publicar apenas na branch `work/field-readiness-20260915-simulation`, preservando a principal `feature/technicians-v25` em `6f27081e1d183ff584a62255b016b373836734db`. Não há merge, deploy no VPS, contactos reais ou alteração destrutiva de produção neste lote.

Prosseguir TASK313: valorização explícita do trabalho independente dos lembretes com despesa/base paga confirmada, sem duplicar os limites de tempo/custo partilhados. Ainda faltam associação explícita de lembretes executados dentro de outra visita, múltiplos intervalos separados, conferência de consumo e valorização dos materiais, repartições entre meses e restantes pontos da matriz. A declaração desta tarefa não fornece cobertura financeira completa, lucro, prova de volume, operação prolongada, fornecedores reais ou piloto físico.
