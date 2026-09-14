# Cristal Water — revisão funcional da release

Revisão: 14/09/2026. Esta matriz acompanha as alterações propostas na PR #4. Estados antigos de “100%” nos documentos de refatoração não certificam toda a operação da versão atual. QA significa ambiente isolado; não significa instalação no VPS.

| Necessidade | Código / percurso existente | Evidência atual e limite |
|---|---|---|
| Admin, técnico e cliente com dados separados | Guardas de autenticação, JWT e autorização de recursos | API de acesso e três perfis em Chromium aprovados |
| Fichas de clientes e piscinas, agenda e histórico | Client/Pool/Route business; portal cliente | Grupos cliente, visitas, rotas e interligações aprovados; dados reais por importar/confirmar |
| Ronda diária, check-in e jornada | TechnicianRoute/Workday, modo campo | API, componentes e percurso móvel aprovados |
| Leituras, tarefas e produtos | Registo de visita e stock transacional | Vazio/zero/vírgula, checklist explícita, concorrência e correção aprovados |
| Fotografias do técnico | IndexedDB, upload, deduplicação | Sem rede, recarga, alternativa à câmara, falha de espaço e envio aprovados |
| Água aberta | OperationalReminder, scheduler, histórico e Web Push | Persistência, autorização, escalada e fecho aprovados em QA |
| Bomba em manual | Novo percurso pump-reminders usando OperationalReminder | Prazo, responsável, histórico, escalada, offline/recarga e automático aprovado em QA |
| Falha de rede, sessão e mudança de conta | Outbox, guardas de identidade e rascunhos | Expiração, 401 atrasado, troca de conta, 403, 429 e fila danificada aprovados |
| Viaturas, guias, seguro e inspeção | Guias/stock e bloqueios de documentação | Validação de acesso e operação aprovada; AT/seguradoras não contactadas |
| Chaves e informação de acesso | keyRoutes e cartão de acesso | Código existente e apresentação no campo; inventário físico por conferir |
| Cliente: mensagens, pedidos e anexos | Portal e endpoints autenticados | Anexo persistido, texto conservado, duplo toque e recuperação parcial aprovados |
| Cliente: agenda, serviços, documentos e conta | Portal e business Customer | Grupos API aprovados; falha de documentos não apaga os restantes blocos |
| Gestão: prioridades, visitas e equipa | Centro de comando e AdministrationBusiness | Estado parcial da equipa e recuperação aprovados; contraste revisto |
| Reparações, equipamento e stock | RepairBusiness e EquipmentStockOsBusiness | Grupos operacionais e interligações aprovados |
| Finanças e avisos de pagamento | FinanceOsBusiness, paymentService e portal | Registos internos aprovados; avisar pagamento não é comprovar recebimento bancário |
| Cobrança/MBWay/referência/PayPal/Revolut | Métodos e instruções na aplicação | Não certificam contratos nem processamento com prestadores; integração real fora desta evidência |
| Cálculos de piscina | poolCalculationService e calculadora admin | Exemplo 75 m³ e cálculo de sal aprovados; restante ensaio confirma resultados presentes, não todas as condições físicas |
| IA e sugestões | Orquestradores e adaptador de fornecedor | Leitura de resposta, incompleto/recusa/vazio e demonstração testados com fixtures; sem fornecedor real nesta validação |
| Idiomas e apresentação | Portal PT/EN/FR e folhas de estilo existentes | Seletor e PT verificados; não houve revisão linguística integral de todas as páginas |
| Backup e migrações | Scripts QA PostgreSQL e runbook | Restauro, ficheiros e migrações testados em CI; não substituem backup/validação do VPS |
| Retenção e dados históricos | Requisitos anteriores de 1/10 anos | Não foi ativada eliminação automática nem certificado o cumprimento de uma política legal de retenção |
| Vídeos e análise avançada | Direção futura documentada | Não incluídos como funcionalidade concluída nesta release; não confundir anexo genérico com fluxo completo de vídeo/IA |

## O que foi acrescentado nesta revisão

TASK 28: anexos e falhas parciais do portal cliente. TASK 29: layout do cliente e atualização parcial da gestão. TASK 30: resposta real da API de IA e demonstração explícita. TASK 31: lembrete persistente e offline da bomba em manual. O detalhe dos testes e limites está em FIELD_READINESS_20260914.md.

## Aceitação que depende de meios externos

- VPS: versão instalada, HTTPS, configuração, histórico de migrações, base real, uploads e restauro do seu backup.
- Telefone físico: permissões, bateria, aplicação encerrada, notificações com ecrã bloqueado e uso prolongado sob condições de campo.
- Prestadores: credenciais, contratos e ensaios de pagamentos/fiscalidade/mensagens/IA real.
- Empresa: conferir os dados reais e aceitar os percursos com técnicos, gestão e clientes.

Não existe evidência para declarar “todas as situações possíveis” ou certificação global de toda a especificação histórica. Esta matriz evita confundir código existente, teste automatizado, integração externa e aceitação em campo.
