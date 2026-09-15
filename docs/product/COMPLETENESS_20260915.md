# Cristal Water — requisitos, código e trabalho por concluir

Entregas posteriores a esta auditoria: consultar [implementação e testes das TASKs 83–85](IMPLEMENTATION_20260915.md). GPS legado, configurações fixas e preparação de mensalidades/lembretes já receberam as alterações aí descritas; as linhas abaixo conservam o diagnóstico que lhes deu origem.

Revisão de 15/09/2026, sobre a branch `work/field-readiness-20260915-simulation`.

## Conclusão

A operação principal tem implementação e testes, mas a especificação alargada não está toda concluída. Há funcionalidades parciais, opções sem efeito operacional, automações por implementar e evoluções ainda em backlog. É possível trabalhar nesses pontos sem instalar no servidor.

Esta revisão compara os requisitos visíveis da conversa, PROJECT_MANIFEST.md, PROJECT_VISION.md, ROADMAP.md, EPICS.md, IDEAS_BACKLOG.md e os backlogs de produto com os percursos de código indicados abaixo. A existência de um ficheiro, de um campo na base de dados ou de um teste genérico não significa funcionalidade completa. “Existente/testado” significa apenas o escopo descrito, não aprovação universal.

Os documentos antigos contradizem-se: o ROADMAP marca Finance/Stock/Customer como não iniciados, apesar de existirem Business, interfaces e testes; o backlog ativo ainda lista propostas técnicas como por fazer, apesar das rotas e validações presentes. Esta matriz prevalece como fotografia desta revisão, sem apagar o registo histórico. As instruções atuais do proprietário autorizam identificar e completar lacunas; não se usa o antigo freeze para deixar de fazer a revisão.

## Técnico e operação

| Requisito | Estado verificado | Evidência e limite / próximo trabalho |
|---|---|---|
| Login e separação de perfis | Existente/testado | Guardas JWT, principal e acesso por recurso; `scripts/test-field-access-api.js`. Não equivale a auditoria exaustiva de todas as rotas. |
| Rota do dia, acesso à piscina e jornada | Existente/testado | `frontend/technician-field-mode.js`, Technician Business e testes de jornada. |
| Leituras, checklist, produtos e conclusão | Existente/testado | `serviceVisitCompletionService.js`; conclusão transacional e reenvios testados. |
| Fotografias offline e recuperação | Existente/testado | `frontend/cw-field-photos.js`, IndexedDB e testes de navegador; telefone real pendente. |
| Notas fixas, temporárias e informação de acesso | Existente | Modo de campo e ficha de piscina. Revisão de completude visual e expiração de notas ainda deve ser detalhada. |
| Água aberta e bomba manual | Existente/testado | `waterReminderService.js`, `cw-pump-reminders.js`; persistência, prazo, fecho e transferência. Receção física de push pendente. |
| Falta de químicos, visita incompleta e retorno | Existente/testado | `ChemicalDeliveryBusiness.js`, `IncompleteVisitBusiness.js`, preparação de stock e percurso de retorno. |
| Rotas diárias, semanais, mensais e datas inclusivas | Existente/testado | `roundScheduleService.js`, `RoundAssignmentBusiness.js`; calendário de 25 anos e períodos de atribuição. |
| Substituição temporária/permanente de técnico | Existente/testado | Atribuições de ronda, `VisitCoverageBusiness.js`, recibos de transferência; visitas iniciadas preservadas. |
| Mapas e navegação | Existente/testado no escopo | `frontend/technician-map.js`: seleção, próximas visitas, ausência de GPS e mudança de conta. Trânsito e qualidade de rotas reais não comprovados. |
| Histórico GPS depois de uso prolongado | Corrigido/testado | `TechnicianGpsBusiness.getHistoryById`: últimos pontos em ordem cronológica, incluindo histórico acima de 1.000 posições. |
| GPS offline na interface antiga | Parcial; prioridade alta | `frontend/technician.html` carrega `js/offline/offline-gps.js`, chamado por `technician.js`. A fila usa uma chave global; no fim da sincronização substitui a fila pelo snapshot restante, podendo perder entradas acrescentadas entretanto. Não tem a proteção de sessão/concorrência da fila moderna. Reproduzir e consolidar o emissor legado. |
| Sugestões e aprovação de alterações técnicas | Existente | Rotas `technical-change-proposals` no core: motivo obrigatório, risco e revisão. Atualizar backlog antigo; não criar módulo duplicado. |
| Vídeos de visitas/reparações | Não localizado como fluxo completo | Backlog documenta a intenção. Não foi encontrado percurso dedicado de captura, fila, upload, reprodução e limites de vídeo. Anexos/fotos não bastam para o considerar implementado. |

## Gestão, cliente e área comercial

| Requisito | Estado verificado | Evidência e limite / próximo trabalho |
|---|---|---|
| Fichas de clientes/piscinas e portal | Existente/testado | Customer/Pool Business, portal, documentos, histórico, mensagens e testes de acesso. |
| Pedidos de cliente e anexos | Existente/testado | Portal e testes de recuperação parcial; não significa envio por canais externos. |
| Leitura de notificações pelo cliente | Existente/testado | Confirmação persistida, proteção de avisos internos, mensagens de falha e nova tentativa. |
| Equipamentos, reparações e intervenções | Existente/testado | `RepairBusiness.js`, `EquipmentStockOsBusiness.js` e grupos operacionais. |
| Stock, carregamento, consumo e inventário | Existente/testado | Business de stock/inventário, guias e idempotência. Há registos legados e modernos: alterações futuras devem evitar dupla baixa. |
| Chaves, viaturas e guias | Existente no escopo | Rotas/interfaces e ligação à operação. Inventário físico e transmissão fiscal não comprovados. |
| Orçamento instantâneo completo | Parcial; prioridade alta | `RepairBusiness.estimatePricing` usa valores fixos por palavra (base 100, luz 120, bomba 350); `quoteRepair` usa essa estimativa. Não é um orçamento completo com catálogo, custo de compra, mão de obra, margem, versões e aceitação do cliente. Não usar as estimativas como preço comercial validado. |
| Faturas, pagamentos e saldos internos | Existente/testado no escopo | Finance Business e core. `CoreInvoicePaymentBusiness.js` corrige pagamentos simultâneos; outros percursos financeiros ainda exigem revisão individual de reenvios/conflitos. |
| Cobrança automática mensal | Parcial; lacuna confirmada | `src/server.js` chama `autoBillingService.runAutoBilling`; esse serviço apenas lista clientes e escreve ligações WhatsApp no log. Não gera faturas nem envia cobranças. Existem rotas manuais de faturação; falta ligar uma automação efetiva e idempotente. |
| Lembretes de pagamento após sete dias | Não fechado | Há deteção de atraso em Finance OS e `paymentReminderService.js`, mas o serviço antigo não demonstra o fluxo completo agendado por vencimento +7 dias. Confirmar um único agendador, deduplicação, pausa do cliente e histórico de entrega. |
| Preços sazonais e contratos flexíveis | Parcial / backlog | Existem valores mensais e ativação de contrato. Não foi localizado calendário comercial completo de vigência e preços verão/inverno; a estação nos cálculos técnicos não é preço contratual. |
| Margem/rentabilidade real | Parcial | `operationalStateEngine.js` estima mão de obra por número de visitas × 12. Completar custos efetivos e explicitar estimativas antes de apresentar a margem como contabilística. |
| MBWay, referência, Revolut e PayPal | Configuração/integração por verificar | Métodos e instruções não comprovam processamento, reconciliação ou webhooks de prestadores. Preparar conectores e testes de contrato; credenciais/contratos são externos. |
| Relatórios e PDFs | Existente no escopo | Serviços de relatórios, preferências e documentos. Falta revisão visual sistemática de todos os modelos e idiomas; não confundir geração de PDF com emissão fiscal. |

## Configurações e plataforma

| Requisito | Estado verificado | Evidência e limite / próximo trabalho |
|---|---|---|
| Configurações globais protegidas | Falha confirmada; corrigida nesta revisão | `settingsRoutes.js` não exigia sessão em `/global`, `/global/:key` e `/global/bulk`. Acrescentada autenticação e exigência ADMIN. Preferências antigas de som passam a exigir o dono da conta User ou administração. |
| Interruptores PWA e offline | Parcial; prioridade alta | `systemSettingService.js` guarda `MOBILE_PWA_ENABLED`/`OFFLINE_SYNC_ENABLED`; não foram localizados consumidores operacionais desses valores. A interface anuncia controlo que o código não efetua. Definir comportamento seguro ou retirar a promessa; nunca eliminar trabalho pendente ao desligar. |
| Aprovação de ações de IA | Fontes desalinhadas | O default existe em SystemSetting, mas `aiAdminController.js` e `securityController.js` leem o ambiente. Unificar a fonte efetiva e mostrar claramente o modo ativo; manter aprovação humana. |
| IA operacional e aprendizagem | Parcial | O adaptador `ai/aiProvider.js` executa OpenAI ou demonstração; outros nomes mencionados no mock não comprovam conectores. Não foi demonstrado assistente generativo offline completo nem aprendizagem validada por piscina. |
| Idiomas | Parcial | `cw-i18n.js` e `languagePreferenceService.js` suportam PT/EN/FR/DE. Espanhol não está na lista; cobertura integral de textos dinâmicos não foi auditada. |
| Retenção de GPS por um ano e histórico crítico por dez | Não localizado como política executável completa | Não foi encontrado serviço correspondente de retenção. Pode implementar-se configuração, inventário e pré-visualização agora; eliminação real exige política definida e salvaguardas. Não ativar limpeza indiscriminada. |
| Backups e recuperação | Existente/testado em QA; automação por fechar | `databaseBackupService.js`, scripts e restauro CI. Não foi localizado agendamento completo de cópias externas, retenção e alerta de backup falhado no código de arranque/deploy revisto. |
| Layout profissional e rapidez | Parcialmente validado | Há testes móveis e melhorias no campo/portal. Falta inventário de ecrãs e revisão sistemática de carregamento, vazio, erro, permissões, toque e traduções. Não declarar todas as páginas revistas. |
| Servidor e fornecedores | Externo | HTTPS, processos, credenciais, entrega de mensagens, emissão fiscal e ensaios físicos continuam separados da implementação. |

## Trabalho que pode avançar já, por ordem

1. Fechar a proteção das configurações e confirmar os percursos existentes de idioma e preferências.
2. Consolidar o GPS offline legado e reproduzir perda de rede, novos pontos durante sincronização e troca de conta.
3. Corrigir os controlos de configuração sem efeito e identificar a fonte real de cada opção.
4. Implementar cobrança/lembretes agendados com pré-visualização, deduplicação e ensaios isolados, reutilizando Finance OS. Nenhuma mensagem externa sem autorização.
5. Completar o orçamento dentro das reparações existentes: materiais, mão de obra, custos, margem, revisão, aprovação e conversão.
6. Completar preços sazonais, idiomas, retenção em modo de pré-visualização e monitorização de backups.
7. Rever os ecrãs restantes por perfil e só depois expandir vídeo/IA avançada conforme o backlog.

Cada ponto precisa de critérios de aceitação próprios. A ordem não significa que os restantes pontos tenham sido implementados nesta revisão.

## Evidência e correção imediata — TASK 82

A leitura de `/api/settings/global` sem sessão respondeu 200 no ensaio anterior à correção (`run-1789448028666`), quando devia recusar o pedido. O teste acrescentado exige 401 sem sessão, 403 para técnico/cliente nos endpoints globais, ausência de alterações após recusas, gravação/leitura administrativa, isolamento das preferências User e conservação do idioma do cliente autenticado.

Alterações funcionais desta tarefa: `src/routes/settingsRoutes.js` e `scripts/test-field-access-api.js`. Este documento e o apontador na revisão funcional completam o inventário. As restantes lacunas acima são trabalho por fazer, não entregas deste commit.

A validação anterior do código de base está em https://github.com/ts7520305-svg/cristalwater/actions/runs/34929790206 (160 testes unitários, 20 cenários de navegador, 20 grupos integrados e restauro de 94 tabelas/11 ficheiros). Não é usada como prova automática desta nova correção.
