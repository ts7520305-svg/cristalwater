# TASK238–239 — pedidos de material e notas do modo de campo

## Estado

Implementação e verificação local concluídas em 17/09/2026, sobre `14d8e776825ea7e87848d1af8dae26f1176837f4`. Publicação e CI/restauro nativo da árvore final por confirmar. Cache v66; runner com 133 grupos; nenhuma migração de esquema.

## Diagnóstico e alteração

A inspeção do código encontrou o botão de avisos a aceitar um `ok` genérico e a limpar os campos sem comprovativo do pedido. Qualquer falha escrevia numa lista global `cwPendingAdminAlerts`, limitada aos últimos 50 itens, através de uma função que ocultava falhas de armazenamento; o ecrã afirmava que o aviso estava guardado. Não foi encontrada recuperação dessa lista. Este diagnóstico foi por leitura de fonte, não por reprodução anterior à correção.

O endpoint aceitava identidades e contexto enviados pelo navegador, tolerava falha na criação do lembrete e criava notificações separadamente. A coluna `clientId` da notificação permitia a sua inclusão no feed do cliente; regras configuráveis podiam gerar mais destinatários. O emissor Socket.IO global já tinha proteção MANAGEMENT anterior: esta alteração não é apresentada como descoberta de uma fuga global por socket.

TASK238 introduz `FIELD_STOCK_REQUEST` no mecanismo existente de pedidos de campo. Para pedidos modernos, UUID, proprietário tipado, técnico autenticado, tipo REGULAR, visita/piscina e os seis campos literais participam no comprovativo. Quantidades são opcionais; quando indicadas, têm de ser positivas, finitas e acompanhadas de unidade. Produtos, notas, prioridades, tipos e comprimentos são validados.

O servidor verifica o técnico ativo e a atribuição real da visita; cliente, nomes e viatura vêm da base de dados. Cria um OperationalReminder, uma notificação ADMIN, auditoria e comprovativo na mesma transação. Nenhuma falha obrigatória é ignorada. A notificação não recebe destinatário CLIENT/User nem é reenviada por regras configuráveis. O lembrete é trabalho para o escritório, sem atribuição automática ao técnico que o pediu. O contexto cliente/piscina do lembrete é conservado nos circuitos operacionais existentes; não se promete sigilo do lembrete perante todos os técnicos da piscina.

Uma resposta perdida é recuperada pelo mesmo proprietário/UUID/hash, incluindo após reinício e reatribuição posterior da visita. Reutilização com outro conteúdo é recusada. ADMIN não pode personificar um técnico neste endpoint. Chamadas antigas sem UUID continuam a devolver os objetos antigos apenas com identidade e contexto verificados, sem garantia de deduplicação; a prova de interligações passou a autenticar o técnico real.

TASK239 substitui a lista global por rascunho da conta e pedido persistido antes do POST, usando o armazenamento de campo existente. O rascunho conserva material, quantidade, unidade, nota, prioridade, tipo e visita/piscina originais, mesmo quando o técnico consulta outra visita. A recuperação tem botão próprio e continua disponível sem a visita original selecionada. Os campos só se limpam depois de resposta HTTP 200, comprovativo e conteúdo exatos, confirmação local persistida e limpeza do rascunho verificada. Uma falha nessa última limpeza permite limpar o rascunho confirmado sem repetir o POST.

Campos e estado deste formulário ficam fora do adaptador genérico de formulários. Há proteção de sessão, coordenação dos envios entre janelas, deteção de rascunho alterado noutra janela, corrupção/quota visíveis e recarga offline com o módulo incluído na cache. A revisão do dia inclui pedido por confirmar, rascunho por enviar, texto não guardado e avisos antigos por rever. Os bytes da fila global antiga são conservados, sem presumir autor, apagar ou enviar automaticamente.

## Evidência local

| Ensaio | Resultado |
|---|---|
| `test-field-stock-requests.js` | Resposta perdida após commit, reinício, seis pedidos em dois processos: um lembrete/notificação/auditoria e comprovativo idêntico. Falha injetada na inserção do comprovativo reverte todas as escritas. |
| Identidade e destinatários | CLIENT/outro técnico/ADMIN recusados; feed ADMIN recebe, feeds CLIENT/TECH não recebem a notificação. Regra de audiência alargada não duplica nem encaminha o pedido. User associado e chefe de equipa conservam Technician/owner corretos; conta inativa não escreve. |
| Contrato e compatibilidade | Conteúdo/UUID alterado, tipo EXTRA, campos adicionais, quantidade/unidade inválidas e contexto antigo falsificado recusados; novo pedido após reatribuição é recusado, original confirmado permanece recuperável. |
| `test-field-stock-requests-ui.js` | Formulário real, rascunho após recarga, troca de visita sem reatribuir o texto, preparação offline e recarga realmente offline; 51 avisos antigos mantêm os mesmos bytes. |
| Confirmação e falhas locais | Conteúdo de comprovativo alterado, quota no rascunho/IndexedDB/limpeza confirmada, resposta tardia após mudança de conta, regresso à conta original, duas janelas, BFCache e JSON corrompido. Não há limpeza nem indicação falsa de envio. |
| Administração e apresentação | Painel ADMIN real mostra autor autenticado e texto literal, sem executar HTML submetido. Larguras 320/390/1440 sem transbordo; estado e botão de recuperação não estão cobertos pela navegação. Captura Chromium 390 revista. |
| Regressões | `test-field-visit-types.js`, `test-field-internal-alert-ui.js` e `test-system-interconnections.js` aprovados. 388 unitários e sintaxe de 541 JS backend/177 frontend/57 inline aprovados. |

Execuções locais: `run-1789671922156` (API inicial), `run-1789672062023` (UI e três regressões), `run-1789672202906` (API/UI com revisão do dia e troca de visita), e `run-1789672297009` (identidade final). A evidência local usa adaptador PGlite isolado; não substitui PostgreSQL 16 nativo/CI.

## Limites e próximos percursos

- Registado para ADMIN não comprova leitura, push, email, compra, reposição, pagamento ou stock físico. Esta operação não movimenta existências nem emite documentos.
- Recuperação explícita, no dispositivo original; navegador com IndexedDB, armazenamento local e Web Locks. Limpeza dos dados do dispositivo não é protegida por uma cópia remota do rascunho.
- O formulário prepara pedidos associados a visitas REGULAR. Extras conservam a restrição anterior; o endpoint admite nota geral com visita/piscina explicitamente nulas. Não foi acrescentada migração de autoria da fila antiga.
- A conta conserva um pedido de material por confirmar. Recusas por contexto/atribuição exigem revisão com o escritório; este lote não acrescenta cancelamento ou transferência de pedidos já tentados.
- A inspeção encontrou percursos ainda por tratar separadamente: ocorrência em `saveProblem()` usa fallback de notas/lista global e criação sem UUID; entrada de novo cliente conserva envio/validação antigos; relatório administrativo não aplica o mês escolhido ao agregado e pode confundir falha com zeros. São achados de fonte, ainda sem reprodução runtime própria.
- Revisão global de páginas/PDFs/idiomas, valorização histórica, planeamento avançado, vídeo/IA offline, aparelhos reais e serviços externos permanecem na matriz atual. Sem declaração de prontidão global.
