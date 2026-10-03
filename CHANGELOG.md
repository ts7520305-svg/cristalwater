# CHANGELOG

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
