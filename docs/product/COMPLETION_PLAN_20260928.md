# Plano de conclusão — Cristal Water

Data: 28/09/2026. Preparado na TASK402 a partir da revisão global, do checkpoint TASK401 e dos caminhos de código abaixo. Âmbito: as sete frentes confirmadas pelo utilizador nesta conversa.

## Contagem e regra de fecho

**32 tarefas de conclusão identificadas: C01–C32.** Estado após TASK431 publicada / CI pendente: **26 por iniciar, uma em execução (C06), cinco concluídas (C01–C05)**. CI429:325/326, rascunho comparado antes da última gravação; restauro ignorado. TASK431 reproduz a escrita pendente e exige seis campos/estado guardado antes da comparação integral. Três integrações aprovadas; aplicação/cache217/runner326 inalterados. CI430 em execução;431 exige326 grupos/restauro próprios. [Prova431](evidence/20260929_task431_local.json).

Uma tarefa pode ter preparação, implementação local e validação externa em momentos diferentes. Só passa a **Concluída** quando cumpre o critério e tem evidência ligada. **Implementada / CI pendente** não equivale a validação nativa nem a instalação no VPS. Cada lote de código mantém uma responsabilidade, até dez ficheiros, teste da falha/resultado e documentação.

Este é o plano base do âmbito conhecido, não uma garantia de ausência de novas falhas. Uma falha nova precisa de reprodução, impacto e critério de saída antes de acrescentar uma linha e atualizar a contagem. Se um lote exigir subdivisão, os filhos ficam ligados ao mesmo item de conclusão e são visíveis no histórico; não se substitui uma pendência por uma declaração genérica de «100%».

## 1. Validação já em curso — uma tarefa

| ID | Tarefa / TASK | Critério de conclusão | Dependência / estado |
|---|---|---|---|
| C01 | Confirmar TASK401 no PostgreSQL nativo | Preservar a prova histórica do commit `e1b6767...` e revalidar a versão atual: escritor confirma com leitura aberta, oito fontes antigas coerentes, nova leitura completa, runner/restauro exatos. | **Concluída na versão revalidada TASK406.** JSONs lidos dos CI TASK405/TASK406: `committedBeforeRemaining: true`, deltas antigos zero e novos completos. Teste idêntico ao original; 311 grupos/restauro 128 tabelas/47 ficheiros aprovados. Não se afirma leitura do artefacto antigo. [Prova TASK408](evidence/20260928_task408_local.json). |

## 2. Consistência e desempenho — três tarefas

| ID | Tarefa / TASK | Critério de conclusão | Dependência / estado |
|---|---|---|---|
| C02 | Snapshot comum de `/api/dashboard/metrics` — TASK403 | Visitas, alertas e soma financeira observam o mesmo estado; escrita concorrente reproduz a falha anterior. Erro, cache, invalidação, TTL, circuit breaker, GET/POST e perfis conservados. | **Concluída na revalidação TASK406.** JSON lido: snapshot comum com escrita concorrente confirmada, deltas 0/0/0 e depois 1/1/17,25; três falhas, cache/invalidação/métodos/perfis aprovados. Teste idêntico ao original; 311 grupos/restauro completos. [Prova TASK408](evidence/20260928_task408_local.json). |
| C03 | Medir e limitar leituras de dashboards, alertas e riscos — TASK404 | Ensaios crescentes publicam linhas, bytes, duração e memória; totais completos ou indisponibilidade explícita; nenhuma truncagem silenciosa. Registar a dimensão máxima testada e corrigir só os limites reproduzidos. | **Concluída na versão TASK411.** Doze perfis+três falhas/limpeza, snapshot concorrente verdadeiro, 535,27 MiB no dashboard400; 315 grupos exatos/restauro128 tabelas47ficheiros. Artefacto específico lido. Falha histórica e correção TASK409 preservadas. [Prova TASK413](evidence/20260928_task413_local.json). |
| C04 | Validar volume de agendas, catálogos, guias e relatórios | Manifesto de cenários por superfície, navegação sem perda/duplicação, anexos/PDFs grandes e limites explícitos. Aceitação de cada cenário, incluindo tempo e memória, fica ligada à versão testada. | **Concluída nas versões do manifesto.** A–E/PDFs já aceites; no CI414 os317 grupos passaram na ordem exata, com restauro128 tabelas/47ficheiros. Artefacto específico lido: oito uploads/106HTTP, nove probes/limpeza e oito casos de projeção25/64MiB/24fotos. Limites e pendências C13/C14 mantidos. [Manifesto](OPERATIONAL_VOLUME_PLAN_20260928.md), [prova TASK418](evidence/20260929_task418_local.json). |

## 3. Idiomas — cinco tarefas

| ID | Tarefa / TASK | Critério de conclusão | Dependência / estado |
|---|---|---|---|
| C05 | Fechar o inventário de textos por página/perfil | Manifesto das entradas efetivamente usadas: chaves, idioma, estados dinâmicos, mensagens do servidor e PDF; cada lacuna fica atribuída a C06–C09 e a um lote limitado, sem considerar referências em testes como tradução concluída. | **Inventário concluído TASK415.** 126 páginas, 1 129 fontes, 16 322 candidatos e 2 929 linhas de dicionário/formatação; todos atribuídos C06–C09 e lotes ≤4 fontes/≤10 ficheiros alterados. Candidatos não equivalem a erros. [Mapa e limites](LANGUAGE_INVENTORY_20260928.md). |
| C06 | Idiomas do técnico e fila de sincronização | Página técnica antiga e fila geral cobrem estados de envio, conflito, offline e recuperação nos idiomas existentes; trocar idioma não altera UUID, recibos, valores ou rascunhos. | **Em execução.** Fontes416–428 traduzidas por lote; CI428 aceito326/restauro128/47. CI429:325/326, fotografia prematura do rascunho no teste de idiomas antigo. TASK431 aguarda seis campos guardados, com regressão de escrita retida e três integrações aprovadas; comparação integral e aplicação conservadas. CI430/431 próprios pendentes. Próximo432: gates e restantes fontes C06; chrome é C08-025/026. [Prova431](evidence/20260929_task431_local.json). |
| C07 | Idiomas dos três dashboards e incidentes | Rótulos, filtros e estados de `/dashboard`, `/admin-dashboard`, `/operational-dashboard` e centro de incidentes localizados; texto de clientes e evidência original continuam literais; pequenos ecrãs aprovados. | C05; executar por página quando necessário para respeitar o limite do lote. |
| C08 | Idiomas dos restantes percursos administrativos | Todas as lacunas atribuídas pelo manifesto de C05 em clientes, equipamento, CRM, orçamentos, stock, guias e obras têm um lote/evidência; não há linha por resolver nesse conjunto. | C05; lista fechada de páginas antes de editar, até dez ficheiros por lote. |
| C09 | Idiomas do cliente, relatórios e PDFs | Portal, pedidos, histórico, documentos e modelos PDF do manifesto passam nos idiomas aplicáveis, sem datas/valores traduzidos como texto livre, cortes ou troca de titular. | Manifesto C05; visita/mensal recusam DE no validador atual. Acrescentar DE e fixtures HTML/PDF em lote próprio; restantes modelos e percursos continuam atribuídos. |

## 4. Interfaces e significado dos dados — cinco tarefas

| ID | Tarefa / TASK | Critério de conclusão | Dependência / estado |
|---|---|---|---|
| C10 | Definir e aplicar a política de dia/mês | Matriz de `plannedDate`, `date`, início/fim, regulares/extra e fuso; decisão explícita para divergências. Testes de Lisboa, meia-noite e mudança da hora; dados históricos preservados. | Preparação local; decisão de negócio antes de mudar significados. `serviceVisitFilters`, planeamento sazonal e dashboards. |
| C11 | Apurar crédito agregado com fonte verificável | O resumo distingue crédito confirmado, desconhecido e divergente; reconcilia o total com as fontes existentes e não duplica notas/pagamentos. Zero só com leitura completa; perfis e falhas testados. | C16 fornece validação histórica; implementação local usa fixtures. `clientCreditService`, `BillingCreditBusiness`, `creditRevenueData`. |
| C12 | Paginar o centro de incidentes | Todos os incidentes elegíveis alcançáveis, ordem/IDs estáveis e totais exatos; seleção e resolução não se perdem ao paginar/atualizar. Erro não apaga a existência da pendência nem confirma uma ação. | Local. `incidentService`, `incident-center.js`. |
| C13 | Validar instalações e obras de ponta a ponta | Percurso real de interface: plano, equipa, material, fotos, assinatura, marcos comerciais e custos; perfis, repetição e falhas preservam uma execução e o histórico. | Local primeiro; aceitação física em C31. `InstallationBusiness`, `ConstructionBusiness`. Integrar a consulta de fotos da reparação adicionada na TASK414 na recuperação visível após perda de resposta; API não equivale a UI automática. |
| C14 | Fechar lacunas de interface e acesso do inventário | Manifesto C05 complementado com perfil, teclado, 320/390/1440, claro/escuro, vazio/erro/offline, sessão, ligações e correspondência entre rótulos/totais e fontes (incluindo estados legados das métricas); cada falha tem reprodução e correção limitada. Sem teste aplicável não há aceitação marcada. | Local; dispositivos reais em C30/C31. Não reabrir páginas já aprovadas sem risco concreto. Risco concreto TASK413: anexos legados de compras/fotografias regulares/reparações ainda têm URL público (TASK413/414); rever autenticação sem perder acesso aos originais. |

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

- TASK408: C04-D local aprovado (cinco grupos, 1 311 unitários, quatro técnicos); 313 scripts no runner. Leitura dos JSONs nativos TASK405/406 conclui C01/C02 e aceita C04-A/B. TASK407: agenda aprovada, falha de RSS em C03 bloqueia suite/restauro; não fechar C03 com prova anterior. Próximo lote: memória do dashboard, depois C04-E/F.

**Publicação TASK408:** branch `work/field-readiness-20260915-simulation`, commit `f5e18e31daf28f5a074d7a516b6c1f0f44e75d63`, árvore `ae5862e40277e057404c0b12625ee741b8c5e8e3`, igual à preparada/testada. [CI 36474118500](https://github.com/ts7520305-svg/cristalwater/actions/runs/36474118500), em execução; exigir 313 grupos exatos, restauro e `guide-volume/results.json` com três probes/limpeza aprovados. Bloqueio conhecido C03 por tratar no lote seguinte. Sem merge/deploy/contactos reais.

- TASK409: retirado carregamento financeiro descartado pelo resumo; seis ficheiros de código/teste e quatro documentos. Três testes vermelhos antes, sete novos aprovados; 1 318 unitários e cinco grupos locais. Guarda de 768 MiB conservada; memória local maior 438,89 MiB. C03 aguarda CI/restauro da correção.

**Publicação TASK409:** branch `work/field-readiness-20260915-simulation`, commit `04005a0831f5fe9e6e588b1467596e03036e1779`, árvore `0d753e42d95823755419856e590d9b2e231a0c59`, igual à preparada/testada. [CI 36475513427](https://github.com/ts7520305-svg/cristalwater/actions/runs/36475513427), em execução; 313 grupos, restauro e JSONs nativos ainda por confirmar. Sem merge, deploy ou contactos reais.

- TASK410 / C04-E: volume/histórico aprovados localmente, três probes, 116 pedidos e quatro regressões existentes. 1 318 unitários, quatro técnicos; runner 314. Sem alteração de aplicação. [Evidência](evidence/20260928_task410_local.json). Cinco dos seis cenários C04 executados; próximo PDFs/anexos C04-F. CI TASK408/TASK409 ainda em execução; não fechar C03/C04 por inferência.

**Publicação TASK410:** branch `work/field-readiness-20260915-simulation`, commit `19569a6145ab049b6dca058ae791d81cefc6fc26`, árvore `6726513a322e496354724643cb28852a0d24b1d2`, igual à preparada/testada. [CI 36478772257](https://github.com/ts7520305-svg/cristalwater/actions/runs/36478772257), job `109118978818`, em execução; quatro etapas aprovadas e instalação de dependências na consulta. Exigir 314 grupos na ordem exata, restauro e `report-volume/results.json` com três probes e limpeza aprovados. TASK408/TASK409 continuam na suite integrada, dez etapas aprovadas cada. Sem merge, deploy ou contactos reais.

- TASK411 / C04-F: nove famílias PDF, três perfis, 27 documentos/496 páginas e 100 pedidos aprovados localmente; 13 páginas renderizadas revistas, geometria de todas as páginas, fontes e limpeza conferidas. Oito superfícies de upload inventariadas para TASK412; F permanece em execução. 1 318 unitários, quatro técnicos, runner315. TASK408 nativo aprovado: 313 grupos exatos, restauro128/47, JSONs de agendas/guias lidos, C04-C/D aceites. TASK409/TASK410 ainda em execução. [Evidência](evidence/20260928_task411_local.json).

- Atualização TASK411: TASK409 terminou312/313; `test-field-legacy-visit-drafts.js:39` contou0 em vez de2 conflitos, restauro saltado. Probe de memória otimizado aprovado (513,18MiB), snapshot concorrente confirmado. C03 continua em validação; diagnosticar rascunhos antes do lote de uploads. TASK410 permanece em execução.


**Publicação TASK411:** branch `work/field-readiness-20260915-simulation`, commit `b649f1a61bf834c1f5a37a675321aef0c2a55f45`, árvore `ece3b97fcaea2f0bbedab24b56c9acf9cd2e8f42`, igual à preparada/testada. [CI36482590787](https://github.com/ts7520305-svg/cristalwater/actions/runs/36482590787), job `109131593496`, em execução; exigir315 grupos exatos/restauro/JSONpdf-volume com3 perfis/27 documentos/limpeza. TASK408 confirmado; TASK409 probe de memória aprovado e suite bloqueada por rascunhos; TASK410 em execução. Sem merge, deploy ou contactos reais.

- TASK412: condição de corrida do teste de rascunhos reproduzida com segunda leitura atrasada750ms (0/2); espera pelo estado visível mantém todas as asserções. Guarda impede saída0 sem terminar. Ensaio atrasado e direto atingiram cinco marcadores; 1 318 unitários/quatro técnicos/sintaxe aprovados. Produção inalterada; CI/restauro pendentes. UploadsC04-F passam para TASK413. [Evidência](evidence/20260928_task412_local.json).


**Publicação TASK412:** branch `work/field-readiness-20260915-simulation`, commit `2816af3c375797b5d673b19b05c05597470f10f9`, árvore `76e8afeb98e7d0ee0023ebc1a4f41d6c1c9cae32`, igual à preparada/testada. [CI36483704663](https://github.com/ts7520305-svg/cristalwater/actions/runs/36483704663), job `109135318014`, em execução; exigir315 grupos exatos/restauro e os JSONs de volume/snapshot descritos acima. TASK410/TASK411 ainda na suite integrada, dez etapas aprovadas em cada um. C03/C04 permanecem abertos; próximo lote TASK413 uploads. Sem merge, deploy ou contactos reais.


**Publicação TASK413:** commit `2efae46d4bbec1f468c36f27e672592cfc43dbd9`, árvore `d30acfe8bb02680728e2b4e82bf27be8f7fd51ca`, igual à testada; branch `work/field-readiness-20260915-simulation`. [CI36489954119](https://github.com/ts7520305-svg/cristalwater/actions/runs/36489954119), job109155898206, em execução na suite após dez etapas aprovadas. Exigir316grupos/restauro e quatro probes de anexos. Publicação pela ligação GitHub; push Git por HTTPS não tinha credencial de escrita, sem impacto na árvore publicada.

**TASK414 publicada:** commit `3c3e65eb307e59176dc58a316b4822cfb403e651`, árvore `18d6eaca8d0a97fea9f5fe06318068f59b1d6e34`, igual à validada; [CI 36491440593](https://github.com/ts7520305-svg/cristalwater/actions/runs/36491440593), job 109160736428, na suite integrada após dez etapas aprovadas. TASK413 também na suite; C04 mantém os gates de aceitação anteriores.

**TASK415 / C05:** auditor reproduzível percorreu todas as fontes de aplicação rastreadas, separou motor global, dicionários próprios, texto protegido e candidatos do servidor/PDF; 283 unidades de revisão com até quatro fontes. Atribuição não prova uso por um único perfil nem exige editar fontes sem texto. Extrator e snapshot validados, regressão de idioma aprovada. DE recusado em visita/mensal é lacuna confirmada C09. Inventário não certifica traduções, layout ou ramos de execução. Próximo TASK416/C06: fila de sincronização. Código da aplicação e runner317 inalterados.

**TASK415 publicada:** commit `418e16208463c98b96234ed56ab235372873091b`, árvore `830e323dce6809d56249266b85d4725d90eb987c`, igual à validada. Apenas auditor/documentação, `[skip ci]`; controlos locais registados.

**TASK416 / C06 local:** fila de sincronização localizada em cinco idiomas, alertas/confirmação/conflito/recusa/histórico, originais preservados. Mudança de idioma conserva botão ocupado; renovação liberta controlo após abortar pedido antigo. Novo navegador, regressões sessão/idioma,1 327 unitários/quatro técnicos/sintaxe aprovados. Cache208/runner318. C06 continua aberto; próximo TASK417 página técnica antiga. C04 e os CI413/414 permanecem em validação, sem supor aprovação.

**Publicação TASK416:** commit `e1306ecd5991b7a1266ec67fbe7c8967cfa7497c`, árvore `6ebf796ddcabfdb0808fbd34ff9169b267330b3e`, igual à preparada/testada; branch `work/field-readiness-20260915-simulation`. [CI 36495253808](https://github.com/ts7520305-svg/cristalwater/actions/runs/36495253808), job109173198905, em execução após seis etapas aprovadas. Exigir318 grupos exatos/restauro; TASK413/TASK414 ainda na suite com dez etapas aprovadas na última leitura. Próximo TASK417/C06: página técnica antiga.

**TASK417 — correção do teste de privacidade da frota:** CI TASK413 terminou com315/316 grupos aprovados; a lista foi rejeitada por conter a sequência3655 algures no JSON. Restauro não executado. Reproduzido com matrícula pública legítima contendo os dígitos do PIN. O teste agora exige a projeção pública exata e recusa cinco injeções de campos privados, sem alterar aplicação/permissões. API1 879ms, navegador30 805ms e24 unitários focados aprovados. Runner318; C04 mantém validação pendente, C06 mantém execução. [Prova](evidence/20260929_task417_local.json). Idiomas da página técnica passam para TASK418.

- TASK422: rascunhos/diferenças localizados, pedido original e dados conservados;1 332 unitários/quatro técnicos e três integrações atuais aprovados. Falsa falha de geometria reproduzida com80 amostras e tolerância de0,01px só no teste novo. Sete ficheiros de código/teste+três documentação; runner322/cache213. Próximo423: pré-visualização. CI421/422 ainda não aceites.

- Publicação TASK422: `22d72fa26da3370169f1306179184fb3096a260d`, árvore `5300919f4acc2ea8db4c4a434b2a1c028b228475`, iguais local/remoto. CI36534583004/job109295609200 em execução;322 grupos/restauro ainda pendentes. Próximo423: pré-visualização.

- TASK423: pré-visualização traduzida; cinco grupos integrados,1 332 unitários/quatro técnicos e sintaxe aprovados localmente. Somente apresentação; SQL/rota/rascunhos intactos. TASK421 nativa321/restauro confirmada;422 em execução. Runner323/cache214, cinco ficheiros código/teste e cinco documentação/evidência. Próximo424: mensagens próprias do write-store, sem fechar outras entradas C06/C08 por associação.

- Publicação TASK423: `db0a9435497eadf188376ee4978a85805305cd80`, árvore `94ebc8ee1d8ad7f02f2be2ed640ca33de44eaf4d`, iguais local/remoto. CI36536885893/job109302869348 em execução,323 grupos/restauro pendentes. Preparação424 encontrou67 mensagens fixas; nenhuma mudança no write-store neste lote.

- TASK424: prioridade à falha nativa422.360 frames reproduziram arredondamento de44px; dois pedidos reais retidos reproduziram a corrida de identidade após recuperação de rede. Apenas o teste de alertas muda: tolerância pintada0,01px com layout>=44px e espera pelos pedidos reais antes de guardar os nós. Três grupos locais aprovados; aplicação e runner323/cache214 conservados. CI424/restauro pendentes, idiomas do write-store passam a425. [Prova424](evidence/20260929_task424_local.json).

- Publicação TASK424: `32b4fde7f578dca1e13bd215698a5f4912007621`, árvore `127b67c68cb75e1c66ffdd7de7884db2a78a9d55`, iguais local/remoto. CI36541935848/job109319183700 em execução;323 grupos e restauro128 tabelas/47ficheiros ainda pendentes.

- TASK425:70 mensagens próprias/350 valores em cinco idiomas; erros brutos e falhas persistidas conservados, source body reconstruído exatamente retirando só as adaptações de texto.1 345 unitários/quatro técnicos/sintaxe e seis grupos integrados aprovados. O teste de recuperação agora aguarda o redesenho pós-recibo e confirma a nota antes de continuar. Native423:323 grupos/restauro128/47 confirmados;425 precisa324 grupos/restauro próprios. Dez ficheiros, runner324/cache215. [Prova425](evidence/20260929_task425_local.json).

- Publicação TASK425: `79601dbcb10a951353898cde3f36d445b515b06b`, árvore `20c0dbeb09e0e0a9501e1d1baa8500f63f4ed3b2`, iguais local/remoto. CI36544481091/job109327457174 em execução;324 grupos e restauro128 tabelas/47ficheiros ainda pendentes. Próximo426: pedidos de material do técnico.

- TASK426:52 mensagens/260 valores do pedido de material nos cinco idiomas, mesmos campos/contexto/bloqueios e provas originais. Quatro integrações,1 345 unitários/quatro técnicos e sintaxe aprovados; conta alterada mantém formulário oculto/inert. Um alerta/lembrete/auditoria SQL e recibo original após recuperar resposta. Sete ficheiros, runner325/cache216; CI325/restauro próprios pendentes. [Prova426](evidence/20260929_task426_local.json).

**Publicação TASK426:**`d2d006d377475353f8fee266318b5d3674998087`, árvore `b97fe6c96770ace29d0ed5f819733650a197c320`, CI36548004591/job109338958249 em execução. Native424:322/323, erro de identidade no reload offline de alertas, restauro ignorado; prioridade427.

- TASK427:falha nativa424 de identidade após reload offline reproduzida com leitura real retida. Só o teste passa a aguardar pageshow/leituras/rota; asserções e limites preservados. Três grupos integrados aprovados, quatro ficheiros, runner325/cache216 inalterados. CI325/restauro próprios pendentes. [Prova427](evidence/20260929_task427_local.json).

**Publicação TASK427:**`3eed386567d4fa0b26c1498e34f2ae152d53cfc6`, árvore `07f2855584285ab0ba102bc30c6b9d8a7a1452d3`; CI36549439362/job109343707374 em execução, exige325 grupos/restauro.425/426 continuam em execução;424 permanece historicamente falhado.

**Publicação TASK430:**`aecb9e19debeb4957c72fe3c2bf5342e840eba20`, árvore `56155a52ebcf9e7ee338df60de85ea5605b09a40`; CI36559737364/job109377434265 em execução, seis etapas aprovadas.326 grupos/restauro próprios pendentes. CI428 confirmado326/restauro128/47;427 permanece cancelado. Próximo431: gates e restantes fontes C06.

**Publicação TASK431:**`2b3b74d47efdf15705a2dfb3804cd4d158a28608`, árvore `70eb91f832c459ecd235baf36f8050d534b56e22`; CI36563570810/job109389979085 em execução,7 etapas aprovadas.326 grupos/restauro próprios pendentes. CI429 permanece falhado325/326;430 em execução. Próximo432: gates e restantes fontes C06.
