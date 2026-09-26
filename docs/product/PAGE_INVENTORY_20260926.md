# Inventário atual de páginas

Base publicada: `f91db3f3d6d8af724a86dd17d39019df2794579c`. Gerado em 2026-09-26T05:41:11.140Z. Inclui o estado dos ficheiros locais no momento da geração.

125 ficheiros HTML: 118 entradas de raiz e 7 ficheiros auxiliares/protótipos/testes. 0 referências locais a scripts/estilos/recursos sem ficheiro correspondente.

Foram procuradas referências literais em 307 scripts de integração/navegador ativos. 113 páginas têm pelo menos uma referência; uma referência não prova execução, validação visual ou cobertura completa. A ausência também não exclui testes com URLs construídos dinamicamente.

2 referências existem no índice Git mas não estão materializadas nesta cópia local; não são classificadas como ficheiros ausentes da aplicação.

As colunas de papéis distinguem o catálogo anterior dos indícios explícitos no HTML/scripts. Não são uma auditoria de autorização: as APIs, a atribuição atual e o comportamento real de cada perfil continuam a determinar o acesso.

Exceções revistas: ADMIN conserva a pré-visualização em `/client-portal`; a entrada antiga `/client_chat` encaminha ADMIN para `/chat`, sem abrir a conversa de um cliente. Estas duas situações não são listadas como divergências. A guarda do cliente preserva filas/rascunhos/documentos ao recusar uma sessão; os 24 casos de navegador estão descritos em `CLIENT_ENTRY_PRESERVATION_20260917.md`.

## Correção de atalhos administrativos

| Ação ADMIN | Destino atual |
|---|---|
| Guias de obra/trabalho | `/admin-vehicles#works` |
| Guias de transporte | `/admin-vehicles#guides` |
| Localização da equipa | `/admin-live-map` |

O menu principal, o menu comum e o cabeçalho da frota deixam de encaminhar o administrador para guardas exclusivas de técnicos. As permissões dessas páginas técnicas permanecem iguais.

## Diferenças a rever no catálogo

Nenhuma diferença detetada nas páginas com ficheiro de guarda explícito.

Estas diferenças são itens de revisão, não autorização para alargar acessos. TASK222 alinhou guias/GPS; TASK224 alinhou outras dezasseis entradas do catálogo com as guardas existentes, sem alterar permissões. TASK225 torna a página de preferências acessível aos quatro perfis autenticados, mantendo a titularidade User na API e um estado indisponível para CLIENT/PIN. TASK226 adapta a ajuda e os comandos rápidos ao perfil. TASK228 encaminha a configuração antiga para as preferências autenticadas; as chaves globais de som deixam de ser consumidas, conservando os bytes. As versões anteriores do catálogo/inventário estão no Git.

## Menu por perfil

TASK224 escolhe a navegação pela indicação de papel da página, usando a sessão como segunda opção e o nome do URL apenas como último recurso. CLIENT deixa de receber o menu ADMIN nas páginas genéricas; a rentabilidade mantém menu ADMIN apesar do prefixo técnico. O menu técnico deixa de oferecer cinco destinos administrativos recusados e usa os percursos existentes para guias/stock, histórico e perfil. Registos de campo continuam na entrada Rota do dia e Visita; não há acesso novo ao inventário ou à gestão da frota.

No menu ADMIN, Configurações gerais continua a abrir a central administrativa. O atalho duplicado para a página de som foi removido. Avisos de manutenção abre os controlos existentes na central; não se apresenta essa capacidade como um editor geral de modelos/regras. TASK225 corrige a consulta/gravação de preferências em `/settings`, com confirmação exata, falhas visíveis, separação da identidade, cinco idiomas e estados de acesso recusado. TASK226 permite ajuda por perfil. TASK228 liga o som dos dois ecrãs administrativos à preferência atual da conta e à ativação explícita da página; a entrada antiga encaminha para /settings.

## Inventário

| Entrada | Tipo | Papéis no catálogo | Indícios de papel no código | Referências literais em QA |
|---|---|---|---|---|
| /admin-ai | Entrada raiz | ADMIN | ADMIN | 10 |
| /admin-alerts | Entrada raiz | ADMIN | ADMIN | 11 |
| /admin-client-settings | Entrada raiz | ADMIN | ADMIN | 2 |
| /admin-clients | Entrada raiz | ADMIN | ADMIN | 2 |
| /admin-collection | Entrada raiz | ADMIN | ADMIN | 1 |
| /admin-command-center | Entrada raiz | ADMIN | ADMIN | 1 |
| /admin-company-closures | Entrada raiz | ADMIN | ADMIN | 2 |
| /admin-core-flow | Entrada raiz | ADMIN | ADMIN | 1 |
| /admin-credit-revenue | Entrada raiz | ADMIN | ADMIN | 1 |
| /admin-crm | Entrada raiz | ADMIN | ADMIN | 4 |
| /admin-dashboard | Entrada raiz | ADMIN | ADMIN | 1 |
| /admin-email-logs | Entrada raiz | ADMIN | ADMIN | 1 |
| /admin-email-review | Entrada raiz | ADMIN | — | 2 |
| /admin-expenses | Entrada raiz | ADMIN | ADMIN | 19 |
| /admin-inventory | Entrada raiz | ADMIN | ADMIN | 3 |
| /admin-keys | Entrada raiz | ADMIN | ADMIN | 1 |
| /admin-live-map | Entrada raiz | ADMIN | ADMIN | 1 |
| /admin-login | Entrada raiz | PUBLIC | — | 3 |
| /admin-map | Entrada raiz | ADMIN | ADMIN | 1 |
| /admin-master-control | Entrada raiz | ADMIN | ADMIN | 5 |
| /admin-menu | Entrada raiz | ADMIN | ADMIN | 2 |
| /admin-notifications | Entrada raiz | ADMIN | ADMIN | 3 |
| /admin-onboarding | Entrada raiz | ADMIN | ADMIN | 1 |
| /admin-operational-flow | Entrada raiz | ADMIN | ADMIN | 1 |
| /admin-operational-settings | Entrada raiz | ADMIN | ADMIN | 8 |
| /admin-payment-settings | Entrada raiz | ADMIN | ADMIN | 1 |
| /admin-payments | Entrada raiz | ADMIN | ADMIN | 1 |
| /admin-pool-calculator | Entrada raiz | ADMIN | ADMIN | 4 |
| /admin-pool-technical | Entrada raiz | ADMIN | ADMIN | 11 |
| /admin-pools | Entrada raiz | ADMIN | ADMIN | 3 |
| /admin-priority | Entrada raiz | ADMIN | ADMIN | 2 |
| /admin-reports | Entrada raiz | ADMIN | ADMIN | 2 |
| /admin-revenue | Entrada raiz | ADMIN | ADMIN | 1 |
| /admin-rounds | Entrada raiz | ADMIN | ADMIN | 4 |
| /admin-security | Entrada raiz | ADMIN | ADMIN | 2 |
| /admin-service-log | Entrada raiz | ADMIN | ADMIN | 1 |
| /admin-suppliers | Entrada raiz | ADMIN | ADMIN | 1 |
| /admin-technicians | Entrada raiz | ADMIN | ADMIN | 2 |
| /admin-test-center | Entrada raiz | ADMIN | ADMIN | 1 |
| /admin-today | Entrada raiz | ADMIN | ADMIN | 2 |
| /admin-ui-settings | Entrada raiz | ADMIN | ADMIN | 1 |
| /admin-vehicles | Entrada raiz | ADMIN | ADMIN | 10 |
| /admin-visits-dashboard | Entrada raiz | ADMIN | ADMIN | 1 |
| /admin-visits | Entrada raiz | ADMIN | ADMIN | 0 |
| /alerts-financial | Entrada raiz | ADMIN | ADMIN | 1 |
| /alerts | Entrada raiz | ADMIN | ADMIN | 7 |
| /billing-center | Entrada raiz | ADMIN | ADMIN | 1 |
| /billing-extras | Entrada raiz | ADMIN | ADMIN | 1 |
| /billing-history | Entrada raiz | ADMIN | ADMIN | 1 |
| /billing | Entrada raiz | ADMIN | ADMIN | 5 |
| /chat | Entrada raiz | ADMIN | ADMIN | 15 |
| /client-dashboard | Entrada raiz | CLIENT | CLIENT | 1 |
| /client-history | Entrada raiz | CLIENT | CLIENT | 3 |
| /client-login | Entrada raiz | PUBLIC | — | 2 |
| /client-menu | Entrada raiz | CLIENT | CLIENT | 1 |
| /client-notifications | Entrada raiz | CLIENT | CLIENT | 3 |
| /client-payments | Entrada raiz | CLIENT | CLIENT | 4 |
| /client-portal | Entrada raiz | CLIENT, ADMIN | ADMIN, CLIENT | 18 |
| /client-wow | Entrada raiz | CLIENT | CLIENT | 1 |
| /client | Entrada raiz | CLIENT | CLIENT | 13 |
| /client_chat | Entrada raiz | CLIENT, ADMIN | CLIENT | 4 |
| /client_tech | Entrada raiz | CLIENT | CLIENT | 1 |
| /communications | Entrada raiz | ADMIN | ADMIN | 1 |
| /config-notifications | Entrada raiz | ADMIN, CLIENT, TECHNICIAN, TEAM_LEADER | ADMIN, CLIENT, TEAM_LEADER, TECHNICIAN | 2 |
| /crystal-os-v2-route-index | Entrada raiz | ADMIN | ADMIN | 2 |
| /dashboard | Entrada raiz | ADMIN | ADMIN | 5 |
| /equipment-history-review | Entrada raiz | — | ADMIN | 1 |
| /equipment-material-review | Entrada raiz | — | ADMIN | 1 |
| /equipment-time-review | Entrada raiz | — | ADMIN | 2 |
| /help-center | Entrada raiz | ADMIN, CLIENT, TECHNICIAN, TEAM_LEADER | ADMIN, CLIENT, TEAM_LEADER, TECHNICIAN | 4 |
| /incident-center | Entrada raiz | ADMIN | ADMIN | 0 |
| /invoice-document | Entrada raiz | — | PUBLIC | 6 |
| /invoices | Entrada raiz | ADMIN | ADMIN | 10 |
| /labor-cost-bases | Entrada raiz | ADMIN | ADMIN | 4 |
| /login | Entrada raiz | PUBLIC | — | 24 |
| /map | Entrada raiz | ADMIN | ADMIN | 1 |
| /metrics | Entrada raiz | ADMIN | ADMIN | 4 |
| /multi-map | Entrada raiz | ADMIN | ADMIN | 1 |
| /notifications | Entrada raiz | ADMIN | ADMIN | 14 |
| /operational-dashboard | Entrada raiz | ADMIN | ADMIN | 0 |
| /operational-risk-rules | Entrada raiz | — | ADMIN | 3 |
| /profit-map | Entrada raiz | ADMIN | ADMIN | 1 |
| /ranking | Entrada raiz | ADMIN | ADMIN | 1 |
| /reminder-materials | Entrada raiz | — | ADMIN | 0 |
| /reminder-resources | Entrada raiz | — | ADMIN | 3 |
| /reminder-visits | Entrada raiz | — | ADMIN | 0 |
| /repair-execution | Entrada raiz | ADMIN | — | 2 |
| /repair-work | Entrada raiz | — | — | 1 |
| /report-center | Entrada raiz | ADMIN | ADMIN | 1 |
| /report-settings | Entrada raiz | ADMIN | ADMIN | 6 |
| /route-map | Entrada raiz | ADMIN | ADMIN | 1 |
| /settings | Entrada raiz | ADMIN, CLIENT, TECHNICIAN, TEAM_LEADER | ADMIN, CLIENT, TEAM_LEADER, TECHNICIAN | 9 |
| /splash | Entrada raiz | ADMIN | — | 1 |
| /technician-chat | Entrada raiz | ADMIN | — | 3 |
| /technician-field-mode | Entrada raiz | TECHNICIAN, TEAM_LEADER | TEAM_LEADER, TECHNICIAN | 37 |
| /technician-gps | Entrada raiz | TECHNICIAN, TEAM_LEADER | TEAM_LEADER, TECHNICIAN | 2 |
| /technician-guide | Entrada raiz | TECHNICIAN, TEAM_LEADER | TEAM_LEADER, TECHNICIAN | 5 |
| /technician-history | Entrada raiz | — | TEAM_LEADER, TECHNICIAN | 2 |
| /technician-login | Entrada raiz | PUBLIC | — | 3 |
| /technician-map | Entrada raiz | TECHNICIAN, TEAM_LEADER | TEAM_LEADER, TECHNICIAN | 4 |
| /technician-new-client | Entrada raiz | TECHNICIAN, TEAM_LEADER | TEAM_LEADER, TECHNICIAN | 1 |
| /technician-profile | Entrada raiz | — | TEAM_LEADER, TECHNICIAN | 2 |
| /technician-profit-dashboard | Entrada raiz | ADMIN | ADMIN | 1 |
| /technician-profit | Entrada raiz | ADMIN | ADMIN | 3 |
| /technician-route | Entrada raiz | TECHNICIAN, TEAM_LEADER | TEAM_LEADER, TECHNICIAN | 2 |
| /technician-visit | Entrada raiz | TECHNICIAN, TEAM_LEADER | TEAM_LEADER, TECHNICIAN | 1 |
| /technician | Entrada raiz | TECHNICIAN, TEAM_LEADER | TEAM_LEADER, TECHNICIAN | 11 |
| /tests/test_extra.html | Auxiliar/protótipo/teste | — | — | 0 |
| /to-issue | Entrada raiz | ADMIN | ADMIN | 3 |
| /transport-guide-create | Entrada raiz | — | ADMIN | 2 |
| /transport-guide-documents | Entrada raiz | — | ADMIN | 2 |
| /transport-guide-items | Entrada raiz | — | ADMIN | 2 |
| /transport-guide-manage | Entrada raiz | — | ADMIN | 2 |
| /ui/views/demo.html | Auxiliar/protótipo/teste | — | — | 0 |
| /v26/admin-prototype.html | Auxiliar/protótipo/teste | — | — | 0 |
| /v26/client-prototype.html | Auxiliar/protótipo/teste | — | — | 0 |
| /v26/index.html | Auxiliar/protótipo/teste | — | — | 0 |
| /v26/technician-prototype.html | Auxiliar/protótipo/teste | — | — | 0 |
| /v26/technician/index.html | Auxiliar/protótipo/teste | — | — | 0 |
| /vehicle-assignment | Entrada raiz | — | ADMIN | 2 |
| /vehicle-consumption | Entrada raiz | — | ADMIN, TEAM_LEADER, TECHNICIAN | 2 |
| /vehicle-maintenance | Entrada raiz | — | — | 2 |
| /vehicle-stock-preset | Entrada raiz | — | ADMIN | 2 |
| /visit-report-review | Entrada raiz | — | ADMIN | 2 |
| /work-guide-close | Entrada raiz | — | — | 2 |

## Fila finita sem referência literal em QA

- /admin-visits — Entrada raiz; papéis declarados: ADMIN.
- /incident-center — Entrada raiz; papéis declarados: ADMIN.
- /operational-dashboard — Entrada raiz; papéis declarados: ADMIN.
- /reminder-materials — Entrada raiz; papéis declarados: ADMIN.
- /reminder-visits — Entrada raiz; papéis declarados: ADMIN.
- /tests/test_extra.html — Auxiliar/protótipo/teste; papéis declarados: —.
- /ui/views/demo.html — Auxiliar/protótipo/teste; papéis declarados: —.
- /v26/admin-prototype.html — Auxiliar/protótipo/teste; papéis declarados: —.
- /v26/client-prototype.html — Auxiliar/protótipo/teste; papéis declarados: —.
- /v26/index.html — Auxiliar/protótipo/teste; papéis declarados: —.
- /v26/technician-prototype.html — Auxiliar/protótipo/teste; papéis declarados: —.
- /v26/technician/index.html — Auxiliar/protótipo/teste; papéis declarados: —.

Esta fila prioriza pesquisa de evidência; não declara que o percurso esteja sem testes. Os indícios de idioma e impressão direta estão no JSON e também não equivalem a tradução ou impressão aprovadas.

## Critérios visuais ainda por fechar

Para cada página e perfil permitido: destino correto, carregamento, dados, vazio, erro/repetição, larguras 320/390/1440, teclado/foco, cinco idiomas e PDFs aplicáveis. Consultas existentes de técnico/cliente/ADMIN, entrada TEAM_LEADER e testes por módulo continuam válidos; este inventário não os transforma numa revisão visual universal.

Os ficheiros v26, demo e teste são listados separadamente. Não se presume que sejam percursos de produção. O JSON adjacente conserva recursos, guardas e nomes dos scripts referenciados para orientar a próxima verificação.
