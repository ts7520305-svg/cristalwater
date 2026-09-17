# TASK238–239 — pedidos de material e notas do modo de campo

## Estado

Confirmada no commit `b90e374c9356bb4c8256de00c9e59754087acb96`, árvore `b6dc513b7138bbc20d1daf6e1d49c42e475e6514`, CI `35266160067`: 133/133 grupos, 388 unitários/quatro técnicos, 21 scripts de navegador, 20 migrações aditivas, sintaxe de 541 JS backend/177 frontend/57 inline e restauro de 110 tabelas/32 ficheiros com linhas e hashes iguais em PostgreSQL 16. API de material: 1492 ms; UI: 14890 ms. Cache v66; nenhuma migração nova.

Preparada sobre `14d8e776825ea7e87848d1af8dae26f1176837f4`, publicada inicialmente em `40fa9dc3068ba1bebf744abaa51b5a48a11a356f` e com âmbito final do lembrete em `68df5a10ed918b994c1a156de6e42c0b3a0e612d`. O CI `35264319158` passou 132/133 grupos: o novo teste UI lia a mensagem imediatamente após um envio assíncrono. A espera explícita conservou as asserções de zero POST/texto preservado; a correção passou localmente em `run-1789673813390` e no CI final acima. O registo posterior altera apenas documentação; a evidência pertence ao commit de código indicado.

## Diagnóstico e alteração

A inspeção do código encontrou o botão de avisos a aceitar um `ok` genérico e a limpar os campos sem comprovativo do pedido. Qualquer falha escrevia numa lista global `cwPendingAdminAlerts`, limitada aos últimos 50 itens, através de uma função que ocultava falhas de armazenamento; o ecrã afirmava que o aviso estava guardado. Não foi encontrada recuperação dessa lista. Este diagnóstico foi por leitura de fonte, não por reprodução anterior à correção.

O endpoint aceitava identidades e contexto enviados pelo navegador, tolerava falha na criação do lembrete e criava notificações separadamente. A notificação ADMIN incluía `clientId` e a criação também chamava regras configuráveis de audiência. O filtro atual do feed CLIENT já exige papel CLIENT: não foi demonstrada fuga dessa notificação ADMIN pelo feed. A alteração mantém o destinatário ADMIN explícito, retira essa associação da notificação e evita duplicação por regras. O emissor Socket.IO global já tinha proteção MANAGEMENT anterior: esta alteração não é apresentada como descoberta de uma fuga global por socket.

TASK238 introduz `FIELD_STOCK_REQUEST` no mecanismo existente de pedidos de campo. Para pedidos modernos, UUID, proprietário tipado, técnico autenticado, tipo REGULAR, visita/piscina e os seis campos literais participam no comprovativo. Quantidades são opcionais; quando indicadas, têm de ser positivas, finitas e acompanhadas de unidade. Produtos, notas, prioridades, tipos e comprimentos são validados.

O servidor verifica o técnico ativo e a atribuição real da visita; cliente, nomes e viatura vêm da base de dados. Cria um OperationalReminder, uma notificação ADMIN, auditoria e comprovativo na mesma transação. Nenhuma falha obrigatória é ignorada. A notificação não recebe destinatário CLIENT/User nem é reenviada por regras configuráveis. O lembrete mantém o âmbito do técnico autenticado que fez o pedido, conservando cliente/piscina nos circuitos operacionais existentes. A revisão final encontrou que um lembrete sem atribuição seria mostrado aos outros técnicos da mesma piscina; a atribuição ao requerente foi mantida e a API de ronda tem prova explícita de inclusão apenas para ele. O aviso para a administração continua a ser a notificação ADMIN; isto não confirma compra ou execução de uma tarefa.

Uma resposta perdida é recuperada pelo mesmo proprietário/UUID/hash, incluindo após reinício e reatribuição posterior da visita. Reutilização com outro conteúdo é recusada. ADMIN não pode personificar um técnico neste endpoint. Chamadas antigas sem UUID continuam a devolver os objetos antigos apenas com identidade e contexto verificados, sem garantia de deduplicação; a prova de interligações passou a autenticar o técnico real.

TASK239 substitui a lista global por rascunho da conta e pedido persistido antes do POST, usando o armazenamento de campo existente. O rascunho conserva material, quantidade, unidade, nota, prioridade, tipo e visita/piscina originais, mesmo quando o técnico consulta outra visita. A recuperação tem botão próprio e continua disponível sem a visita original selecionada. Os campos só se limpam depois de resposta HTTP 200, comprovativo e conteúdo exatos, confirmação local persistida e limpeza do rascunho verificada. Uma falha nessa última limpeza permite limpar o rascunho confirmado sem repetir o POST.

Campos e estado deste formulário ficam fora do adaptador genérico de formulários. Há proteção de sessão, coordenação dos envios entre janelas, deteção de rascunho alterado noutra janela, corrupção/quota visíveis e recarga offline com o módulo incluído na cache. A revisão do dia inclui pedido por confirmar, rascunho por enviar, texto não guardado e avisos antigos por rever. Os bytes da fila global antiga são conservados, sem presumir autor, apagar ou enviar automaticamente.

## Evidência local

| Ensaio | Resultado |
|---|---|
| `test-field-stock-requests.js` | Resposta perdida após commit, reinício, seis pedidos em dois processos: um lembrete/notificação/auditoria e comprovativo idêntico. Falha injetada na inserção do comprovativo reverte todas as escritas. |
| Identidade e destinatários | CLIENT/outro técnico/ADMIN recusados; feed ADMIN recebe, feeds CLIENT/TECH não recebem a notificação; lembrete incluído na ronda do requerente e excluído da ronda de colega na mesma piscina. Regra de audiência alargada não duplica nem encaminha o pedido. User associado e chefe de equipa conservam Technician/owner corretos; conta inativa não escreve. |
| Contrato e compatibilidade | Conteúdo/UUID alterado, tipo EXTRA, campos adicionais, quantidade/unidade inválidas e contexto antigo falsificado recusados; novo pedido após reatribuição é recusado, original confirmado permanece recuperável. |
| `test-field-stock-requests-ui.js` | Formulário real, rascunho após recarga, troca de visita sem reatribuir o texto, preparação offline e recarga realmente offline; 51 avisos antigos mantêm os mesmos bytes. |
| Confirmação e falhas locais | Conteúdo de comprovativo alterado, quota no rascunho/IndexedDB/limpeza confirmada, resposta tardia após mudança de conta, regresso à conta original, duas janelas, BFCache e JSON corrompido. Não há limpeza nem indicação falsa de envio. |
| Administração e apresentação | Painel ADMIN real mostra autor autenticado e texto literal, sem executar HTML submetido. Larguras 320/390/1440 sem transbordo; estado e botão de recuperação não estão cobertos pela navegação. Captura Chromium 390 revista. |
| Regressões | `test-field-visit-types.js`, `test-field-internal-alert-ui.js` e `test-system-interconnections.js` aprovados. 388 unitários e sintaxe de 541 JS backend/177 frontend/57 inline aprovados. |

Execuções locais: `run-1789671922156` (API inicial), `run-1789672062023` (UI e três regressões), `run-1789672202906` (API/UI com revisão do dia e troca de visita), `run-1789672297009` (identidade final) e `run-1789672774083` (âmbito final do lembrete na ronda). A evidência local usa adaptador PGlite isolado; não substitui PostgreSQL 16 nativo/CI.

## Limites e próximos percursos

- Registado para ADMIN não comprova leitura, push, email, compra, reposição, pagamento ou stock físico. Esta operação não movimenta existências nem emite documentos.
- Recuperação explícita, no dispositivo original; navegador com IndexedDB, armazenamento local e Web Locks. Limpeza dos dados do dispositivo não é protegida por uma cópia remota do rascunho.
- O formulário prepara pedidos associados a visitas REGULAR. Extras conservam a restrição anterior; o endpoint admite nota geral com visita/piscina explicitamente nulas. Não foi acrescentada migração de autoria da fila antiga.
- A conta conserva um pedido de material por confirmar. Recusas por contexto/atribuição exigem revisão com o escritório; este lote não acrescenta cancelamento ou transferência de pedidos já tentados.
- A ocorrência foi tratada nas TASK240–241 (`FIELD_PROBLEM_REPORT_RECOVERY_20260917.md`). O cadastro em campo foi depois reproduzido em QA (`FIELD_CLIENT_INTAKE_REVIEW_20260917.md`), continuando por corrigir. O relatório administrativo também foi reproduzido no ecrã real, com respostas HTTP controladas: omite o período e apresenta fontes indisponíveis como zeros/estado atualizado; continua por corrigir.
- Revisão global de páginas/PDFs/idiomas, valorização histórica, planeamento avançado, vídeo/IA offline, aparelhos reais e serviços externos permanecem na matriz atual. Sem declaração de prontidão global.
