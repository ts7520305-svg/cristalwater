# Plano de conclusão — Cristal Water

Data: 28/09/2026. Preparado na TASK402 a partir da revisão global, do checkpoint TASK401 e dos caminhos de código abaixo. Âmbito: as sete frentes confirmadas pelo utilizador nesta conversa.

## Contagem e regra de fecho

**32 tarefas de conclusão identificadas: C01–C32.** Estado após TASK407 local: **28 por iniciar, uma em execução (C04), três em validação (C01, C02 e C03) e zero fechadas**. C01–C03 têm CI/restauro aprovados, faltando ler as provas específicas nos artefactos. C04 tem seis cenários: catálogo de armazém, catálogos de campo e agendas/rondas aprovados localmente, com CI pendente; três por executar. Os seis cenários não acrescentam IDs à contagem principal. Estes IDs mantêm-se estáveis; a coluna TASK identifica o lote de execução correspondente. A numeração TASK anterior não representa percentagem de conclusão.

Uma tarefa pode ter preparação, implementação local e validação externa em momentos diferentes. Só passa a **Concluída** quando cumpre o critério e tem evidência ligada. **Implementada / CI pendente** não equivale a validação nativa nem a instalação no VPS. Cada lote de código mantém uma responsabilidade, até dez ficheiros, teste da falha/resultado e documentação.

Este é o plano base do âmbito conhecido, não uma garantia de ausência de novas falhas. Uma falha nova precisa de reprodução, impacto e critério de saída antes de acrescentar uma linha e atualizar a contagem. Se um lote exigir subdivisão, os filhos ficam ligados ao mesmo item de conclusão e são visíveis no histórico; não se substitui uma pendência por uma declaração genérica de «100%».

## 1. Validação já em curso — uma tarefa

| ID | Tarefa / TASK | Critério de conclusão | Dependência / estado |
|---|---|---|---|
| C01 | Confirmar TASK401 no PostgreSQL nativo | Commit `e1b6767459226cb4b469a49f375c9deeb89f741e`: escritor confirma com a transação de leitura aberta (`committedBeforeRemaining: true`), oito fontes antigas coerentes, nova leitura completa, 308 scripts na ordem exata e restauro de base/uploads com linhas/hashes iguais. | **CI/restauro aprovados; prova específica por ler.** 17 etapas, 308 scripts na ordem exata, 128 tabelas/47 ficheiros iguais. Artefacto `10976260376` excedeu o limite de transferência (32 MiB); URL respondeu 403. C01 não fecha sem ler o snapshot. [Evidência TASK404](evidence/20260928_task404_local.json). |

## 2. Consistência e desempenho — três tarefas

| ID | Tarefa / TASK | Critério de conclusão | Dependência / estado |
|---|---|---|---|
| C02 | Snapshot comum de `/api/dashboard/metrics` — TASK403 | Visitas, alertas e soma financeira observam o mesmo estado; escrita concorrente reproduz a falha anterior. Erro, cache, invalidação, TTL, circuit breaker, GET/POST e perfis conservados. | **CI/restauro aprovados; prova específica por ler.** [CI 36432110804](https://github.com/ts7520305-svg/cristalwater/actions/runs/36432110804), 17 etapas, 308 scripts na ordem exata e restauro de 128 tabelas/47 ficheiros iguais. Exigir o JSON concorrente no artefacto `10976776089`. [Evidência TASK404](evidence/20260928_task404_local.json). |
| C03 | Medir e limitar leituras de dashboards, alertas e riscos — TASK404 | Ensaios crescentes publicam linhas, bytes, duração e memória; totais completos ou indisponibilidade explícita; nenhuma truncagem silenciosa. Registar a dimensão máxima testada e corrigir só os limites reproduzidos. | **CI/restauro aprovados; prova específica por ler.** [CI 36438347610](https://github.com/ts7520305-svg/cristalwater/actions/runs/36438347610): 17 etapas, 309 scripts na ordem exata, 128 tabelas/47 ficheiros iguais. Exigir ainda o JSON de volume no artefacto `10980061941`. Quatro APIs, 25/100/400 clientes e 64 816 linhas no maior perfil. [Medições e limites](SUMMARY_VOLUME_20260928.md), [prova CI](evidence/20260928_task405_local.json). Volume real por confirmar. |
| C04 | Validar volume de agendas, catálogos, guias e relatórios | Manifesto de cenários por superfície, navegação sem perda/duplicação, anexos/PDFs grandes e limites explícitos. Aceitação de cada cenário, incluindo tempo e memória, fica ligada à versão testada. | **Em execução — TASK405/C04-A, TASK406/C04-B e TASK407/C04-C.** [Seis cenários e medições](OPERATIONAL_VOLUME_PLAN_20260928.md): armazém até 10 000, quatro catálogos de campo até 10 001 e agendas/rondas até 400 piscinas/16 técnicos/53 624 visitas. Navegação de 1 600 linhas diárias e 825 visitas do técnico, IDs/totais/limites coerentes. Local aprovado, CI pendente; três cenários por executar. Próximo: guias/movimentos C04-D. Dimensão real depende de amostra. |

## 3. Idiomas — cinco tarefas

| ID | Tarefa / TASK | Critério de conclusão | Dependência / estado |
|---|---|---|---|
| C05 | Fechar o inventário de textos por página/perfil | Manifesto das entradas efetivamente usadas: chaves, idioma, estados dinâmicos, mensagens do servidor e PDF; cada lacuna fica atribuída a C06–C09 e a um lote limitado, sem considerar referências em testes como tradução concluída. | Local. Partir do inventário TASK386 e `cw-i18n.js`; PT/EN/FR/ES/DE já existentes. |
| C06 | Idiomas do técnico e fila de sincronização | Página técnica antiga e fila geral cobrem estados de envio, conflito, offline e recuperação nos idiomas existentes; trocar idioma não altera UUID, recibos, valores ou rascunhos. | C05; preservar o diálogo extra já aprovado. |
| C07 | Idiomas dos três dashboards e incidentes | Rótulos, filtros e estados de `/dashboard`, `/admin-dashboard`, `/operational-dashboard` e centro de incidentes localizados; texto de clientes e evidência original continuam literais; pequenos ecrãs aprovados. | C05; executar por página quando necessário para respeitar o limite do lote. |
| C08 | Idiomas dos restantes percursos administrativos | Todas as lacunas atribuídas pelo manifesto de C05 em clientes, equipamento, CRM, orçamentos, stock, guias e obras têm um lote/evidência; não há linha por resolver nesse conjunto. | C05; lista fechada de páginas antes de editar, até dez ficheiros por lote. |
| C09 | Idiomas do cliente, relatórios e PDFs | Portal, pedidos, histórico, documentos e modelos PDF do manifesto passam nos idiomas aplicáveis, sem datas/valores traduzidos como texto livre, cortes ou troca de titular. | C05; fixtures de cada modelo e perfil. |

## 4. Interfaces e significado dos dados — cinco tarefas

| ID | Tarefa / TASK | Critério de conclusão | Dependência / estado |
|---|---|---|---|
| C10 | Definir e aplicar a política de dia/mês | Matriz de `plannedDate`, `date`, início/fim, regulares/extra e fuso; decisão explícita para divergências. Testes de Lisboa, meia-noite e mudança da hora; dados históricos preservados. | Preparação local; decisão de negócio antes de mudar significados. `serviceVisitFilters`, planeamento sazonal e dashboards. |
| C11 | Apurar crédito agregado com fonte verificável | O resumo distingue crédito confirmado, desconhecido e divergente; reconcilia o total com as fontes existentes e não duplica notas/pagamentos. Zero só com leitura completa; perfis e falhas testados. | C16 fornece validação histórica; implementação local usa fixtures. `clientCreditService`, `BillingCreditBusiness`, `creditRevenueData`. |
| C12 | Paginar o centro de incidentes | Todos os incidentes elegíveis alcançáveis, ordem/IDs estáveis e totais exatos; seleção e resolução não se perdem ao paginar/atualizar. Erro não apaga a existência da pendência nem confirma uma ação. | Local. `incidentService`, `incident-center.js`. |
| C13 | Validar instalações e obras de ponta a ponta | Percurso real de interface: plano, equipa, material, fotos, assinatura, marcos comerciais e custos; perfis, repetição e falhas preservam uma execução e o histórico. | Local primeiro; aceitação física em C31. `InstallationBusiness`, `ConstructionBusiness`. |
| C14 | Fechar lacunas de interface e acesso do inventário | Manifesto C05 complementado com perfil, teclado, 320/390/1440, claro/escuro, vazio/erro/offline, sessão, ligações e correspondência entre rótulos/totais e fontes (incluindo estados legados das métricas); cada falha tem reprodução e correção limitada. Sem teste aplicável não há aceitação marcada. | Local; dispositivos reais em C30/C31. Não reabrir páginas já aprovadas sem risco concreto. |

## 5. Dados e finanças reais — quatro tarefas

| ID | Tarefa / TASK | Critério de conclusão | Dependência / estado |
|---|---|---|---|
| C15 | Conferir identidade e origem do histórico | Clientes, piscinas, visitas, documentos e anexos sem origem inequívoca ficam numa lista de revisão; cada associação aplicada tem confirmação e auditoria. Nenhuma titularidade é inventada. | Exportação/acesso autorizado aos dados reais; preparação local possível. |
| C16 | Conciliar dívidas, pagamentos e créditos | Por cliente/documento: valores originais, pagamentos, crédito, ajustes e saldo reconciliam ou mostram divergência; duplicados não geram cobrança; revisão explícita antes de alterar dados. | C15 e documentos/extratos reais. Reutilizar percursos financeiros existentes. |
| C17 | Conferir custos e receitas atribuíveis | Materiais, mão de obra, despesas, descontos e receitas de manutenção/reparação/obra têm origem e repartição; margens incompletas continuam identificadas. | C15/C16 e documentos reais; `financialCostCoverageService`, `financialRevenueCoverageService`. |
| C18 | Conferir contratos operacionais de cada cliente | Frequências e valores sazonais, pausas, exceções, periodicidades/preços de equipamento e orçamentos aprovados coincidem com calendário e documentos internos. Casos anuais reais registados. | Acordos reais e C15/C16. Não inclui o contrato jurídico adiado. |

## 6. Importação WhatsApp e IA local — seis tarefas

| ID | Tarefa / TASK | Critério de conclusão | Dependência / estado |
|---|---|---|---|
| C19 | Ler exportações WhatsApp ZIP/TXT | Preservar original e hash; reconhecer remetente, data, mensagens multilinha e referências de anexos; ficheiros inválidos/grandes e ambiguidades recusados ou assinalados. Sem criar fichas/dívidas ao importar. | Local, com fixtures iPhone/Android e amostra autorizada. O envio/link WhatsApp existente não faz esta importação. |
| C20 | Rever correspondências e duplicados do WhatsApp | Pré-visualização permite associar remetentes/clientes, comparar duplicados e ver a mensagem de origem de cada proposta. Datas/valores incertos exigem revisão. | C19; reutilizar clientes e chats existentes. |
| C21 | Aplicar propostas WhatsApp confirmadas | Só propostas escolhidas e confirmadas criam registos; repetição/resposta perdida não duplica cliente, mensagem ou movimento; auditoria liga ao original. Pagamentos/dívidas não são inferidos como factos. | C20 e autorização concreta na revisão; testes locais de concorrência e reversão de falhas. |
| C22 | Validar serviço de IA local | Provider tem disponibilidade real, modelo identificado, limites/timeout e falhas explícitas; opera no equipamento alvo com acesso autenticado e sem dependência externa indevida. | Código local preparável; instalação/medição requer equipamento/acesso. `OllamaProvider`. |
| C23 | Persistir memória por piscina com isolamento | Memória sobrevive ao reinício, conserva origem/data/confiança e separa clientes/perfis; correção/remoção e indisponibilidade testadas. | C22; substituir apenas as partes em RAM comprovadas em `BrainMemory` e motor de memória. |
| C24 | Aceitar recomendações e ações assistidas | Cenários de química, equipamento, fuga/água, fotos e histórico distinguem evidência, hipótese e limites; ação só após confirmação, com permissões/recibo. Documentar capacidades reais online/offline e de multimédia. | C22/C23 e amostras aprovadas; não declarar aprendizagem ou análise de vídeo sem ensaio efetivo. |

## 7. Operação e aceitação — oito tarefas

| ID | Tarefa / TASK | Critério de conclusão | Dependência / estado |
|---|---|---|---|
| C25 | Preparar e instalar a versão no VPS | Commit aprovado identificado, cópia prévia, plano de reversão, migrações adequadas, HTTPS/supervisão e health checks; versão instalada comprovada. | Preparar localmente; requer acesso e autorização de publicação em produção. A autorização atual cobre a branch de trabalho. |
| C26 | Validar email, WhatsApp e push reais | Destinatários/canais confirmados; entrega, falha, repetição e app fechada testadas; recibos não confundem fila com entrega. | C25, credenciais e autorização de envio aos destinatários de teste. |
| C27 | Validar pagamentos e documentos externos | Fornecedores escolhidos/configurados; retorno autenticado, repetição, montante e cliente conferidos; número/checklist de fatura externa preservados. Guias/AT conforme o percurso efetivamente contratado. | C16/C25 e fornecedores/acessos; sem emissão fiscal pela app. |
| C28 | Preparar cópia conjunta e externa | Base e uploads têm manifesto verificável, retenção e destino externo; falha parcial não anuncia sucesso. Credenciais e ficheiros protegidos. | Código local preparável; destino/acesso externo para comprovar a cópia. `scheduledBackupService` atual cobre só base local. |
| C29 | Restaurar operacionalmente e verificar alarmes | Recuperar base/uploads num ambiente separado, comparar linhas/hashes e abrir anexos; medir recuperação; alarmes de falta/falha de cópia chegam ao destino confirmado. | C28, ambiente e destinatários de teste autorizados. CI não substitui este restauro operacional. |
| C30 | Piloto técnico nos dispositivos da equipa | Cinco a sete dias: rota/substituições, GPS/tempos, check-in, fotos, várias horas offline, suspensão/reinício, bateria e permissões. Registo de incidentes e zero P0/P1 por fechar. | C25/C26, Android/iPhone e participação da equipa. |
| C31 | Piloto administrativo e portal cliente | Casos reais de clientes, cobranças, orçamentos, equipamentos e obra; portal sem acesso indevido, documentos certos e pedidos/notificações conferidos; divergências registadas. | C13/C15–C18/C25–C27 e participantes autorizados. |
| C32 | Decidir a aceitação da versão | C01–C31 com estado/evidência; CI da versão final completo, P0/P1 zero, restauro e pilotos aprovados; pendências adiadas explicitamente; decisão de entrada em operação registada. | Todas as anteriores; aprovação final de negócio. Sem percentagem fictícia. |

## Fora deste plano

O contrato anual com assinatura no portal e aviso de não renovação por email 30 dias antes do termo mantém-se adiado por indicação do utilizador. Requisitos em `MAINTENANCE_CONTRACT_SIGNATURE_20260928.md`. Ideias opcionais do `FUTURE_BACKLOG_FROZEN.md` não entram por iniciativa automática.

As indicações de sprint/validação de julho são históricas. O utilizador pediu posteriormente a conclusão dos módulos, WhatsApp, idiomas e IA; esta lista explicita esse âmbito sem reabrir funcionalidades opcionais. Nenhuma mudança de regra financeira/temporal ou operação externa fica autorizada apenas por constar da tabela.

## Histórico de execução

- TASK402: inventário convertido neste plano de 32 tarefas. Base `11cf22efb50d61630599d599c49202990c64c257`. Três documentos previstos; código de produção inalterado. Gates de base registados no checkpoint.
- TASK403 / C02: cinco testes unitários novos falharam na versão anterior; SQL reproduziu visitas antigas com mais um alerta e 17,25 €. As três fontes partilham agora uma transação. Validação local aprovada; CI nativo/restauro pendentes. O próximo item local é C03, medir volume sem truncagem silenciosa. C01 continua dependente do CI da TASK401.

- Publicação TASK403: commit `a63b6a8b70ec07680587bf0d656b4b73cec8c359`, árvore `3b152c4d65659b8c02f337f3b41e961d8c082480` igual à testada; CI `36432110804`, job `108960622472`, em execução. C01 e C02 continuam em validação.

- TASK405 / C04-A: manifesto C04-A–F fechado; primeiro cenário aprovado localmente, incluindo 10 000 produtos sem truncagem, páginas SQL ≤500, falha tardia explícita e interface real. 1 305 unitários/134 ficheiros, quatro técnicos e três grupos locais. Runner passa a 310; o workflow acrescenta um artefacto JSON pequeno para permitir ler as provas específicas C01–C04. TASK404 CI/restauro confirmado, mas C03 não fecha sem ler o JSON. Próximo cenário: C04-B, catálogos de campo. Contagem principal mantém 32.
- Publicação TASK405: commit `77e424dd8305534fb63a4d251dba29e9a00b3f0e`, árvore `534fc2a5893a07ebabec6b857f0edea5706ab9c8`, CI `36460017985`, job `109055958055`, em execução. C04 permanece em execução e C04-A aguarda os gates nativos; 310 grupos/restauro ainda não confirmados.
- TASK406 / C04-B: reproduzida quota esgotada no catálogo offline antigo a 10 001 itens; retirada cópia redundante da guia na atribuição da viatura, com identidade/stock completos e formato anterior legível. Quinze probes (API e quatro percursos × três escalas), três grupos de regressão, 1 311 unitários e quatro técnicos aprovados localmente. Runner 311 e cache v207. Próximo: C04-C; total principal continua 32, com dois dos seis cenários C04 aprovados apenas localmente.
- Publicação TASK406: commit `6b35739d193f3d15c5c378bbbcb93153402ed3d3`, árvore `5f24f58520e0cfac852196732fbed441918c9091`; CI `36463317792`, job `109067069909`, em execução. Exigir 311 grupos/restauro e os JSONs específicos antes da aceitação nativa. TASK405 também permanece em execução na última consulta.
