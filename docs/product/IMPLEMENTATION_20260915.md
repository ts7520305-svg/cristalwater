# Entregas após a revisão de completude

## TASK 83 — GPS offline legado

O emissor antigo guarda cada ponto numa entrada imutável, separada por identidade autenticada, com data de medição e precisão. A confirmação remove apenas esse ponto: novos registos durante o envio ficam preservados. A credencial é capturada antes do pedido e uma resposta de outra sessão não confirma nem remove registos. Os pontos antigos da fila global não são atribuídos a alguém apenas por coincidência de ID; ficam preservados com aviso para apoio. Falhas HTTP, respostas negativas e erros de armazenamento não são anunciados como sincronização bem-sucedida. A página antiga deixa de anunciar sincronização completa enquanto o GPS tem pendências.

Ficheiros: `frontend/js/offline/offline-gps.js`, `frontend/technician.js`, `tests/legacy-gps-offline.test.js` e este documento. Oito testes cobrem novos pontos durante confirmação, mudança de conta, recusa HTTP/JSON, fila ilegível, dados antigos, falta de espaço, precisão/data e múltiplos watchers. Os testes passam; npm test passou 168 testes em 40 ficheiros, e os quatro testes de técnico passaram.

Limites: não converte automaticamente a antiga fila sem identidade inequívoca; não altera as filas antigas de fotografias e visitas. O GPS não é prova independente de presença física.

## TASK 84 — configurações com comportamento verdadeiro

PWA, proteção offline e aprovação humana das ações IA são capacidades fixas desta versão. A API devolve o valor efetivo e recusa tentativas de desligar essas capacidades; os valores antigos guardados não se sobrepõem ao comportamento efetivo. Um pedido bulk com uma dessas opções é recusado antes de gravar as restantes opções. A interface deixa de mostrar interruptores inoperantes para PWA/offline. Os estados de IA e segurança usam a mesma fonte para indicar aprovação humana obrigatória.

Ficheiros: systemSettingService, settingsRoutes, aiAdminController, securityController, admin-operational-settings.html, test-field-access-api e este documento. Testes de API aprovados em `settings-capabilities.log`: configurações fixas devolvem 409 na alteração e true na leitura; bulk recusado não altera a outra chave. As opções de preparação de mensalidades e lembretes ficam desligadas por defeito. Não se apaga nenhum trabalho offline.

## TASK 85 — preparação mensal e lembretes do portal

O agendador existente passa a preparar mensalidades em rascunho através do Finance OS, apenas quando ativado nas configurações. Não emite documentos fiscais, não envia mensagens externas e não inclui reparações/visitas extra automaticamente. A pré-visualização da Business é apenas leitura. Há controlo de concorrência do agendador, uma fatura por cliente/mês, exclusão de clientes em pausa/inativos e auditoria da preparação. A criação de rascunho e o cálculo passam a usar a mesma transação, compatível com uma única ligação à base de dados.

Foi corrigido um erro do fluxo de rascunhos: o cálculo convertia DRAFT em PENDING. Agora o rascunho conserva DRAFT até emissão explícita. O método usado manualmente continua disponível.

Os lembretes consideram vencimento há pelo menos sete dias, saldo em aberto e contrato ativo. A deduplicação persistente por fatura/semana impede repetições concorrentes. Novos avisos param com pagamento ou pausa. A mensagem indica a data e o saldo observado; é um aviso no portal, não prova de envio por email/WhatsApp. Foi retirado o fallback antigo que podia criar avisos sem deduplicação após erro.

Ficheiros: MonthlyAutomationBusiness, FinanceOsBusiness, autoBillingService, paymentService, test-field-billing-automation, test-field-suite e este documento. A bateria passa a 21 grupos. Testes locais da automação e Finance OS passaram em `run-1789449099885`; incluem desativação, pré-visualização sem escrita, cliente em pausa, duas execuções simultâneas, repetição mensal, limite de sete dias, repetição semanal e paragem após pagamento. Não houve migração ou envio externo.

Continuam por completar: orçamento comercial detalhado, contratos/preços sazonais, revisão linguística integral, retenção e monitorização externa de backups. Esta entrega não declara concluídos esses itens.

## TASK 86 — base de orçamentos comerciais versionados

Modelo privado RepairQuote, migração aditiva e cálculo de materiais, mão de obra, margem sobre venda, desconto antes do IVA e validade. Taxa de IVA obrigatória e escolhida pelo administrador. Preços arredondados por unidade e linha; margem efetiva calculada após desconto. Valores abaixo do custo exigem confirmação. O bloqueio da reparação e a versão esperada evitam substituir alterações concorrentes. Versões anteriores são conservadas e reparações aprovadas não podem ser reorçamentadas por este método. A ligação à interface e aprovação é a tarefa seguinte.

## TASK 87 — edição e aprovação dos orçamentos

API administrativa para pré-visualizar, guardar e consultar versões. Aprovação exige o ID da versão atual e referência da autorização recebida do cliente; orçamento expirado é recusado. O editor antigo não pode substituir uma versão detalhada. PDF comercial exclusivo da administração; respostas das reparações para técnicos deixam de incluir preços, pagamentos, contactos ou relações completas do cliente. Estes controlos não constituem uma auditoria integral de autorização por piscina. A aprovação regista uma autorização recebida, não envia mensagens.

## TASK 88 — editor administrativo integrado

O editor está dentro de Alertas/Reparações, sem novo módulo de navegação. Permite escolher reparação, adicionar/remover linhas, calcular, guardar versões, gerar PDF com valores de venda e registar aprovação com referência. Mostra custo e resultado internos, e avisa sobre alterações por guardar. IVA é introduzido explicitamente. O PDF não contém notas internas, custos ou margens. O total sem IVA fica disponível no fluxo existente de faturação; esta tarefa não certifica a emissão fiscal nem acrescenta envio externo automático.

## TASK 89 — validação do fluxo comercial

A revisão encontrou um desvio no fluxo antigo: permitia agendar QUOTED antes da aprovação. Para orçamentos detalhados essa passagem é agora recusada, com bloqueio da reparação durante a decisão. Eliminar uma reparação com versões guardadas devolve conflito e orienta para cancelamento, preservando o histórico. O teste API verifica também a geração real de PDF. O editor foi verificado em larguras 320, 390 e 1280 px.

## TASK 90 — orçamento e faturação mensal

As consultas dos dois geradores mensais antigos também incluíam QUOTED. Orçamentos detalhados por aprovar ficam agora excluídos, mantendo as regras antigas para registos sem versões. O teste de API verifica mensalidade de 80 antes da aprovação e 310 após incluir uma reparação de 230. Guardar um orçamento mantém a quantidade operacional original da reparação, em vez de a substituir por 1.

## TASK 91 — apresentação portátil do PDF

A inspeção visual encontrou espaçamento irregular na substituição de Helvetica pelo leitor de PDF. O documento passa a incorporar DejaVu Sans, distribuída com a respetiva licença, sem depender das fontes do servidor ou do dispositivo do cliente. A verificação compara a extração do texto e a renderização do PDF.

## TASK 92 — preços mensais por período

Planos privados e versionados por cliente. O valor base e cada período representam o total mensal do contrato, incluindo todas as piscinas, sem IVA; não se somam novamente às mensalidades das piscinas. Datas finais inclusivas, períodos adjacentes permitidos, sobreposições recusadas, data final vazia significa permanente. Alteração a meio do mês é proporcional aos dias de calendário, com arredondamento final ao cêntimo. Zero é permitido, para um período gratuito. Planos antigos ficam preservados e uma versão esperada protege contra alterações concorrentes. Não se repetem automaticamente períodos em anos seguintes.
