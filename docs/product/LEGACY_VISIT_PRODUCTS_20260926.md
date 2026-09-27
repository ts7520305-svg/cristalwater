# Produtos no formulário antigo — TASK383

O formulário de `/technician` passa a selecionar os produtos pela linha exata da guia atribuída ao técnico. Nome e unidade literais, quantidade, notas, ID da guia e ID da linha seguem para o pedido de conclusão existente. Linhas com nomes/unidades iguais continuam distintas; a unidade muda com a seleção e fica só de leitura. Quantidades incompletas, zero/negativas, identidade desatualizada e soma superior ao saldo impedem a preparação do pedido sem apagar o rascunho.

## Conservação e revisão

O formato v1 dos seis campos do rascunho permanece compatível. O campo de produtos continua a ser uma string e contém uma lista estruturada ou, após conversão explícita, um envelope com a lista e o texto original integral. O texto livre anterior aparece para revisão; não se inferem produto, quantidade ou unidade. JSON desconhecido ou malformado também permanece como texto original. Listas antigas sem IDs conservam nome, unidade, quantidade e notas, mas exigem nova seleção antes da conclusão.

O original fica conservado **no rascunho deste dispositivo**, incluindo depois da conclusão. A indicação é visível na página. O pedido enviado ao servidor contém a lista normalizada, sem o envelope local. Pedidos antigos já preparados mantêm o respetivo conteúdo/UUID e o contrato anterior; este trabalho não reescreve filas históricas nem reconcilia consumos ambíguos. A correção de visitas concluídas continua no percurso próprio.

A nova lista participa no mesmo bloqueio de pedidos preparados, visitas concluídas, diferenças do servidor e conflitos entre janelas. A revisão mostra produtos legíveis e texto literal. A gravação continua a confirmar os bytes guardados, com falhas de quota/concorrência visíveis.

## Guia e funcionamento offline

A consulta partilhada pelos formulários usa as projeções privadas de `/api/guides/vehicles` e `/api/guides/stock/:id?includeMovements=false`. Confirma conta, técnico, viatura, guia, linhas, totais e cabeçalhos antes de apresentar dados. A cópia local fica ligada à conta, técnico e dia de Lisboa, com instante da consulta. Não contém o token.

Online, cópia guardada, indisponibilidade, falta de atribuição e ausência de guia são estados distintos. Uma resposta de acesso recusado não reutiliza o stock anterior. Cópias ilegíveis são preservadas sem apresentação ou substituição silenciosa. Troca de conta/dia suspende o editor; respostas atrasadas não podem repintar ou gravar os dados da conta anterior. Web Locks e ordem de início das consultas coordenam a gravação da cópia.

O servidor continua a confirmar identidade/saldo ao receber uma conclusão offline. O ensaio perdeu uma resposta após o commit e recuperou o UUID original: um débito na terceira linha duplicada, um registo em cada um dos dois movimentos e uma auditoria, sem tocar na outra linha equivalente.

## Apresentação e verificação

- 1040 testes unitários em 120 ficheiros, incluindo 17 novos; sintaxe 690 backend, 305 frontend e 44 scripts inline.
- Três grupos locais distintos aprovados: produtos antigos, rascunhos antigos e recuperação da rota antiga. O grupo novo foi repetido integralmente após ajustar as capturas.
- Texto antigo, seleção de linhas/unidades repetidas, quantidade inválida, soma de linhas, recarregamento offline real, JSON anterior sem IDs, cópia corrompida, acesso recusado, unidade alterada, perda de resposta e troca de conta durante uma consulta.
- Lista de produtos em PT/EN/FR/ES/DE, 320/390/1440 px; 15 capturas. Geometria a 1100 px de altura, alvos de pelo menos 44 px e centros desobstruídos após deslocação; capturas a 1600 px para acomodar a secção integral fora dos menus fixos. Inspeção PT390, DE320 e PT1440. O seletor traduz esta secção; a página antiga e os erros partilhados de validação continuam em português.
- Corrigida a animação global do `body`: a mudança de largura animava o recuo do conteúdo e colocava o formulário sob o menu lateral. Agora só as cores transitam.
- Preparação inicial corrigida: comparação unitária de ordem de propriedades JSON, chamada a um tradutor global inexistente na página e sobreposição durante a transição de largura. Nenhuma destas tentativas é contada como aprovação.

A base local é PGlite 0.5.8/pglite-socket 0.2.11, com dados sintéticos e integrações externas desligadas. Não substitui o gate PostgreSQL nativo/restauro. [Evidência local](evidence/20260926_task383_local.json). Cache v194; documentos v3; runner de 298 grupos distintos; nenhuma migração nova. Inventário: 126 HTML, 114 com referência literal em QA, zero recursos ausentes e duas referências Git indisponíveis localmente.

## Validação anterior confirmada

TASK381: 295/295 grupos distintos aprovados, 17 etapas concluídas e restauro de 128 tabelas/47 ficheiros com linhas e hashes iguais. [CI 36231076835](https://github.com/ts7520305-svg/cristalwater/actions/runs/36231076835), [evidência](evidence/20260926_task381_ci.json).

TASK382: 297/297 grupos distintos aprovados, 17 etapas concluídas e o mesmo restauro confirmado. [CI 36232927811](https://github.com/ts7520305-svg/cristalwater/actions/runs/36232927811), [evidência](evidence/20260926_task382_ci.json). Os resultados corrigem o estado pendente dos pontos de situação anteriores, sem alterar o registo histórico das tentativas que falharam.

## Publicação

TASK383 pronta para publicação na branch `work/field-readiness-20260915-simulation`. O gate nativo de 298 grupos e restauro desta alteração ainda não está confirmado.

## Continuação

Confirmar o CI/restauro desta publicação. Rever pesquisa e seleção de produtos em guias extensas, incluindo estabilidade da linha escolhida ao filtrar, atualizar e recuperar offline. A localização integral da página antiga, conciliação histórica, limites dos alertas, cópias/VPS e piloto físico continuam abertos. Sem merge, implantação ou contactos reais; aplicação não declarada completa.
