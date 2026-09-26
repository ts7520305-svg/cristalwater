# TASK379 — Consulta completa das guias do técnico

## Comportamento

`/technician-guide` mostra a viatura atribuída, a obra aberta do próprio técnico, os seus materiais e todos os movimentos associados. O percurso mantém a entrada real no separador Viatura do modo de campo e os acessos à abertura, consumo, fecho e manutenção já sujeitos a revisão. TECHNICIAN e TEAM_LEADER funcionam por PIN ou User ligado; não é possível escolher uma viatura alheia nesta página.

Os movimentos deixaram de ser os últimos dez consumos embutidos no stock. A página consulta `/api/guides/movements` em páginas de 25, incluindo os diferentes tipos de movimento da obra, com total e filtro literal pelo tipo. Quantidades negativas, zero, unidades ausentes, notas e identificadores são apresentados sem substituir ausências por zero ou converter unidades. As datas são apresentadas no horário de Lisboa.

O servidor devolve os filtros aplicados e o maior ID da janela de consulta. As páginas seguintes conservam esse limite, e Atualizar inclui novas inserções. Total e página são lidos na mesma transação. Alterações e eliminações entre pedidos podem mudar os resultados; não se trata de uma fotografia histórica imutável. O limite e a posição continuam a ser validados estritamente.

A consulta de stock aceita agora `includeMovements=false`, devolvendo explicitamente `movementsIncluded:false`, uma lista de movimentos vazia e o total de materiais. Assim, esta página não descarrega todos os consumos antes de usar a API paginada. O contrato predefinido dos outros consumidores mantém os movimentos. Os materiais completos recebidos numa consulta são apresentados em páginas locais de 25, conservando duplicados, nomes, tipos, unidades, saldo inicial, saldo atual e utilizado.

Os documentos usam `cw-auth-download`: PDF da obra exata, PDF da AT associada à obra, ficheiro oficial protegido e PDF do seguro da viatura. O PDF AT gerado já não aponta implicitamente para a guia mais recente da viatura. A ausência de AT ou de ficheiro oficial tem texto próprio. O ficheiro antigo não revisto continua a ser descarregado como anexo inerte pelo serviço documental; os seus bytes não são transformados para permitir uma pré-visualização.

## Confirmação, sessão e apresentação

Respostas incompletas, listas com duplicados ou ordem incoerente, total/posição/filtros errados, identidade alheia, cabeçalhos privados ausentes, documento incompatível e campos privados nas relações não são apresentados como dados confirmados. Vazio, indisponibilidade, dados a rever, ausência de atribuição e ausência de obra são estados distintos.

A falha de movimentos limpa apenas essa consulta e conserva o stock confirmado, os documentos, o filtro e a página local dos materiais. Falha do stock limpa os dados e ações dependentes, conservando a seleção de viatura. Atualizações da atribuição voltam a confirmar os dados no servidor. Uma resposta antiga não substitui a consulta mais recente. Troca de conta, identidade local incoerente, expiração e suspensão limpam os dados e ações; o regresso à página suspensa consulta novamente.

A página não guarda dados operacionais numa cache própria. Sem rede mostra indisponibilidade e oferece o regresso ao modo de campo, onde existe a cache documental vinculada à conta e ao dia. Alterar idioma conserva a viatura, o filtro ainda não aplicado e a página dos materiais. Português, inglês, francês, espanhol e alemão cobrem o conteúdo revisto; a navegação partilhada conserva o seu âmbito de tradução e recursos.

A revisão visual corrigiu um conflito entre as cores do tema antigo e as superfícies claras. A página usa agora as cores do sistema de desenho de forma coerente. Texto e ações foram verificados com contraste mínimo de 4,5:1, controlos de pelo menos 44 px e larguras 320/390/1440. Dezasseis capturas finais, incluindo os movimentos. As duas referências Git indisponíveis no inventário continuam registadas separadamente da funcionalidade desta página.

## Validação

- 965 testes unitários em 116 ficheiros, onze novos; quatro testes técnicos. Sintaxe: 689 scripts backend, 300 frontend e 44 inline.
- Doze grupos locais distintos aprovados: leitores de campo API; nova página no navegador; âmbito documental no navegador; recuperação documental; abertura autenticada; abertura e fecho de obra no navegador; consumo e manutenção no navegador; entrada TEAM_LEADER; navegação/preferências; simulação mensal.
- 207 movimentos próprios percorridos integralmente, sem repetição, incluindo uma inserção durante a navegação que só aparece após Atualizar. Vinte e oito materiais percorridos em duas páginas, com nomes duplicados e texto HTML apresentado literalmente.
- Três PDFs reais abertos pelo leitor autenticado; ficheiro oficial antigo descarregado com bytes exatamente iguais. Permissões, resposta incompleta, cabeçalhos, documentos, filtros, duplicados, respostas atrasadas, suspensão, troca de conta e expiração verificados.
- Comparação de 19 modelos durante as leituras da API e 13 no navegador; zero escritas de API na consulta e bytes oficiais conservados. Quatro falhas SQL reais da API continuam verificadas.
- Preparação inicial corrigida: a fixture passou a indicar explicitamente km inicial zero; o teste do ficheiro antigo passou a confirmar a descarga inerte prevista pelo contrato; o token curto de teste passou a ter uma única definição de expiração. Os três logs iniciais foram preservados e identificados na evidência. Após a correção de contraste, o grupo integral da nova página voltou a passar.
- A simulação mensal criou cinco clientes, nove equipamentos, 54 visitas, 60 consumos, seis reparações e cinco faturas. O dashboard inclui também os clientes usados na preparação dos grupos anteriores.

[Evidência local](evidence/20260926_task379_local.json). QA local com PGlite 0.5.8/pglite-socket 0.2.11 e dados sintéticos, sem equivalência declarada ao PostgreSQL nativo. Nenhuma nova migração; aplicadas as 43 existentes, com 128 tabelas. Cache v190 e runner de 293 grupos distintos. Inventário: 126 HTML, 114 com referências literais em 314 scripts ativos, 12 sem referência literal, zero recursos ausentes e duas referências Git indisponíveis nesta cópia.

## Validação automática e publicação

A TASK377 terminou cancelada após cerca de 50 minutos, compatível com o limite de 50 minutos configurado no job. O log contém 283/290 scripts esperados, distintos e com código zero; faltam sete scripts e o restauro foi ignorado. Não é um gate aprovado. [Evidência da interrupção](evidence/20260926_task377_ci_interrupted.json) e [CI 36225374723](https://github.com/ts7520305-svg/cristalwater/actions/runs/36225374723).

O limite do job passa para 70 minutos. Todos os scripts, o limite individual de 120 segundos, a migração aditiva, os testes prévios e o restauro nativo são mantidos. O ficheiro YAML foi validado. A TASK378 continua em execução na última consulta: [CI 36226988288](https://github.com/ts7520305-svg/cristalwater/actions/runs/36226988288), job `108362806296`, 292 grupos/restauro por confirmar.

Publicada em `ced5c47835350d1501c69e9f2f296f988522d342`, árvore `932fac333d73ca09500152a45bf15c4b2639a6f6`, idêntica à preparada e validada localmente, na branch `work/field-readiness-20260915-simulation`. [CI 36228505903](https://github.com/ts7520305-svg/cristalwater/actions/runs/36228505903), job `108367008202`, em execução com orçamento de 70 minutos. O gate PostgreSQL nativo de 293 grupos e restauro permanece por confirmar.

## Retoma

Continuar no resumo documental do modo de campo: `renderMovements` ainda mostra apenas os últimos oito consumos, sem total nessa secção. Tornar explícito o resumo, ligar diretamente à consulta completa e rever coerência entre origem, contagem e dados offline. O novo leitor completo já está disponível na entrada «Consultar guias».

Escala real da consulta de materiais e da seleção de obras próprias, conciliação histórica, limites dos alertas, política operacional de cópias, VPS e piloto físico permanecem abertos. Sem merge, deploy ou contactos reais; aplicação não declarada completa.
