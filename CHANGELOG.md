# CHANGELOG

## TASK565 - cartões read-only de cobertura em cinco idiomas (2026-10-03)
- Reproduzida aria PT sob EN;17 entradas/folhas privadas localizam flags, conclusão/visitas/acompanhamento e checkboxes sem alterar nomes/IDs/datas/links/seleções/valores/payload/guardas. Metadata de ID só no DOM; bindings antigos libertados no produtor, sem novo engine ou mudança de API/schema.
- Dois Route OS completos aprovados109,85s/114,29s, oito códigos em fixtures próprias e todos203/214 cartões comparados nos cinco idiomas/três larguras, zero GET/escrita de negócio por idioma e SQL/nós/drafts/foco/caret preservados. Preflight23/E2E final/cache322/técnicos/sete JS aprovados;4 limitações unitárias Windows mantidas. E2E inicial/Admin reload7s falhou e repetição passou sem mudança, causa não estabelecida. CI560/561/563/logs/restauros conferidos; CI562 falhou na expiração do histórico/restauro skipped, próxima566 prioriza reprodução/correção da fixture. Feedback/recibos/diálogos/planeador/C06 ainda abertos.

## TASK564 - formulários e seletores de rondas em cinco idiomas (2026-10-03)
- Motor/seletor global existente e112 entradas próprias; folhas/atributos/opções repintados nos mesmos nós, sem alterar valores/drafts/payload/aliases/dados literais. Valores PT de coverageCause preservados explicitamente e bindings antigos libertados pelo produtor. Filtros responsivos corrigidos após captura DE, sem palavras partidas.
- Extensão do Route OS nativo aprovada com370 verificações de texto, cinco idiomas/três larguras, SQL/nós/valores/foco/caret intactos e zero GET/escrita de negócio por idioma. Todos os casos operacionais originais e prazos mantidos; grupo final98,90s abaixo do limite120s existente. Preflight23, E2E/cache321 e visual dos três perfis, sintaxe completa/técnicos4/4 aprovados; quatro falhas Windows conhecidas sem dispensas. CI557–559/logs/restauros conferidos; própria ainda pendente. Cartões/estados/recibos/diálogos/planeador continuam abertos; próxima565 apenas cartões de cobertura read-only.

## TASK563 - PINs isolados nas fixtures Route OS (2026-10-03)
- Reproduzido login recusado por dois técnicos QA ativos com o PIN fixo. Grupo existente atribui PINs livres pelo comparador nativo e exige login200/token antes da recusa403 original. Técnicos antigos, produto/API/schema/assertions/prazos preservados.
- Duas execuções completas consecutivas aprovadas com SQL/API/browser reais: atribuições, cobertura/transferência, recorrência, rota/workday e notificações. Gates obrigatórios e quatro limitações Windows registados; próxima564 retoma formulários/seletores de rondas.

## TASK562 - fixture visual Admin em QA preservada (2026-10-03)
- Visita QA exclusiva do passo Admin entra na lista limitada20 sem alterar as três visitas técnicas/Cliente nem dados anteriores. GET real e cartão conferidos pelo ID próprio, mantendo todas as assertions/prazos originais.
- Duas execuções consecutivas Admin/Técnico/Cliente aprovadas sem erros de browser/API; snapshots das visitas originais intactos antes/depois/logout. Produto/cache/API/runner intactos; CI556/log/restauro conferidos. Próxima563 retoma formulários/seletores de rondas, C06 permanece aberta.

## TASK561 - idiomas e legibilidade do dashboard de visitas (2026-10-03)
- Dashboard usa o seletor global e25 entradas próprias em cinco idiomas, repintando folhas/atributos sem recriar cartões/controlos. Nomes/notas/datas/leituras/URLs/códigos literais e valores de filtros preservados; nav existente não duplicado. Contraste local corrigido, mínimo4,67:1 nas amostras sólidas.
- Grupo Admin nativo alargado aprovado com SQL/API reais, três larguras, estados/ARIA/alt/foco/caret/imutabilidade e zero escrita de negócio. Preflight23, E2E completo/cache320, sintaxe completa e técnicos4/4 aprovados; quatro falhas Windows conhecidas dos unitários registadas. CI555/log/restauro conferidos, CI própria pendente.
- Ensaio visual adicional passou Técnico/Cliente e falhou Admin: fixture ausente da lista nativa limitada20; leitura SQL/API confirmou. Próxima562 corrige só a fixture, sem apagar dados ou alterar produto. Rondas/restante C06 continuam abertas.

## TASK560 - reconciliação do primeiro lote de idiomas C06 (2026-10-03)
- Ledger verificável do inventário original: quatro hashes atuais,323 candidatos e28 IDs do dashboard classificados; nav já traduzido separado do corpo descoberto e de dados/códigos internos que permanecem literais. Snapshot C05 intacto.
- Observação Admin/Edge/API/SQL real em320/1440: GETs200, zero escritas operacionais e SQL intacto; corpo PT sem seletor e contraste fraco do dashboard observados. Apenas evidência/documentação, sem produto novo. CI554/log/restauro conferidos; próxima561 trata o dashboard, C06 continua aberta.

## TASK559 - rota legada após expiração (2026-10-03)
- Reproduzido cartão privado repintado a partir da cache após expiração; loadRoute/current/renderVisits reutilizam agora o predicado de sessão existente. Sem novo engine/latch/envio, mantendo contratos/dia/cache e dados guardados.
- Quatro principais aprovados na recusa de releitura/pintura, GET nativo tardio e renovação/reload com bytes intactos. Cinco grupos nativos, cache319 exata, E2E dos três perfis e preflight23/23 aprovados; CI553/log/restauro conferidos, CI própria pendente. Próximo: reconciliação das fontes C06 com inventário original.

## TASK558 - expiração da barra de pendentes legada (2026-10-03)
- Reproduzidos três botões privados após exp do JWT; proteção da vista usa agora exp capturado/store.same/isSessionExpired existentes, sem alterar as filas/envios. Dados preservados e recuperação após reautenticação/reload.
- Quatro principais PIN/USER/Técnico/Chefe aprovados com fotografia binária/conclusão/alerta/GPS, troca rápida, resultado real tardio, cache318/reload offline e UUID/hash/bytes/SQL intactos. Cinco grupos nativos, E2E dos três perfis e preflight23/23 aprovados; produtor da lista após expiração fica para559. CI própria pendente.

## TASK557 - barra de pendentes e sessão legada (2026-10-03)
- Proteção existente limpa rótulos/controlos/contagens e invalida a geração da fila na troca de conta; resultado tardio após regresso rápido não repinta, leitura de outra conta recusada. Pedidos/UUID/hash/payload/drafts e recuperação própria preservados, sem novo engine/bloqueio permanente/API/schema.
- Cinco grupos nativos, cache317 exata/reload frio offline, E2E dos três perfis e preflight23/23 aprovados; CI552/log/restauro conferidos. Caso atual TECH/PIN/conclusão será alargado em558, sem alegar aceitação global dos principais/tipos de pendentes.

## TASK556 - evento de sessão na página técnica legada (2026-10-03)
- Ligado somente cw:session-change à proteção existente da lista: formulários limpam no evento e a geração invalida GET tardio após regresso rápido. Cache/pedidos/rascunhos e comportamento de nova leitura própria preservados; não acrescenta bloqueio permanente nem aborto HTTP.
- Recuperação nativa/cache316 exata/191 tuplos de idioma, E2E dos três perfis e preflight23/23 aprovados; CI551/restauro conferidos. API/schema/payload e runner387 intactos; barra de pendentes fica para observação separada na TASK557.

## TASK555 - perfil técnico e sessão (2026-10-03)
- Seis campos locais do perfil limpam ao mudar/expirar sessão e não repintam até reload. Store/mensagem existentes reutilizados; fontes literais, contactos ocultos e 17 entradas de idioma anteriores preservados.
- Grupo nativo dos quatro principais, cache315 byte a byte/reload frio offline, E2E dos três perfis e preflight23/23 aprovados, sem GET/escrita operacional novos. CI550/restauro conferidos, aceitação do novo SHA pendente.

## TASK554 - rota técnica e leituras privadas (2026-10-03)
- Rota/sugestões limpam no evento de sessão, abortam GET e permanecem fechadas até reload; respostas de outro owner recusadas, query/datas/idiomas preservados.
- Grupo nativo aprovado nos quatro principais, incluindo expiração e cache314/reload frio offline; E2E dos três perfis, preflight23/23 e sintaxe695/308/45 aprovados. CI do commit8986473 ainda pendente.

## TASK553 - histórico e sessão ativa (2026-10-03)
- Histórico usa identidade e mensagem do store existente: limpa dados privados e aborta leituras na troca/expiração da sessão, recusa owner incorreto e respostas tardias; só reload recupera a conta própria.
- Ensaio nativo aprovado nos quatro principais PIN/USER/Técnico/Chefe, cinco idiomas, cache313/reload frio offline e snapshots SQL/outbox intactos. E2E dos três perfis e preflight23/23 aprovados; CI547/restauro conferidos, CI do novo SHA pendente. Sem alteração de API/schema/dados.

## TASK552 - guia técnico e troca de conta (2026-10-03)
- Guia liga o evento de sessão à proteção existente: limpa dados e links privados, aborta movimentos/PDF e só recupera a conta após reload. Mesmo principal preserva a vista; quatro identidades PIN/USER/Técnico/Chefe validadas.
- Ensaios nativos do guia, fonte cacheada/reload frio offline, E2E Admin/Técnico/Cliente e preflight23/23 aprovados; APIs, documentos, dados e idiomas preservados. Cache312/quatro expectativas atualizados. CI545/546 e restauros conferidos, CI do novo commit pendente.

## TASK551 - fixture temporal de equipamentos (2026-10-03)
- Reproduzido o timeout de prontidão ao atravessar a meia-noite de Lisboa; visitas do dia anterior são corretamente excluídas da ronda seguinte.
- Ensaio existente alinhado a um dia QA passado com relógio progressivo; dois grupos completos passaram, incluindo intervalos reais, offline e proteção de conta. Produto, assertions, prazo7s e runner387 preservados; CI do novo SHA ainda necessária.

## TASK549–550 - sessão GPS e fixtures E2E (2026-10-03)
- Página/helper GPS reagem imediatamente ao evento de sessão existente; preservam pontos pendentes e abortam o POST antigo sem alterar payload, API ou permissões. Validado com SQL/browser nativos, callbacks tardios e saída/regresso rápido.
- Fixture E2E existente usa PINs livres e produtos/faturas próprios por execução; duas execuções completas Admin/Técnico/Cliente na mesma QA passaram, sem apagar dados antigos nem enfraquecer guards/assertions.
- CI544 aprovada com 387 grupos e restauro conferido; CI543 falhou num timeout de prontidão de equipamento, ainda por explicar. Não representa release, merge ou deploy em produção.

## TASK547–548 - rota e aceitação SQL local (2026-10-03)
- Sugestão de rota Admin com 35 entradas PT/EN/FR/ES/DE; preservados seleção, nomes literais, dados, destinos, API e ausência de escritas de planeamento.
- PostgreSQL16 QA isolado preparado; 43 migrações aditivas, mapas/API, seis fluxos operacionais e E2E nativo dos três perfis aprovados. CI integrada dos novos SHAs ainda pendente.
- Ensaio SQL/browser de chat independente da fonte Google opcional; produto, assertions e prazos preservados. Quatro falhas ambientais de backup Windows continuam documentadas, sem enfraquecer testes.

## V23.2.1 - Engineering Foundation
- Início do controlo de versões com Git.
- Adicionado .gitignore.
- Criada documentação base do projeto.
- Estado atual inclui Crystal Brain Alpha, Multi Provider e Crystal Kernel inicial.

## V23.2.2 - Technician OS Refactor
- Concluída a refatoração do Technician OS para controllers finos e business modules.
- Movida a lógica de auth, portal, stats, rota, visita, workday e GPS para business.
- Preservados os contratos públicos das rotas e o formato JSON das respostas.
- Adicionada a suíte de regressão Technician OS com Vitest.
- Gerado o relatório de finalização em TECHNICIAN_OS_REPORT.md.
- Revisão final concluída: 100% do escopo do EPIC-001 auditado e validado.

## V23.2.3 - Pool OS Initial Refactor
- Iniciada a transformação do módulo Pool em Pool OS com controllers delegando para business modules.
- Criados os módulos PoolDashboardBusiness, PoolEquipmentBusiness, PoolChemistryBusiness, PoolMaintenanceBusiness, PoolHistoryBusiness e PoolVisitBusiness.
- Atualizados os controllers de pool, equipment e cálculo químico para manter os contratos públicos e respostas JSON compatíveis.
- Adicionada a suíte de regressão Pool OS com Vitest.
- Gerado o relatório de evolução em POOL_OS_REPORT.md.

## V23.2.4 - Route OS Operational Acceptance
- Registado o Operational Acceptance Record antes do início do EPIC-004 Route OS.
- Validado o cenário com 1 técnico, 1 workday, 5 clientes, 5 piscinas e 5 visitas.
- Confirmados 6 notifications e 5 audit entries no fecho do fluxo operacional.
- Documentados os issues encontrados e as correções aplicadas durante a validação.
- Marcado o EPIC-003 como Production Ready e publicado o plano inicial do EPIC-004.

## V23.2.5 - Route OS Production Ready
- Concluída a execução do EPIC-004 Route OS com regressão determinística e validação operacional.
- Adicionada cobertura de teste para ordenação da rota e carregamento do today route do técnico.
- Implementada recuperação local da rota diária, deduplicação da fila offline e resolução determinística de conflitos de conclusão já efetuada.
- Mantidos os contratos públicos da API, o formato JSON e os eventos do EventBus.

## 2026-10-02 — checkpoint oficial (sem nova release)
- Criados `PROJECT_STATE.md` e `BACKLOG.md` como checkpoint e índice do plano existente.
- Arquitetura complementada com a estrutura atual e pipeline de validação.
- Identificadas versões documentais divergentes e divergência entre branch padrão e branch de desenvolvimento; não foi atribuída prontidão de produção nem efetuado merge.

## TASK539 — recuperação isolada da ficha técnica (2026-10-02)
- Memória da ficha por principal validado e visita, restaurada só após carregamento autorizado; refresh conserva a edição atual.
- Dados antigos sem titular não são adotados; bytes inválidos arquivados antes de guardar novos campos. Ficheiros, credenciais e formulários geridos excluídos.
- Cache v304; 13 regressões novas e ensaio Chromium de reload aprovados localmente. Aceitação integrada/produção permanece pendente.

## TASK540 — regressão browser reproduzível (2026-10-02)
- Adicionado ensaio da recuperação por conta/visita com HTML e scripts reais; respostas de API são fixtures QA explícitas, sem alegar validação SQL.
- Reload atrasado, troca PIN/USER, refresh, outra visita, recusa GET, exclusão de ficheiros e preservação de bytes verificados. Incluído nos gates browser existentes; código antigo falha no mesmo ensaio.

## TASK541 — proteger o rascunho próprio de novo cliente (2026-10-02)
- Formulário de intake marcado como gerido pelo mecanismo existente por conta; a memória genérica deixa de copiar ou sobrescrever os seus campos.
- Reprodução browser com scripts reais capta o nome da conta antiga antes da repintura; após correção preserva 11 campos, rascunho original e edição normal, sem envio de negócio. Cache v305 e expectativas correspondentes atualizadas.

## Checkpoint após TASK541 (2026-10-02)
- Confirmados os commits remotos539–541 e checkout limpo; registados testes locais finais, Actions pendentes e próxima tarefa542 no estado oficial.
- Checkpoint anterior conservado integralmente como arquivo; o estado oficial da raiz identifica explicitamente as entradas anteriores como históricas.

## TASK542 — idiomas do intake de cliente em campo (2026-10-02)
- Localizados os textos próprios de `technician-new-client` em PT/EN/FR/ES/DE: permissões, rascunho, envio, políticas, GPS, campos, placeholders e opções visíveis.
- Preservado o contrato do `CWFieldWriteStore`, UUID/requestId, recibos, payload e valores aceites de `poolType` (`Privada`, `Condomínio`, `Hotel`, `Jacuzzi`); só as etiquetas visíveis mudam por idioma.
- Regressão browser do intake ampliada para cinco idiomas, três larguras e zero escritas operacionais, mantendo bytes do rascunho próprio e compatibilidade com a memória genérica atrasada.

## Checkpoint após TASK542 (2026-10-02)
- Registados commit/árvore/run da TASK542, Actions correntes, gates locais e a limitação ambiental do `npm test` em Windows no estado oficial.
- Próxima ação: aguardar CI540–542; se não houver falhas, continuar C06 pelas próximas lacunas do inventário sem declarar C06 concluída.

## TASK543 — repintura dos erros de intake (2026-10-02)
- Corrigidos prefixos e erros próprios de envio/gravação que permaneciam no idioma anterior; textos literais externos e bytes do rascunho continuam preservados.
- Regressão no browser reproduz o erro anterior e verifica cinco idiomas, erro literal e ausência de envios operacionais. Cache offline306 e expectativas existentes atualizados.
- CI540/541 concluídos: cada execução confirmou387 grupos distintos e restauro128 tabelas/51 ficheiros. CI542 e aceitação integrada543 permanecem pendentes.

## TASK544 — troca de conta no intake aberto (2026-10-03)
- Evento de sessão limpa e bloqueia imediatamente os campos da conta anterior, incluindo quando o envio local está ocupado; gerações de leitura/GPS invalidadas antes de recuperar a conta original.
- Regressão de sessão/storage/GPS retido conserva os dois rascunhos e não envia operações. Componentes de entrada dos três perfis, sessão e offline aprovados; cache307 e expectativas existentes atualizados.

## TASK545 — troca de conta na conversa da equipa (2026-10-03)
- Chat usa imediatamente a invalidação existente ao receber o evento de sessão, limpando mensagens/notificações/campos e abortando leituras antigas.
- Novo componente browser para Técnico/Chefe/Admin preserva rascunhos e pedidos das duas contas e não envia operações; adicionado depois dos22 gates existentes, com preflight23/23 aprovado. Cache20261003-v308; runner integrado387 intacto.

## TASK546 — erros nativos do write-store no intake (2026-10-03)
- Intake conserva os descritores de erro do write-store e reutiliza o seu dicionário existente ao mudar de idioma; erros externos/persistidos continuam literais.
- Regressão com bloqueio interno nativo do store confirma cinco idiomas, rascunho/requestId intactos, fila vazia e zero envios operacionais. Cache309 e expectativas existentes atualizados.

## Checkpoint após TASK546 (2026-10-03)
- Registados os quatro commits543–546, árvores e Actions; último código publicado `e3497a6`. CI540/541 e restauros aprovados; CI542–546 pendentes.
- Documentados testes locais, limitações Windows, preflight23 e próxima547/C06-011. Sem merge ou deploy.
