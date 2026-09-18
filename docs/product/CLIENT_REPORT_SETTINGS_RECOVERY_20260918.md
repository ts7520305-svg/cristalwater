# TASK247–248 — configurações recuperáveis do relatório do cliente

## Estado e âmbito

Implementação sobre o checkpoint `086632dba7502413c087a6a8221b74c7cb0a2d6c`. TASK247 corrige a API de configurações; TASK248 liga a interface ao cliente, conta e versão confirmados, com rascunhos e recuperação. Validação local aprovada; a confirmação da árvore publicada no CI e o restauro PostgreSQL ficam registados abaixo quando concluídos.

A abertura autenticada dos relatórios, os cálculos do imprimível mensal e a revisão dos conteúdos/layout dos PDFs continuam no lote seguinte. Os botões de pré-visualização antigos ainda abrem um URL sem Authorization, e `?role=CLIENT` não muda o papel autenticado usado pelo gerador. Esta alteração não afirma que esses percursos estejam corrigidos.

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

Execução local conjunta `run-1789702175714`: API 940 ms, interface 18072 ms, proteção do imprimível 1259 ms e API mensal 3838 ms aprovados; interface mensal confirmada no log da mesma execução. O teste visual passou depois a esperar o desaparecimento natural do aviso transitório de rede antes das capturas. 388 testes unitários/62 ficheiros e sintaxe de 546 JS backend, 179 frontend e 57 scripts inline aprovados. Estes ensaios usam bootstrap do esquema em PGlite isolado, sem substituir o ensaio nativo de migração/restauro.

Runner: 142 grupos de integração, 21 scripts no gate de navegador, 20 migrações existentes, cache v70. Inventário regenerado: 101 HTML, 58 páginas com referências literais entre 163 scripts ativos, zero recursos locais em falta e zero divergências detetadas no catálogo/guarda. Referência num teste não comprova revisão universal.

## Publicação e próximo passo

Publicar a árvore conjunta na branch `work/field-readiness-20260915-simulation`; confirmar o CI completo e o restauro em PostgreSQL 16 antes de fechar o lote. Sem merge em main ou deploy de produção.

Próximo percurso: abertura autenticada com tipo de conteúdo e contexto de mês/filtro/visita/sessão confirmados, prazo de rede, limpeza de object URLs e alternativa visível quando a janela é bloqueada. Depois rever fontes, texto escapado e apresentação dos relatórios individuais e do imprimível mensal, sem atribuir ao HTML antigo o contrato financeiro da nova API mensal.
