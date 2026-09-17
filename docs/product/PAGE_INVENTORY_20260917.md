# TASK228 — Inventário atual de páginas

Base publicada: `bc5e4e35efccf89c9bb085a2ff5749ecb82c4e62`. Gerado em 2026-09-17T12:47:06.070Z. Inclui as alterações locais do lote TASK225.

101 ficheiros HTML: 94 entradas de raiz e 7 ficheiros auxiliares/protótipos/testes. 0 referências locais a scripts/estilos/recursos sem ficheiro correspondente.

Foram procuradas referências literais em 144 scripts de integração/navegador ativos. 46 páginas têm pelo menos uma referência; uma referência não prova execução, validação visual ou cobertura completa. A ausência também não exclui testes com URLs construídos dinamicamente.

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
| /admin-ai | Entrada raiz | ADMIN | ADMIN | 0 |
| /admin-alerts | Entrada raiz | ADMIN | ADMIN | 7 |
| /admin-client-settings | Entrada raiz | ADMIN | ADMIN | 0 |
| /admin-clients | Entrada raiz | ADMIN | ADMIN | 2 |
| /admin-collection | Entrada raiz | ADMIN | ADMIN | 1 |
| /admin-command-center | Entrada raiz | ADMIN | ADMIN | 0 |
| /admin-company-closures | Entrada raiz | ADMIN | ADMIN | 0 |
| /admin-core-flow | Entrada raiz | ADMIN | — | 0 |
| /admin-crm | Entrada raiz | ADMIN | ADMIN | 0 |
| /admin-dashboard | Entrada raiz | ADMIN | ADMIN | 0 |
| /admin-email-logs | Entrada raiz | ADMIN | ADMIN | 0 |
| /admin-inventory | Entrada raiz | ADMIN | ADMIN | 2 |
| /admin-keys | Entrada raiz | ADMIN | ADMIN | 1 |
| /admin-live-map | Entrada raiz | ADMIN | ADMIN | 0 |
| /admin-login | Entrada raiz | PUBLIC | — | 3 |
| /admin-map | Entrada raiz | ADMIN | ADMIN | 0 |
| /admin-master-control | Entrada raiz | ADMIN | ADMIN | 4 |
| /admin-menu | Entrada raiz | ADMIN | ADMIN | 0 |
| /admin-notifications | Entrada raiz | ADMIN | ADMIN | 3 |
| /admin-onboarding | Entrada raiz | ADMIN | ADMIN | 0 |
| /admin-operational-flow | Entrada raiz | ADMIN | ADMIN | 0 |
| /admin-operational-settings | Entrada raiz | ADMIN | ADMIN | 1 |
| /admin-payment-settings | Entrada raiz | ADMIN | ADMIN | 0 |
| /admin-payments | Entrada raiz | ADMIN | ADMIN | 0 |
| /admin-pool-calculator | Entrada raiz | ADMIN | ADMIN | 0 |
| /admin-pool-technical | Entrada raiz | ADMIN | ADMIN | 4 |
| /admin-pools | Entrada raiz | ADMIN | ADMIN | 1 |
| /admin-priority | Entrada raiz | ADMIN | ADMIN | 0 |
| /admin-reports | Entrada raiz | ADMIN | ADMIN | 0 |
| /admin-rounds | Entrada raiz | ADMIN | ADMIN | 3 |
| /admin-security | Entrada raiz | ADMIN | ADMIN | 0 |
| /admin-service-log | Entrada raiz | ADMIN | ADMIN | 0 |
| /admin-suppliers | Entrada raiz | ADMIN | ADMIN | 0 |
| /admin-technicians | Entrada raiz | ADMIN | ADMIN | 0 |
| /admin-test-center | Entrada raiz | ADMIN | ADMIN | 0 |
| /admin-today | Entrada raiz | ADMIN | ADMIN | 0 |
| /admin-ui-settings | Entrada raiz | ADMIN | ADMIN | 0 |
| /admin-vehicles | Entrada raiz | ADMIN | ADMIN | 0 |
| /admin-visits-dashboard | Entrada raiz | ADMIN | ADMIN | 1 |
| /admin-visits | Entrada raiz | ADMIN | ADMIN | 0 |
| /alerts-financial | Entrada raiz | ADMIN | ADMIN | 0 |
| /alerts | Entrada raiz | ADMIN | ADMIN | 5 |
| /billing-center | Entrada raiz | ADMIN | ADMIN | 0 |
| /billing-extras | Entrada raiz | ADMIN | ADMIN | 1 |
| /billing-history | Entrada raiz | ADMIN | ADMIN | 0 |
| /billing | Entrada raiz | ADMIN | ADMIN | 3 |
| /chat | Entrada raiz | ADMIN | ADMIN | 9 |
| /client-dashboard | Entrada raiz | CLIENT | CLIENT | 0 |
| /client-history | Entrada raiz | CLIENT | CLIENT | 1 |
| /client-login | Entrada raiz | PUBLIC | — | 2 |
| /client-menu | Entrada raiz | CLIENT | CLIENT | 0 |
| /client-notifications | Entrada raiz | CLIENT | CLIENT | 2 |
| /client-payments | Entrada raiz | CLIENT | CLIENT | 3 |
| /client-portal | Entrada raiz | CLIENT, ADMIN | ADMIN, CLIENT | 10 |
| /client-wow | Entrada raiz | CLIENT | CLIENT | 0 |
| /client | Entrada raiz | CLIENT | CLIENT | 6 |
| /client_chat | Entrada raiz | CLIENT, ADMIN | CLIENT | 4 |
| /client_tech | Entrada raiz | CLIENT | CLIENT | 0 |
| /communications | Entrada raiz | ADMIN | ADMIN | 1 |
| /config-notifications | Entrada raiz | ADMIN, CLIENT, TECHNICIAN, TEAM_LEADER | ADMIN, CLIENT, TEAM_LEADER, TECHNICIAN | 2 |
| /crystal-os-v2-route-index | Entrada raiz | ADMIN | — | 0 |
| /dashboard | Entrada raiz | ADMIN | ADMIN | 5 |
| /help-center | Entrada raiz | ADMIN, CLIENT, TECHNICIAN, TEAM_LEADER | ADMIN, CLIENT, TEAM_LEADER, TECHNICIAN | 2 |
| /incident-center | Entrada raiz | ADMIN | ADMIN | 0 |
| /invoice-document | Entrada raiz | — | — | 4 |
| /invoices | Entrada raiz | ADMIN | ADMIN | 6 |
| /login | Entrada raiz | PUBLIC | — | 19 |
| /map | Entrada raiz | ADMIN | ADMIN | 0 |
| /metrics | Entrada raiz | ADMIN | ADMIN | 3 |
| /multi-map | Entrada raiz | ADMIN | ADMIN | 0 |
| /notifications | Entrada raiz | ADMIN | ADMIN | 12 |
| /operational-dashboard | Entrada raiz | ADMIN | ADMIN | 0 |
| /profit-map | Entrada raiz | ADMIN | ADMIN | 0 |
| /ranking | Entrada raiz | ADMIN | ADMIN | 0 |
| /report-center | Entrada raiz | ADMIN | ADMIN | 0 |
| /report-settings | Entrada raiz | ADMIN | ADMIN | 0 |
| /route-map | Entrada raiz | ADMIN | ADMIN | 0 |
| /settings | Entrada raiz | ADMIN, CLIENT, TECHNICIAN, TEAM_LEADER | ADMIN, CLIENT, TEAM_LEADER, TECHNICIAN | 7 |
| /splash | Entrada raiz | ADMIN | — | 0 |
| /technician-chat | Entrada raiz | — | — | 3 |
| /technician-field-mode | Entrada raiz | TECHNICIAN, TEAM_LEADER | TEAM_LEADER, TECHNICIAN | 26 |
| /technician-gps | Entrada raiz | TECHNICIAN, TEAM_LEADER | TEAM_LEADER, TECHNICIAN | 2 |
| /technician-guide | Entrada raiz | TECHNICIAN, TEAM_LEADER | TEAM_LEADER, TECHNICIAN | 2 |
| /technician-history | Entrada raiz | — | TEAM_LEADER, TECHNICIAN | 2 |
| /technician-login | Entrada raiz | PUBLIC | — | 3 |
| /technician-map | Entrada raiz | TECHNICIAN, TEAM_LEADER | TEAM_LEADER, TECHNICIAN | 4 |
| /technician-new-client | Entrada raiz | TECHNICIAN, TEAM_LEADER | TEAM_LEADER, TECHNICIAN | 0 |
| /technician-profile | Entrada raiz | — | TEAM_LEADER, TECHNICIAN | 2 |
| /technician-profit-dashboard | Entrada raiz | ADMIN | ADMIN | 0 |
| /technician-profit | Entrada raiz | ADMIN | ADMIN | 1 |
| /technician-route | Entrada raiz | TECHNICIAN, TEAM_LEADER | TEAM_LEADER, TECHNICIAN | 2 |
| /technician-visit | Entrada raiz | TECHNICIAN, TEAM_LEADER | TEAM_LEADER, TECHNICIAN | 1 |
| /technician | Entrada raiz | TECHNICIAN, TEAM_LEADER | TEAM_LEADER, TECHNICIAN | 3 |
| /tests/test_extra.html | Auxiliar/protótipo/teste | — | — | 0 |
| /to-issue | Entrada raiz | ADMIN | ADMIN | 0 |
| /ui/views/demo.html | Auxiliar/protótipo/teste | — | — | 0 |
| /v26/admin-prototype.html | Auxiliar/protótipo/teste | — | — | 0 |
| /v26/client-prototype.html | Auxiliar/protótipo/teste | — | — | 0 |
| /v26/index.html | Auxiliar/protótipo/teste | — | — | 0 |
| /v26/technician-prototype.html | Auxiliar/protótipo/teste | — | — | 0 |
| /v26/technician/index.html | Auxiliar/protótipo/teste | — | — | 0 |

## Critérios visuais ainda por fechar

Para cada página e perfil permitido: destino correto, carregamento, dados, vazio, erro/repetição, larguras 320/390/1440, teclado/foco, cinco idiomas e PDFs aplicáveis. Consultas existentes de técnico/cliente/ADMIN, entrada TEAM_LEADER e testes por módulo continuam válidos; este inventário não os transforma numa revisão visual universal.

Os ficheiros v26, demo e teste são listados separadamente. Não se presume que sejam percursos de produção. O JSON adjacente conserva recursos, guardas e nomes dos scripts referenciados para orientar a próxima verificação.
