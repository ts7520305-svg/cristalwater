# TASK292 — Revisão de resultados incertos de email

## Âmbito

Base `592da9b049b733394deeda92d4e6466bb4e476a8`, publicada em conjunto com TASK291 na branch de trabalho. Nova página `/admin-email-review.html`, restrita à administração, ligada aos relatórios e ao menu. Permite consultar o registo original, associá-lo ao relatório correto e guardar decisão, motivo e referência da evidência verificada no serviço de email.

Uma revisão não envia mensagens nem altera o registo original. «Aceite pelo serviço» não comprova entrega ao destinatário. Resultados históricos sem associação exigem escolha explícita; o mês conhecido do assunto tem de coincidir. Uma origem cujo mês tenha sido alterado permanece visível e bloqueada, sem inutilizar a lista dos restantes meses.

## Integridade

- Auditoria guarda autor da sessão, relatório/origem, conteúdo original, decisão, motivo, evidência e hashes. Alterações posteriores invalidam a revisão. O relatório e o registo são relidos sob bloqueio; recibo e decisão são atómicos.
- Reutiliza `FieldWriteRequest` com âmbitos próprios de revisão e reenvio. UUID, titular, recurso, contexto e hash têm de concordar. Consulta do resultado é só leitura. Repetição recupera o recibo original.
- Um novo contacto exige revisão válida de não envio, regras/destinatário/conteúdo atuais apresentados e nova confirmação. Envios aceites e reservas com menos de 30 minutos bloqueiam o reenvio. Depois do prazo, a administração deve verificar no serviço que a tentativa terminou sem aceitar o destinatário; o tempo decorrido não é prova de falha.
- O bloqueio cobre todos os históricos do mesmo relatório. Foi reproduzido um erro no qual uma tentativa FAILED permitia contornar um registo PENDING recente: o preview respondeu 200 em vez de 409. A correção verifica a elegibilidade de todas as tentativas, também depois de um preview já preparado, e conserva zero contactos no caso bloqueado.
- Bloqueio no relatório serializa pedidos de históricos diferentes. Uma reserva nova, log PENDING, auditoria e recibo são guardados antes da chamada ao fornecedor. Recuperar essa reserva nunca chama novamente o fornecedor.
- O percurso mensal habitual, manual e automático, bloqueia relatórios já revistos; não usa a revisão como autorização implícita para enviar. O novo log conserva a associação ao relatório através da auditoria da reserva.
- Resultado do fornecedor distingue aceitação, recusa e incerteza; falha ao guardar o resultado conserva a reserva PENDING. O recibo comprova a reserva, não a entrega. Não há reenvio automático após erro, reload ou recuperação da ligação.
- SMTP tem limites de ligação/saudação/socket e resultado total de 90 segundos. Timeout permanece incerto, fecha o transporte e não repete o envio. Testes usam transporte simulado, incluindo resposta tardia, erro, integração desativada e SMTP não configurado.

## Interface e validação

Lista por mês com paginação de seis, texto literal e preview exato do novo contacto. Pedidos persistidos por conta em IndexedDB antes do POST; Web Locks, recuperação após resposta perdida/reabertura, consulta sem escrita, repetição explícita e verificação do recibo antes de remover o pedido pendente. Mudança de conta A–B–A oculta os dados anteriores e conserva pedidos/rascunhos. Armazenamento inválido bloqueia novos comandos.

`test-field-monthly-email-review.js`: permissões, campos/IDs, consulta sem escrita, cinco revisões concorrentes, contexto alterado, concorrência de reenvios/históricos, bloqueio do percurso antigo, associação/mês, registo contraditório visível, rollback e resultado incerto. `test-field-monthly-email-review-ui.js`: página real, confirmação, texto literal, 320/390/1440 px/escuro, duas janelas, perda de resposta, sessão, offline e corrupção do pedido local. Os envios são todos simulados para endereços `qa.invalid`.

API/UI finais e regressões de reparações: `/tmp/cw291-292-confirmed.log`. Regressões do período/envio mensal e interface anterior: `/tmp/cw291-292-final-focused.log` (esses grupos passaram; a falha posterior de stock está corrigida na TASK291). Reprodução do bloqueio por tentativa PENDING: `/tmp/cw292-sibling-reproduction.log`.

401 testes unitários/64 ficheiros, incluindo cinco ensaios SMTP, aprovados em `/tmp/cw291-292-final-unit.log`; sintaxe 585/192/59 em `/tmp/cw291-292-final-syntax.log`. Runner com 184 grupos distintos, cache v107, 26 migrações e 119 tabelas mantidas; sem nova dependência. Confirmar CI e restauro do commit publicado.

## Limites

A evidência é declarada pela administração, sem consulta automática ao fornecedor. Não altera decisões fiscais, valores, frequências, clientes, documentos ou pagamentos. Não resolve automaticamente associações históricas contraditórias, entrega real de SMTP, VPS, traduções integrais ou piloto físico. Sem merge, deploy ou contactos reais neste lote.

## Revisão final dos tipos de relatório

A primeira publicação é `963ef87c013c981519afe93c04ace5861e867071`, árvore `2ab1d8866783169452e44655993bb81dd3279df9`, CI inicial `35772194876`. A revisão posterior encontrou que a lista de seleção incluía também `EXTRA_VISITS`/outros tipos guardados em MonthlyReport, que a interface de email mensal não aceita. A consulta passa a oferecer exclusivamente CLIENT/ADMIN; a API recusa a associação explícita a outro tipo. Ligações históricas incompatíveis ficam visíveis e bloqueadas, sem ocultar os restantes registos.

Os ensaios API e de navegador agora incluem um relatório EXTRA_VISITS no mesmo mês. Os cinco grupos de email, na ordem do runner (período, entrega, interface anterior, revisão e nova interface), passaram em `/tmp/cw292-report-type-final.log`. A sintaxe dos três ficheiros alterados foi verificada. O CI final deve corresponder à revisão posterior; a primeira execução não comprova esta correção.
