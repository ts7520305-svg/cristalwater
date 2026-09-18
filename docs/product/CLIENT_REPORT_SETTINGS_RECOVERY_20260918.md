# TASK247–248 — configurações recuperáveis do relatório do cliente

## Estado e âmbito

TASK247–249 confirmadas conjuntamente no commit `99cd623c472961ffc7bac33455ea8e6b00e8515a`, árvore `bb6ae40168cd27d66dce3b008a4132ea3518ab35`, [CI `35306180181`](https://github.com/ts7520305-svg/cristalwater/actions/runs/35306180181), job `105478715580`: 142/142 grupos, 388 testes unitários/62 ficheiros e quatro testes técnicos, 21 scripts no gate de navegador, 20 migrações, sintaxe de 546 JS backend/179 frontend/57 scripts inline e restauro de 110 tabelas/32 ficheiros com linhas e hashes iguais em PostgreSQL 16. CI concluído em 18/09/2026 às 04:29 UTC. Cache v72, sem nova migração. Configurações API/interface: 1070/22814 ms; faturação de alertas: 14799 ms; impedimentos/regressos: 12586 ms; relatórios mensais API/interface: 4241/8563 ms; proteção do imprimível: 1391 ms. TASK247 corrige a API; TASK248 liga a interface ao cliente, conta e versão confirmados. A TASK249 fecha a regressão de sessão do acompanhamento administrativo.

Atualização TASK250–251 confirmada no commit `09faec4284d8247811c0b1b48402a2bf42fe8b1c`, [CI `35311811075`](https://github.com/ts7520305-svg/cristalwater/actions/runs/35311811075): 144/144 grupos e restauro de 110 tabelas/32 ficheiros. Abertura autenticada nas configurações/centro mensal, pré-visualização CLIENT, opções no PDF/HTML, consulta de clientes arquivados e paginação individual. Ver `AUTHENTICATED_VISIT_REPORTS_20260918.md`. As observações de código no final conservam o diagnóstico histórico anterior; cálculos do imprimível mensal, abertura pelos alertas e incorporação autorizada das fotos permanecem por tratar.

## Leitura e gravação

`GET /api/report-settings/:clientId` continua exclusivo de ADMIN. Valida um ID inteiro canónico e não aceita parâmetros de consulta. A leitura usa um snapshot consistente e não cria configurações, auditorias ou comprovativos. Confirma explicitamente o cliente, o estado ativo, a origem DEFAULT/SAVED, as 15 opções, a data guardada e uma versão opaca. Cliente inativo pode ser configurado; cliente arquivado/eliminado fica indisponível para alteração. A projeção não inclui contactos ou valores financeiros.

O fallback do PDF e a leitura usam o mesmo módulo de defaults: morada, técnico, início/fim, químicos, equipamento, casa técnica e fotos ficam ocultos quando não existe configuração. O módulo conserva os valores já existentes. Configurações históricas com todos os campos verdadeiros permanecem verdadeiras; não é possível inferir se resultaram de uma escolha ou do antigo GET com escrita. Não há migração nem reinterpretação automática dessas escolhas.

`POST /api/report-settings/:clientId` exige exatamente `requestId`, `clientId`, `expectedVersion` e `setting` com as 15 opções booleanas. A página antiga sem identificador recebe 428 e precisa de recarregar. Dados, versão ou cliente ambíguos são recusados. A versão inclui a ficha relevante, a identidade do registo, os campos efetivos e a data de atualização.

A transação recupera primeiro um pedido existente para ADMIN/UUID, bloqueia o cliente, verifica a versão e disponibilidade, grava as opções, verifica o resultado, regista a auditoria nominal e confirma o comprovativo `CLIENT_REPORT_SETTINGS`. Uma falha em qualquer escrita reverte o conjunto. O mesmo UUID com dados/cliente diferentes é recusado; um reenvio exato devolve o resultado original, mesmo depois de alterações posteriores.

Versão desatualizada e cliente indisponível produzem decisões imutáveis `applied:false`, sem alterar as opções. O HTTP 200 confirma o tratamento do pedido, não uma gravação aplicada. O navegador verifica essa distinção, a conta, o cliente, o UUID, o hash do conteúdo e as opções efetivamente confirmadas. Respostas não confirmadas conservam o pedido original. Não há alterações financeiras ou envios externos. Leituras e respostas do controlador usam `private, no-store`.

## Interface e recuperação

- As opções começam vazias e desativadas. Só uma leitura confirmada permite editar e guardar. Seleção de outro cliente limpa a apresentação e invalida respostas atrasadas.
- Rascunho por janela/ADMIN/cliente em sessionStorage; pedido e comprovativo por ADMIN/cliente em IndexedDB. O pedido é persistido e relido antes do POST. O painel permite localizar pedidos por confirmar da conta atual.
- Web Locks serializa o tratamento do mesmo cliente entre janelas; BroadcastChannel revalida a apresentação sem apagar os rascunhos independentes. Sem essas capacidades de gravação, a consulta permanece disponível e o bloqueio é explícito.
- Perda de ligação, resposta inválida, quota e interrupção de sessão mantêm o pedido recuperável. O regresso da rede não desencadeia reenvio automático. A ação explícita reutiliza os dados e UUID originais.
- Depois de confirmar um comprovativo, é necessário carregar novamente antes de editar. O comprovativo original não é apresentado como garantia de que ainda corresponde à versão atual.
- Versão diferente exige revisão com estado atual e proposta. A proposta conserva os campos atuais que o rascunho não mudou. Preparar a revisão não grava; Guardar cria um novo pedido sobre a versão revista.
- Mudança de conta/token, seleção silenciosamente restaurada, pagehide e regresso BFCache invalidam o contexto anterior. A conta seguinte não vê os pedidos/rascunhos da primeira. Os bytes originais permanecem disponíveis quando a conta original regressa.
- Dados locais corrompidos não são eliminados nem reinterpretados. Erros de armazenamento impedem uma confirmação falsa. O rascunho de outro cliente não é apagado ao confirmar o pedido atual.

Os testes usam a página real, o shell e a API. Nomes compridos com HTML são texto literal; larguras 320/390/1440, botões de 44 px e contraste claro/escuro foram verificados. A primeira passagem revelou fundos e títulos incompatíveis com o modo escuro, corrigidos com estilos locais. A página continua em português; não foi feita uma tradução integral nesta tarefa. sessionStorage conserva rascunhos ao recarregar a janela, mas não fornece sincronização entre dispositivos ou garantia de sobrevivência ao fecho definitivo da janela. Os pedidos submetidos são guardados em IndexedDB.

## Evidência

`scripts/test-field-report-settings.js`: HTTP e base reais, ADMIN e três perfis recusados, defaults sem escrita, opções históricas preservadas, entradas inválidas, dois processos concorrentes, resposta repetida exata, conflito de versão, cliente indisponível e comprovativos imutáveis. Falhas de leitura/opções/auditoria/comprovativo são injetadas nos delegates Prisma do servidor de QA e verificam rollback; não simulam uma avaria física do PostgreSQL.

`scripts/test-field-report-settings-ui.js`: navegador e API reais; respostas reais retidas ou alteradas para testar cliente/sessão, perda após commit, resposta forjada/incompleta/202, revisão entre janelas, bloqueio, rascunhos independentes, recuperação de outra conta, timeout, offline, BFCache, quota do rascunho e quota ao guardar o comprovativo. Na última situação, o servidor já gravou, o pedido local continua pendente e a recuperação confirma o mesmo UUID sem nova auditoria. Corrupção local é conservada.

Execução local conjunta `run-1789702175714`: API 940 ms, interface 18072 ms, proteção do imprimível 1259 ms e API mensal 3838 ms aprovados; interface mensal 8136 ms, todos aprovados. O teste visual passou depois a esperar o desaparecimento natural do aviso transitório de rede antes das capturas. Isso revelou uma medição de 43,999969 px para um botão CSS de 44 px: a asserção passou a tolerar 0,01 px, sem alterar o código da aplicação. A versão final completa passou em `run-1789702503062`, 21957 ms; a tentativa com a asserção demasiado estrita não conta como aprovação. 388 testes unitários/62 ficheiros e sintaxe de 546 JS backend, 179 frontend e 57 scripts inline aprovados. Estes ensaios usam bootstrap do esquema em PGlite isolado, sem substituir o ensaio nativo de migração/restauro.

Runner: 142 grupos de integração, 21 scripts no gate de navegador, 20 migrações existentes, cache v72 na árvore conjunta com TASK249. Inventário regenerado: 101 HTML, 58 páginas com referências literais entre 163 scripts ativos, zero recursos locais em falta e zero divergências detetadas no catálogo/guarda. Referência num teste não comprova revisão universal.

## Publicação e próximo passo

A árvore conjunta foi aprovada no CI final identificado acima, incluindo as reproduções de concorrência e sessão. Este checkpoint posterior altera apenas documentação.

Primeira publicação `87be4ade81e4443f473c065fe5ed43dfc148af41`, CI `35303623268`: 141/142 grupos, com duas entradas do mesmo pedido no painel e restauro omitido. O CI `35303828163`, commit `4bf06ecbeede6abae2f12766428029d024595df1`, árvore `af775757c7fac87cc2fc04cfc46e586ed553d41a`, aprovou 142/142 grupos, 388 unitários/quatro técnicos, 21 scripts de navegador, 20 migrações, sintaxe 546/179/57 e restauro de 110 tabelas/32 ficheiros com linhas/hashes iguais; API/UI das configurações em 1052/22566 ms. Essa execução não reproduziu a corrida intermitente e não valida a correção posterior.

A corrida foi reproduzida localmente em `run-1789703436130`: uma leitura IndexedDB mais antiga foi entregue depois de outra mais recente e a lista apresentou duas entradas, em vez de uma. Cada execução limpava o DOM antes da leitura assíncrona e ambas acrescentavam os resultados. A lista passa a ser construída num fragmento e substituída de uma só vez; apenas a consulta mais recente pode apresentá-la ou publicar um erro. O novo teste falha na versão antiga e passou com a correção em `run-1789703512086` (interface completa: 21978 ms). O contrato de gravação/UUID permanece igual; o defeito reproduzido era de apresentação.

Correção do painel publicada (cache v71) em `4d997baa22ad7cdb063943028df8eebb0548d0f4`, árvore `6576604408948e059fe87a9f4165230e5f71bee4`, branch `work/field-readiness-20260915-simulation`. O CI `35304938643` aprovou a API em 675 ms e a interface em 20842 ms, incluindo a reprodução da concorrência. Falhou em `test-field-alert-billing.js`, na leitura automática de regressos após mudança de sessão; restauro omitido. Correção complementar em `ADMIN_RETURN_SESSION_RECOVERY_20260918.md`, confirmada no CI final `35306180181`. Backups locais: `backup/task248-local-20260918`, `backup/task248-visual-local-20260918` e `backup/task248-recovery-local-20260918`. Sem merge em main ou deploy de produção.

O percurso indicado originalmente — abertura autenticada e revisão individual — foi implementado nas TASK250–251; a evidência atual está na adenda inicial e em `AUTHENTICATED_VISIT_REPORTS_20260918.md`. O próximo percurso é rever as fontes e os cálculos do imprimível mensal, sem lhe atribuir o contrato financeiro da nova API mensal antes de essa ligação ser implementada e ensaiada.


### Diagnóstico histórico dos pontos de entrada, antes de TASK250–251

Leitura de código, sem novo ensaio do conteúdo/layout de PDFs:

| Percurso | Origem e lacuna a tratar |
|---|---|
| PDF individual | `frontend/report-settings.js` abre `/api/report-visit/visit/:id` diretamente. O gerador é `src/controllers/reportVisitController.js`. Confirmar autenticação, visita/cliente e apresentação solicitada, mantendo a autoridade do token; `?role=CLIENT` não seleciona atualmente uma apresentação de cliente para ADMIN. |
| Imprimível mensal | `frontend/report-center.html` já envia Authorization, mas aceita qualquer resposta HTTP considerada ok e qualquer tipo de blob, não invalida o mês/filtro/conta durante a espera e ignora o retorno de `window.open`. Existe revogação do object URL após 30 segundos; acrescentar cancelamento e limpeza por contexto, sem afirmar que hoje não existe qualquer limpeza. |
| Helper de documentos | `frontend/cw-auth-download.js` já abre a janela durante o gesto do utilizador, valida origem e observa a mudança do token. A lista permitida inclui guias, PDFs de fatura e anexos, mas não estas rotas de relatórios. Não basta ligar o botão ao helper atual: é necessário definir e testar o contrato de cada saída. |

`/api/reports/visit/:id` devolve a versão HTML individual e é distinto de `/api/report-visit/visit/:id`, que gera o PDF. Os ensaios de acesso/HTML da TASK246 não constituem uma revisão visual do PDF. Os campos guardados interpolados no HTML individual e as fontes financeiras do imprimível mensal continuam no âmbito da revisão seguinte.
