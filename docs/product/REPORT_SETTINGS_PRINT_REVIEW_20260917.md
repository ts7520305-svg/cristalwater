# TASK246 — acesso ao relatório imprimível e revisão das configurações

## Estado e âmbito

A revisão começou sobre `946a01f389ab3b37371ece483e4bfee463173dae`, depois das TASK244–245. O ensaio `run-1789681864927`, concluído em 4501 ms em PGlite isolado, HTTP real e Chromium, reproduziu os defeitos abaixo. Era um diagnóstico com asserções dos comportamentos incorretos, não uma aprovação funcional.

A exposição do relatório mensal a perfis de cliente/campo e a interpretação de conteúdo como HTML foram corrigidas nesta TASK246. CI/restauro da árvore conjunta por confirmar. Os restantes pontos orientam a próxima implementação; esta revisão não declara o conjunto de configurações/PDFs concluído.

## Reproduções e tratamento

| Caso | Evidência reproduzida | Estado |
|---|---|---|
| Relatório mensal global acessível por CLIENT | JWT de um cliente real de QA; GET `/api/reports/monthly-print?monthRef=2099-04` respondeu 200 e incluiu a sentinela privada de outro cliente/documento. O router exigia apenas autenticação. | Corrigido: este endpoint exige ADMIN; CLIENT, TECHNICIAN e TEAM_LEADER recebem 403, incluindo tentativa de `role=ADMIN`. Ausência de token continua 401. |
| Parâmetro mensal interpretado como HTML | Mês com elemento `<b>` inerte respondeu 200 e apareceu sem escape no HTML. | Corrigido: mês explícito 2000–2199, filtro booleano textual opcional estrito, rejeição de parâmetros desconhecidos, duplicados ou objetos. Sem mês implícito. |
| Conteúdo guardado no HTML mensal | Leitura do template encontrou nome/contactos, instalações e método/notas de pagamento interpolados diretamente. | Corrigido: todos esses campos são texto escapado. Teste posterior usa HTML com imagens/scripts de QA e confirma texto literal, zero nós injetados, zero execução e zero pedidos externos. |
| GET de configurações cria dados | Cliente sem configuração: zero registos antes do GET, um depois; as 15 opções ficaram verdadeiras por defaults do esquema. | Pendente: leitura sem escrita e defaults únicos, explícitos e conservadores. O fallback do gerador PDF tem sete campos falsos, divergindo destes defaults. |
| Resposta atrasada de A gravada em B | Reter a resposta real de A, mudar o campo para B e libertar a resposta. Guardar alterou as 15 opções de B de falso para verdadeiro, com mensagem de sucesso. | Pendente: identidade do cliente confirmado, versão/sessão e invalidação de respostas antigas. |
| Guardar sem carregar | Página nova, escolher cliente com 15 opções verdadeiras e guardar os checkboxes iniciais vazios. As 15 opções passaram a falso. | Pendente: exigir leitura confirmada/revisão e confirmação recuperável do pedido. |
| Pré-visualização da visita sem autenticação | O botão abriu `/api/report-visit/visit/1?role=CLIENT` sem Authorization; a resposta foi 401. | Pendente: download autenticado, tipo esperado, feedback e contexto de sessão. Nenhum PDF foi gerado nesse caso. |
| Janela bloqueada apresentada como aberta | Resposta HTTP real de um relatório; `window.open` controlado devolveu null. A página continuou com uma única janela e mostrou «Relatório aberto.». | Pendente: confirmação de abertura ou alternativa de download visível. |
| Resposta do mês anterior abre depois da mudança | Reter resposta real de abril de 2099, selecionar maio e libertar. O conteúdo antigo chegou a `window.open`, com «Relatório aberto.». | Pendente: invalidar conteúdo por mês/filtro/sessão, prazo de rede e limpeza dos object URLs. |

Os cenários usaram apenas dados artificiais, serviços externos desativados e servidor/base locais. A perda de janela foi simulada na capacidade do navegador; a resposta do relatório veio da API real. Atrasos foram aplicados depois de obter a resposta real. Duas tentativas iniciais do diagnóstico tinham erros no próprio ensaio (restauro de checkbox após reload; uso de status como função numa resposta fetch) e não contam como aprovação.

## Contrato corrigido do imprimível mensal

`GET /api/reports/monthly-print` exige ADMIN, `monthRef=AAAA-MM` e, opcionalmente, `onlyRequiresInvoice=true|false`. Partilha a validação do período dos relatórios operacionais. Erros de consulta são 400 genéricos, sem devolver o conteúdo inválido. A resposta HTML e os erros do controlador têm `Cache-Control: private, no-store`.

A proteção aplica-se à rota mensal global. O relatório individual de visita conserva os controlos existentes de titularidade; o ensaio confirma que CLIENT e técnico da visita continuam a consultá-lo, enquanto outro cliente recebe 403. Não se mudou a autoridade para um parâmetro `role` fornecido pelo navegador.

Este lote não redefine os cálculos antigos do imprimível: seleção por monthRef, totais documentais guardados, instalações atuais e pagamentos associados ao documento continuam a precisar de revisão de fontes. O título «Clientes» ainda conta documentos. Não atribuir a este HTML o contrato de caixa/saldo/contagens da nova API ADMIN das TASK244–245.

## Validação e retoma

`scripts/test-field-monthly-print-access.js` usa a API real, contas CLIENT/TECHNICIAN/TEAM_LEADER/ADMIN, filtros, limites de mês, query strings ambíguas e um documento real de outro cliente. A resposta efetiva é analisada por Chromium com os oito campos textuais marcados. A ação de imprimir permanece disponível; leituras não alteram contagens de documentos, pagamentos, configurações ou relatórios.

O runner passa a 140 grupos, com 21 scripts no gate de navegador; não há migração ou novo recurso de frontend, e a cache permanece v69. A aprovação nativa final será registada após CI/restauro.

`run-1789682083504`: proteção do imprimível aprovada em 2886 ms, regressão da API mensal em 7687 ms e interface mensal em 10516 ms. Sintaxe aprovada em 544 JS backend, 179 frontend e 57 inline. Esta verificação usa schema bootstrap local; a prova de migração/restauro PostgreSQL fica no CI nativo.

Próximo lote: configurações por cliente com leitura sem escrita e gravação recuperável; abertura autenticada e validada de relatórios; depois revisão dos conteúdos, permissões e layout das saídas individuais/imprimíveis. A origem do PDF usa o papel autenticado e ignora `?role=CLIENT` para a apresentação ADMIN; isso é uma observação de código, não uma validação visual do PDF. O template HTML individual de visita também contém interpolações diretas e deve entrar nessa revisão.
