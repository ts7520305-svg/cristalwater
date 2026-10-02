# CHANGELOG

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
