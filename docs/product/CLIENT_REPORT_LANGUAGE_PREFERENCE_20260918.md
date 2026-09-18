# TASK266 — Idioma preferido dos relatórios por cliente

## Contrato

ADMIN pode guardar PT/EN/FR/ES nas configurações do relatório de cada cliente. O idioma fica separado dos 15 campos de visibilidade e da língua da conta. Não é inferido pelo nome. Sem preferência guardada, conserva português. Os relatórios individuais REGULAR/EXTRA, HTML/PDF, usam a preferência quando lang é omitido; lang explícito continua a prevalecer só nessa abertura. Content-Language, HTML lang e versão das configurações confirmam o resultado. Notas e dados introduzidos conservam o texto original.

Persistência usa SystemSetting com chave CLIENT_REPORT_LANGUAGE:<clientId>, sem migração ou dependência nova. A preferência participa na mesma transação das opções, auditoria e comprovativo CLIENT_REPORT_SETTINGS, sob bloqueio do cliente. A versão inclui a identidade/valor/data da preferência. As rotas genéricas de configurações globais, individual e bulk, recusam esta chave: alteração passa pela revisão do cliente. Leitura inválida/indisponível não se transforma num idioma presumido nem autoriza gravação. As leituras do relatório não criam preferências.

O contrato antigo de quatro propriedades continua aceite e conserva o idioma existente. O novo corpo acrescenta preferredLanguage e inclui-o no hash/contexto do pedido. Clientes sem preferência conservam a versão v1 anterior. Comprovativos antigos são devolvidos sem reescrita, mesmo após alterações posteriores. Rascunhos/pedidos locais v1 sem idioma continuam recuperáveis; novas leituras e novos comprovativos exigem idioma válido. Repetições com o mesmo UUID e outro idioma são recusadas. Alterações concorrentes exigem revisão, sem substituição silenciosa.

## Interface

O seletor de idioma preferido guarda com as configurações e acompanha rascunhos, confirmação de pedidos, conflitos e mudança de conta. A revisão compara Atual/Proposta, mantendo o valor atual quando o idioma não foi alterado no rascunho. A escolha temporária "Idioma nesta abertura" começa na preferência guardada ao carregar o cliente; mudar essa escolha não é uma alteração das configurações. Pré-visualização bloqueada com rascunho ou pedido pendente. Alterar a preferência cancela uma abertura em curso, incluindo A-B-A.

A revisão visual encontrou o min-width global de 560 px a cortar a coluna Proposta no telemóvel. A tabela desta página agora cabe na largura disponível, com as três colunas verificadas em 320/390/1440 px. A correção fica limitada à tabela de revisão desta página.

## Verificação local

Run `run-1789744072492`: API de configurações aprovada, incluindo versões/recibos históricos, valores estritos, idioma de conta independente, rollback de preferência/opções/auditoria/comprovativo, repetição em dois processos HTTP, concorrência, proteção das rotas globais e recusa de preferência corrompida. Matriz dos quatro idiomas nos relatórios REGULAR/EXTRA × HTML/PDF verifica herança, substituição explícita, versões desatualizadas, papéis autorizados e cliente alheio. Registos de cliente/instalação/visitas e contadores financeiros preservados.

Run `run-1789744203338`: interface, relatório individual, relatório extra e abertura autenticada aprovados. Navegador verifica gravação só de idioma, rascunho recuperado, resposta perdida, confirmação após edição posterior, rascunho de outro cliente, escolha temporária, cancelamento A-B-A, conflito com revisão do idioma, preservação do idioma que não foi editado, respostas inválidas e sessão. Reconstituição de pedido/comprovativo anterior à alteração confirma corpo/hash/resposta originais; rascunho antigo ainda pode ser gravado.

396 unitários/63 ficheiros, quatro técnicos, sintaxe 557 backend/182 frontend/56 inline aprovados. Runner 151 grupos e 21 migrações mantidos, cache v86. Evidência PDF em `reports/field-visual/client-report-language-1789744077186`: oito PDFs de uma página, todos revistos com Poppler; extração independente pdfplumber confirmou notas, rodapés, margens e ausência de NUL. Dados sintéticos. Run final `run-1789744378184`: interface completa novamente aprovada após a correção da tabela; 51 células visíveis e dentro da largura em 320/390/1440 px. Capturas finais `report-settings-1789744382982` revistas. CI nativo/restauro ainda por confirmar nesta publicação.

## Âmbito e retoma

Dez ficheiros: clientReportSettingsService.js, visitReportService.js, systemSettingService.js, report-settings.html, report-settings.js, sw.js, test-field-report-settings.js, test-field-report-settings-ui.js e estes dois documentos de checkpoint.

Preferência explícita por cliente é distinta de uma escolha explícita de idioma na abertura. Os alertas ADMIN ainda começam na sua escolha de português e enviam lang explícito; o relatório financeiro mensal mantém seleção própria. Próximo percurso: oferecer a preferência do cliente como opção nos restantes pontos de abertura, começando pelos alertas, sem perder a identificação do idioma efetivamente recebido. Notas originais e frequência por cliente/época/instalação preservadas: três ou mais visitas conforme cada caso. Publicação apenas na branch de trabalho autorizada, sem merge/deploy.
