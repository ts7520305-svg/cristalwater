# CURRENT_WORK_CHECKPOINT

## Ponto de retoma atual — 15/09/2026

- Repositório: `ts7520305-svg/cristalwater`.
- Branch de trabalho: `work/field-readiness-20260915-simulation`.
- Última entrega remota verificada antes da TASK155: TASK154, commit `cee201e36f1fcca50f516e13eff9a70667b3c0b1`; workflow `35014522656` aprovado, incluindo 323 testes unitários, 17 scripts de navegador, 59 grupos operacionais, PostgreSQL 16 e restauro de 99 tabelas/11 anexos. Inclui as TASK151–154.
- TASK155: cancelamento com leitura/bloqueio transacional, proteção do histórico de pagamentos, efeitos internos obrigatórios e repetição sem duplicar registos. Reprodução e correção documentadas em `INVOICE_CANCELLATION_20260915.md`; três grupos aprovados em `field-qa-runtime/run-1789501568906`. Continuar por notas de crédito e pagamentos de reparações, conforme o pedido «sem parar até aos 100%»; não declarar conclusão global sem fechar os critérios.
- TASK156: nota de crédito interna atómica, UUID/motivo obrigatórios, total não negativo, preservação do dinheiro recebido e libertação incremental de crédito já pago. Reprodução/correção em `INVOICE_CREDIT_NOTE_20260915.md`; três grupos aprovados em `field-qa-runtime/run-1789501855427`. Integrações deste endpoint passam a enviar UUID. Prosseguir com pagamento de reparações e revisão dos relatórios financeiros (separar aplicação de crédito de novo dinheiro).
- TASK153: quatro APIs de ativação unificadas, crédito anterior preservado, recebimento inicial no histórico comum e confirmação idempotente/atómica. Ensaio `field-qa-runtime/run-1789500059859` aprovado com recebimentos e simulação de dois anos. Relatório `CONTRACT_ACTIVATION_20260915.md`. Publicada no commit `37f7f0f7640677f9675e65618011a30dcaf03599`; workflow `35013734094` com 58 grupos em verificação. O sistema completo não está declarado concluído.
- TASK154: formulário de ativação com pedido persistente por conta, repetição explícita, validação da confirmação, coordenação entre janelas e proteção de sessão/armazenamento. Relatório `CONTRACT_ACTIVATION_UI_20260915.md`; primeiro ensaio em Chromium/API/base aprovado em `field-qa-runtime/run-1789500629586`. Próximo trabalho: rever notas de crédito, cancelamento concorrente e pagamento dedicado de reparações; consolidar a matriz de completude com as entregas posteriores à TASK82.
- TASK123: notas da piscina e seleção correta dos lembretes no endpoint da rota, implementadas. Teste API com 505 lembretes gerais, 23 operacionais, duas piscinas, reatribuição e visitas extra aprovado em `field-qa-runtime/run-1789467419688`. 218 testes unitários e 4 de técnicos aprovados.
- TASK124: notas no ecrã de campo, avisos recorrentes atrasados e confirmação de início completa e vinculada à visita/sessão implementados. Percurso real verificado em PT/EN/FR/ES/DE; regressão local final aprovada: 218 testes unitários, 4 de técnicos, 17 scripts de navegador e 33 grupos integrados (`reports/field-suite/1789468180539/results.json`). Imagem: `reports/field-visual/visit-briefing-1789468325934/technician-briefing-mobile.png`. Workflow PostgreSQL 16/restauro aprovado no commit acima. Continuação sem aprovações intermédias conforme pedido «continua sem parar».
- Relatórios atuais: `VISIT_BRIEFING_API_20260915.md` e `VISIT_BRIEFING_UI_20260915.md`. Inventário concluído nas TASK121/TASK122; não repetir a implementação.

- TASK125 implementada: conclusão atómica/idempotente dos serviços periódicos na ficha, CRM e agenda; interface protegida contra cliques repetidos e respostas perdidas. Relatório `SERVICE_REMINDER_COMPLETION_20260915.md`. Reprodução inicial confirmada; testes dirigidos API/base/Chromium aprovados em `field-qa-runtime/run-1789469812066`. Bateria local final aprovada: 234 testes unitários, 4 de técnicos, 17 scripts de navegador, sintaxe de 487 ficheiros backend e 34 grupos integrados (`reports/field-suite/1789469956928/results.json`). Workflow PostgreSQL 16/restauro da TASK125 aprovado conforme o commit acima.

- TASK126: consulta completa dos lembretes com pendentes antes do histórico; reprodução confirmou zero pendentes na ficha perante 105 concluídos/505 pendentes. Relatório `REMINDER_VISIBILITY_20260915.md`. Teste da consulta aprovado em `field-qa-runtime/run-1789470809542`, com 235 testes unitários e 4 de técnicos.

- TASK127: criação com `requestId`, comprovativo transacional e recusa de repetições alteradas implementada. 249 testes unitários, 4 de técnicos e testes integrados dirigidos aprovados em `field-qa-runtime/run-1789471051397`. Os três formulários são tratados pela TASK128. Relatório `REMINDER_CREATION_API_20260915.md`.

- TASK128 implementada: pedido persistido e imutável nos três formulários, repetição explícita, duas janelas, confirmação inválida, quota/corrupção, rejeição e mudança de sessão. Relatório `REMINDER_CREATION_UI_20260915.md`. Versão final aprovada em `field-qa-runtime/run-1789472050268`, incluindo PT/EN/FR/ES/DE e recuperação da carga inicial. 249 testes unitários, 4 de técnicos e 17 scripts de navegador aprovados; 34 grupos da bateria `reports/field-suite/1789471734616/results.json` passaram, e a falha do novo grupo nos idiomas foi corrigida e revalidada no teste dirigido final. Os 35 grupos e o restauro passaram no workflow 34964272796 do commit f453c729575453c7a6e62d9aeff68b995fbbc17d. Imagem: `reports/field-visual/reminder-creation-1789472056455/lembrete-recuperado.png`.

- TASK129 implementada: eliminação com IDs/categoria/piscina estritos, versão otimista, comprovativo transacional e repetição segura. Ensaio dirigido aprovado em `field-qa-runtime/run-1789473148930`, incluindo criação e conclusão existentes. Relatório `REMINDER_DELETION_API_20260915.md`. A confirmação nos ecrãs está implementada na TASK130.

- TASK130 implementada: confirmação de eliminação comum à ficha/CRM, título e piscina exatos, sessão/versão, resposta perdida ou trocada, refrescamento falhado e cliques tardios. Relatório `REMINDER_DELETION_UI_20260915.md`. 36 grupos integrados aprovados em `reports/field-suite/1789473623034/results.json`, com 272 testes unitários, 4 de técnicos e 17 scripts de navegador. Revisão final de libertação dos botões verificada no ensaio dirigido `field-qa-runtime/run-1789473837096`; workflow 34966846294 aprovado no commit c172760caeb34d1f918f7b0992ea5f33047a2539, incluindo PostgreSQL e restauro.

- TASK131 implementada: listas do CRM coerentes, conclusão com confirmação validada, repetição segura, rejeição de consultas/respostas antigas e estados históricos corretos. Reprodução em `field-qa-runtime/run-1789474663761`; ensaio dirigido aprovado em `field-qa-runtime/run-1789474965482`. Relatório `CRM_REMINDER_COMPLETION_20260915.md`. 37 grupos aprovados em `reports/field-suite/1789475096683/results.json`. Revisão final aprovada em `field-qa-runtime/run-1789475349814`, com 272 testes unitários/4 de técnicos; 17 scripts de navegador aprovados. Imagem revista em `reports/field-visual/crm-reminders-1789475367994/crm-lembrete-concluido.png`. Confirmar workflow publicado.

- TASK132 implementada após divergência entre dois workflows da TASK131: um passou; outro falhou ao esperar a recuperação em português. Reprodução determinística confirmou perda da última escolha de idioma durante resposta anterior retida e reload. Preferência pendente agora conservada por conta e retomada; ensaio dirigido aprovado em `field-qa-runtime/run-1789476149709`. Teste de recuperação passa a isolar o idioma esperado. Relatório `LANGUAGE_RELOAD_RECOVERY_20260915.md`. CI final com 38 grupos e restauro aprovado no workflow 34970756321.

- TASK133 implementada: consulta completa dos alertas administrativos, críticos antes dos restantes, autenticação do router e conservação da última lista após erro. Reprodução confirmou quatro alertas antigos ocultos e acesso sem token. Ensaio dirigido aprovado em `field-qa-runtime/run-1789477690689`, incluindo API/base/Chromium, água/regressos e acesso. Relatório `ALERT_VISIBILITY_20260915.md`. 278 testes unitários, 4 de técnicos, 17 scripts de navegador e sintaxe de 493 ficheiros backend aprovados. Workflow 34973409103 aprovado com 39 grupos e restauro no commit acima.

- TASK134 implementada: resolução transacional dos alertas, proteção do fecho físico da água/bomba e dos estados operacionais, versão, comprovativo original e confirmação validada no ecrã. Reprodução em `field-qa-runtime/run-1789478946210`; ensaio dirigido aprovado em `field-qa-runtime/run-1789479629638`. Relatório `ALERT_RESOLUTION_20260915.md`. Revisão final aprovada em `field-qa-runtime/run-1789479845553`, após corrigir os botões durante o fim da operação anterior. 302 testes unitários, 4 de técnicos e 17 scripts de navegador aprovados. Workflow 34977164799 aprovado no commit acima, com 302 testes unitários, 17 scripts de navegador, 40 grupos operacionais e restauro de 99 tabelas/11 anexos.

- TASK135 implementada: conversão de alertas em rascunhos avulsos, sem duplicar pedidos nem alterar documentos emitidos/pagos. Comprovativo transacional, identidade partilhada entre alerta e notificação associada, versão/cliente, valores em cêntimos e recuperação persistente no ecrã. Reprodução em `field-qa-runtime/run-1789480413006`; quatro grupos dirigidos aprovados em `field-qa-runtime/run-1789481333543`. Relatório `ALERT_BILLING_20260915.md`. 322 testes unitários em 57 ficheiros, quatro testes de técnicos, 17 scripts de navegador e sintaxe de 496 ficheiros backend aprovados. Workflow 34980050739 aprovado no commit `050a7a3ae11ebc1f7be8e7945c2356644e9c7284`, com 41 grupos e restauro de 99 tabelas/11 anexos.

- TASK136 implementada: bloqueio de pagamentos sobre rascunhos e documentos retirados, aplicado aos quatro percursos e ao crédito automático; saldos e dívida do Finance OS corrigidos. Reprodução em `field-qa-runtime/run-1789482654961`; ensaio dirigido em `field-qa-runtime/run-1789482907566`. Relatório `DRAFT_PAYMENT_GUARD_20260915.md`. Workflow 34982947007 aprovado no commit `6e7a795a9ece95cec26dfff188f3a9b5fe2f25ba`, com 42 grupos e restauro de 99 tabelas/11 anexos. A classificação do ecrã está tratada na TASK137.

- TASK137 implementada: rascunhos identificados, filtro próprio, ações de pagamento/PDF protegidas, valores cobraveis coerentes no ecrã/API/dashboard, estado de adiantamento e recuperação de consultas/sessão. Reprodução em `field-qa-runtime/run-1789483176194`; ensaio dirigido final aprovado em `field-qa-runtime/run-1789483564490`, incluindo pagamentos e faturação de alertas. Relatório `DRAFT_VISIBILITY_20260915.md`. 322 testes unitários, quatro de técnicos e sintaxe de 496 ficheiros backend aprovados. A implementação concorrente da interface foi reconciliada na TASK138; confirmar o workflow final com 44 grupos e restauro.

- TASK138 publicada no commit `a526a9e2fdc438ad4321be6a0bef93a32da3fa10`: reconciliação da TASK137 local com as atualizações concorrentes até `8ac098f0ab7d03f0618b37ac6d0152c821251e2e`. Conservados estilos/contador e os dois testes de interface; o runner mantém os 42 grupos anteriores e passa a 44. Quatro ensaios dirigidos aprovados em `field-qa-runtime/run-1789483932485`, com 322 testes unitários e quatro de técnicos. O workflow `34985396401` passou 43 dos 44 grupos; a comparação monetária do novo teste foi corrigida na TASK139.

- TASK139: teste de visibilidade compara deltas monetários em cêntimos inteiros e inclui histórico fracionário de 123,45 EUR. Corrige a comparação binária `89.99999999999997 !== 90` encontrada no CI, mantendo as verificações exatas de dívida e contagens. Ensaio dirigido aprovado em `field-qa-runtime/run-1789484810247`, com 322 testes unitários e quatro de técnicos. Ver `DRAFT_VISIBILITY_20260915.md`. Confirmar o workflow final com 44 grupos e restauro.

### Pedido ativo

- TASK140: repetição segura de pagamentos implementada nos quatro percursos da API. Reprodução em `field-qa-runtime/run-1789485522002` confirmou dois pagamentos de 10 EUR para o mesmo `requestId` em todos os percursos. A confirmação passa a ser guardada na mesma transação do pagamento/crédito, com bloqueio por pedido, identidade do responsável, fatura e valores em cêntimos. Reutilização do identificador com outros dados ou responsável devolve 409; repetições devolvem a confirmação original mesmo depois de pagamentos posteriores ou cancelamento. A mesma chave funciona entre os quatro percursos. Falha ao guardar a confirmação reverte os efeitos financeiros e notificações/auditoria transacionais. Finance OS não volta a emitir o evento ao repetir uma confirmação guardada.
  - Ensaio dirigido aprovado em `field-qa-runtime/run-1789485722445`: repetição de pagamentos, proteção dos rascunhos e regressão Finance OS. Inclui oito chamadas simultâneas por percurso, doze chamadas entre percursos, excedente de 5 EUR registado uma vez, mudança de responsável/dados, valores malformados e falha transacional forçada.
  - Dez ficheiros: serviço `invoicePaymentRequestService.js`, dois negócios financeiros, controlador Finance OS, três routers, teste `test-field-payment-retry.js`, runner de 45 grupos e este checkpoint. Sem migração de esquema; reutiliza os comprovativos internos existentes em `OperationalReminder`.
  - Compatibilidade: integrações sem `requestId` conservam o comportamento anterior e não beneficiam desta garantia. O formulário de faturas deve passar a enviar e conservar o pedido na TASK141. Outros ecrãs e o recebimento geral por cliente continuam sujeitos a revisão própria. O evento do Finance OS após commit mantém o mecanismo existente; esta tarefa não cria uma fila durável de entrega de eventos. Confirmar o CI final publicado, incluindo restauro.

O proprietário pediu continuar a implementação e correções sem aprovações intermédias, concluir os módulos e testar os percursos completos, como registado em `FIELD_READINESS_20260914.md`. Não voltar a usar o congelamento de julho para impedir este trabalho autorizado. Instalação no VPS, ensaios físicos, canais externos, emissão fiscal, alterações destrutivas de produção e merge para a branch principal não fazem parte desta tarefa.

- TASK141: formulário de faturas com pedido persistido, confirmação validada, recuperação após reload/resposta perdida, coordenação entre janelas, consulta recente antes do envio e proteção de sessão. Navegação da página corrigida com os estilos comuns existentes. Relatório `INVOICE_PAYMENT_RECOVERY_20260915.md`. Revisão dirigida da interface, navegação e filtros aprovada em `field-qa-runtime/run-1789486703205`; 322 testes unitários e quatro de técnicos aprovados. O teste estático passa a esperar os IDs exatos para não aceitar a lista anterior com a mesma contagem. Confirmar a versão final no CI com 46 grupos e restauro. O recebimento geral por cliente e os restantes ecrãs financeiros permanecem a rever.

- TASK142 implementada: recebimento geral por cliente atómico e idempotente, distribuição em cêntimos pelas faturas cobraveis mais antigas, crédito excedente, estado final e confirmação na mesma transação. Lista de cobranças usa dívida real e conserva pagamentos parciais visíveis; `mark-paid` sem valor passa a exigir recebimento. Relatório `CLIENT_RECEIPTS_20260915.md`. Três ensaios dirigidos aprovados em `field-qa-runtime/run-1789488384427`. CI da TASK142 aprovado no workflow acima com 47 grupos e restauro. A interface está tratada na TASK143.

- TASK143 implementada: formulário único no ecrã de cobranças, pedido persistente por conta, confirmação de parcelas e crédito, recuperação depois de resposta perdida/reload, coordenação entre janelas e consulta recente antes do envio. Falhas de leitura conservam a lista e bloqueiam recebimentos; mudanças de mês/sessão e respostas antigas são protegidas. Contraste dos cartões e navegação em telemóvel/desktop corrigidos. Relatório `CLIENT_RECEIPT_RECOVERY_20260915.md`. Três ensaios dirigidos aprovados em `field-qa-runtime/run-1789488990249`, com 322 testes unitários e quatro de técnicos. CI final da TASK143 aprovado no workflow acima com 48 grupos e restauro.

- TASK144 implementada: aplicação de crédito serializada por cliente depois do bloqueio da fatura; releitura do saldo, cálculo em cêntimos, comunicação obrigatória na transação. Finance OS deixa de consumir crédito anterior quando o dinheiro recebido já liquida a fatura. Reprodução determinística de concorrência em teste unitário e perda de crédito pelo Finance OS em `field-qa-runtime/run-1789489780281`; quatro ensaios dirigidos aprovados em `field-qa-runtime/run-1789489938046`. Relatório `CLIENT_CREDIT_CONSERVATION_20260915.md`. A faturação mensal antiga foi ligada ao serviço comum na TASK145. CI da TASK144 aprovado no workflow acima, com 49 grupos e restauro.

- TASK145 implementada: faturação mensal antiga delega num negócio transacional e reutiliza a aplicação comum de crédito. Mantém o valor do serviço e regista o pagamento CREDIT; cliente/mês e recebimentos partilham bloqueios antes das faturas. Geração repetida, documentos pagos/emitidos/retirados, crédito histórico e falhas são protegidos. Reprodução em `field-qa-runtime/run-1789490171902`; primeiro ensaio corrigido em `field-qa-runtime/run-1789490339202`. Relatório `MONTHLY_CREDIT_CONSERVATION_20260915.md`. Revisão final aprovada em `field-qa-runtime/run-1789490451144`, com 323 testes unitários e quatro de técnicos. Confirmar CI final com 50 grupos e restauro.

- TASK146: excedentes Finance OS passam a ter movimento de pagamento no histórico, além do saldo de crédito, com confirmação original e reversão transacional. Referências de adiantamentos com UUID; outras dívidas não ficam marcadas como pagas ao receber crédito. Reprodução em `field-qa-runtime/run-1789492009477`; ensaio dirigido em `field-qa-runtime/run-1789492185342`. Relatório `SURPLUS_LEDGER_20260915.md`. Confirmar CI com 51 grupos e restauro. Prosseguir com ajustes manuais de crédito, separados dos recebimentos.

- TASK147: crédito interno positivo separado de dinheiro recebido, UUID obrigatório, saldo observado, motivo e auditoria transacional com repetição segura. Ecrã antigo de cobranças ligado ao contrato real e aos percursos existentes de pagamento; formulário recuperável por conta, duas janelas, resposta perdida/trocada, quota/corrupção e sessão. Relatório `CREDIT_ADJUSTMENT_20260915.md`. Percurso completo em `field-qa-runtime/run-1789493316764`; revisão/regressão em `field-qa-runtime/run-1789493443974`. 323 testes unitários, quatro de técnicos e 500 ficheiros backend com sintaxe aprovada. Confirmar o workflow do commit final com 52 grupos e restauro. Não repetir TASK146/TASK147.

- TASK148: gerador mensal antigo respeita o plano explícito do cliente, incluindo total de todas as piscinas, períodos gratuitos e proporcionalidade diária. Sem plano conserva os preços antigos por piscina. Cliente bloqueado durante leitura do plano; documentos existentes preservados; auditoria da versão/cálculo na transação. Reprodução confirmou 20 EUR em vez de 120 EUR em `field-qa-runtime/run-1789494281889`. Seis grupos dirigidos aprovados em `field-qa-runtime/run-1789494413762`, com 323 testes unitários, quatro de técnicos e 500 ficheiros backend com sintaxe aprovada. Relatório `MONTHLY_RATE_ALIGNMENT_20260915.md`. Confirmar workflow final com 53 grupos e restauro.

- TASK149: core, core legado e operacional criam faturas apenas se o cliente/mês ainda não existe. Negócio transacional partilhado conserva documentos, linhas, pagamentos e fontes; repetições devolvem 409 com a fatura. Criação, crédito e indicadores dos serviços são atómicos; visitas de outros meses e fontes assumidas concorrentemente são protegidas. Reprodução alterou uma fatura paga de 120 para 131 EUR e consumiu 10 EUR de crédito em `field-qa-runtime/run-1789495368206`. Ensaio inicial de quatro grupos aprovado em `field-qa-runtime/run-1789495572877`; regressões em `field-qa-runtime/run-1789495742061`, com a revisão final do teste de concorrência aprovada em `field-qa-runtime/run-1789495855834`. Relatório `INVOICE_REGENERATION_20260915.md`. 323 testes unitários, quatro de técnicos e sintaxe de 502 ficheiros backend aprovados. Confirmar workflow final com 54 grupos e restauro.

- TASK150: as duas gerações de `invoiceRoutes` partilham um negócio com criação, crédito, pagamento, saldo e comunicação na mesma transação por cliente. Faturas existentes conservam preços/linhas/histórico e continuam a poder receber crédito elegível com resposta 200. Contrato, plano e identidade do documento são relidos depois dos bloqueios; novo documento concorrente leva a repetição sem inverter a ordem fatura/cliente. Reprodução em `field-qa-runtime/run-1789497083321`: erro de comunicação deixou uma fatura de 80 EUR parcialmente processada. As dez reversões passaram em `run-1789497671868`, assim como quatro grupos de regressão; o adaptador PGlite fechou ligações após falhas forçadas e interrompeu o novo grupo e testes antigos, confirmado em `run-1789497786885`. Não aceitar esses erros como sucesso; confirmar o workflow PostgreSQL 16 final com 55 grupos e restauro. 323 testes unitários e quatro de técnicos aprovados. Relatório `INVOICE_PAGE_GENERATION_20260915.md`.

- TASK151: seleção mensal de reparações exclui referências REPAIR já presentes em qualquer documento, mês ou cliente, preservando as faturas antigas e o estado pago da reparação. Reprodução confirmou repetição dos 9 EUR em `run-1789498840505`; quatro grupos aprovados em `run-1789498874726`. Relatório `REPAIR_MONTHLY_ONCE_20260915.md`. Runner com 56 grupos; prosseguir pelo percurso dedicado, cuja criação de rascunho perde a referência e usa transações separadas. O proprietário pediu continuar até finalizar o sistema; não encerrar a revisão global apenas com este ponto.

- TASK152: fatura dedicada de reparações conserva `referenceId`/`lineType`; origem validada/reservada no Finance OS e nos geradores mensais. Criação, emissão interna, reparação, histórico, auditoria e notificação usam a mesma transação, incluindo chamadas com Prisma de raiz; eventos só depois do commit controlado. INVOICED legado não volta a gerar fatura sem referência. O ensaio inicial `run-1789499174407` expôs transações aninhadas e exceção não tratada; `run-1789499358841` aprovou origens/concorrência e cinco regressões, com interrupção do adaptador PGlite depois de uma falha forçada. Relatório `REPAIR_INVOICE_ATOMIC_20260915.md`; confirmar a árvore final com 57 grupos em PostgreSQL 16. Prosseguir por ativação de contratos, notas de crédito e atualização da matriz global de pendências.

### Estado verificado

O código contém as entregas até TASK118: orçamentos versionados e portal, preços por período, sessões/logout, idiomas, proteção de dados, manutenção preventiva com configuração e avisos, retornos de visitas e seleção de cargas de químicos. Cada relatório delimita o escopo efetivamente testado; não significa que a especificação inteira esteja concluída.

A TASK119 unifica a identidade de produto/unidade entre saldo, movimento e repetição da contagem; conserva reenvios antigos exatos; recusa tipos malformados; protege contra repetição com quantidade alterada e consumo concorrente.

### Evidência da TASK119 (retoma anterior)

Evidência atual da TASK120: 216 testes unitários, 4 testes de técnicos, os 15 scripts de navegador e os 32 grupos integrados locais aprovados. Resultado: `reports/field-suite/1789464442010/results.json`. As imagens atuais estão em `reports/field-visual/inventory-count-<timestamp>/`. O relatório `INVENTORY_COUNT_UI_20260915.md` delimita os ensaios e as pendências.

- Base local e remota da TASK118 com a mesma árvore Git: `8cc09c0e3df85a82a5da7751924b4d4b7dda0699`.
- Sintaxe aprovada em 484 ficheiros backend e nos scripts alterados.
- `npm test`: 216 testes em 49 ficheiros aprovados; `npm run test:technician`: 4 aprovados.
- Teste operacional de stock em base descartável aprovado: `field-qa-runtime/run-1789462922026`.
- Bateria integrada local: `reports/field-suite/1789462961988/results.json`; 31 grupos aprovados, incluindo a versão final dos testes de contagem. Base descartável PGlite, sem alegações de desempenho do VPS.
- `npm run test:field-browser`: os 14 scripts de navegador aprovados.
- PostgreSQL 16/migrações/restauro: confirmar o workflow do commit final; não usar a aprovação de um commit anterior como prova desta alteração.

### Próxima retoma

1. TASK144–TASK150 conservam crédito, registam excedentes, auditam ajustes internos, integram planos e protegem a criação e preservação das faturas. Confirmar workflow final com 55 grupos; não repetir estas correções. Prosseguir pelas referências de reparações já cobradas noutros meses, ativação de contrato e notas de crédito. Não fazer migrações ou reescritas históricas automáticas. Os valores de recurso dos clientes sem plano e as diferenças de categorias entre percursos foram conservados.
2. A coerência e conclusão dos lembretes no CRM estão tratadas na TASK131. Prosseguir a revisão dos outros ecrãs operacionais, a partir da implementação atual e relatórios posteriores; não repetir os fluxos de lembretes já corrigidos.
3. Continuar a revisão dos módulos pendentes usando `COMPLETENESS_20260915.md` juntamente com `IMPLEMENTATION_20260915.md` e os relatórios posteriores. A matriz de completude conserva o diagnóstico inicial e contém pontos já corrigidos posteriormente.
4. Manter tarefas pequenas, com testes de comportamento e documentação. Não repetir trabalho apenas por encontrar um relatório antigo.
5. Ensaios físicos e VPS permanecem pendentes. Não declarar o sistema inteiro concluído ou certificado para campo.

## Registo histórico — 21/07/2026 (não é a fase ativa)

1. Data e hora
- 2026-07-21 09:12 UTC

2. Fase ativa
- FASE 6.0 - VALIDACAO GLOBAL E TESTES DE CAMPO.

3. Estado atual
- GRUPOS 1-5 CERTIFICADOS E CONGELADOS.
- GRUPO 6 NAO INICIADO.
- PROJETO EM FASE OFICIAL DE VALIDACAO GLOBAL.

4. Resultado consolidado
- Bloco 1 (Admin): PASS.
- Bloco 2 (Tecnico): PASS.
- Bloco 3 (Cliente): PASS.
- Bloco 4 (Campo): automacao concluida; falta validacao humana em campo.
- Bloco 5: nenhum bug real confirmado.
- Bloco 6: pronto para preparacao de release apos testes de campo.

5. Ultimo passo concluido
- Inicio da validacao de campo controlada (Dia 1): automacao executada, sem bug funcional real confirmado; 2 validacoes pendentes de compatibilidade de scripts registradas em GLOBAL_VALIDATION_ISSUE_TRACKER.md (GV-V001/GV-V002).

6. Artefatos finais criados/atualizados
- docs/product/GROUP4_MIGRATION_REPORT.md
- docs/product/GROUP4_ACCEPTANCE_AUDIT.md
- docs/product/GROUP4_SCOPE_MAPPING.md
- docs/product/GROUP4_EXECUTION_PLAN.md
- docs/product/GROUP4_PROGRESS_MATRIX.md
- docs/product/GROUP4_FINAL_AUDIT.md
- docs/product/GROUP4_FINAL_CERTIFICATION.md
- docs/product/CERTIFIED_UI_FREEZE_REGISTER.md
- docs/product/CURRENT_TODO.md
- docs/product/GROUP5_SCOPE_MAPPING.md
- docs/product/GROUP5_EXECUTION_PLAN.md
- docs/product/GROUP5_MIGRATION_REPORT.md
- docs/product/GROUP5_ACCEPTANCE_AUDIT.md
- docs/product/GROUP5_FINAL_AUDIT.md
- docs/product/GROUP5_FINAL_CERTIFICATION.md
- docs/product/GROUP6_PRECHECK.md
- docs/product/GLOBAL_VALIDATION_PHASE_PLAN.md
- docs/product/FIELD_TEST_EXECUTION_PROTOCOL.md
- docs/product/GLOBAL_VALIDATION_ISSUE_TRACKER.md

7. Evidencias finais
- docs/product/evidence/group4/before/*
- docs/product/evidence/group4/after/*

8. Regras de retoma
- Nao iniciar Grupo 6.
- Nao adicionar funcionalidades.
- Nao fazer redesign.
- Corrigir apenas bugs reais encontrados em campo.

9. Proximo passo permitido
- Iniciar validacao de campo real seguindo docs/product/FIELD_TEST_EXECUTION_PROTOCOL.md.

12. Estado da validacao de campo (hoje)
- Bloco 4 automatizavel executado.
- Pendencias: alinhar scripts legados de automacao com autenticacao atual antes de reutilizacao plena.
- Validacao humana em campo continua obrigatoria (janela 5-7 dias).
- Regra de prioridade ativa: P0/P1 corrige imediato; P2/P3 apenas registra durante a janela.

10. Confirmar
- Nenhum commit.
- Nenhum push.
- Nenhuma tag.

11. Documentos principais para retoma
- docs/product/CURRENT_WORK_CHECKPOINT.md
- docs/product/CURRENT_TODO.md
- docs/product/GLOBAL_VALIDATION_PHASE_PLAN.md
- docs/product/FIELD_TEST_EXECUTION_PROTOCOL.md
- docs/product/CERTIFIED_UI_FREEZE_REGISTER.md
