# Produtos da visita — TASK382

A seleção em `/technician-field-mode` identifica a linha exata da guia, mesmo com nomes e unidades repetidos. Nome, unidade literal, ID da guia e ID da linha seguem juntos no rascunho, pedido offline, registo da visita e movimentos de stock. Trocar de produto atualiza a unidade. As opções distinguem as linhas antes do nome; a unidade selecionada fica visível e não é editável livremente.

## Validação e compatibilidade

Linhas incompletas, quantidade vazia/zero/negativa e unidade ausente deixam o rascunho intacto e mostram um erro. Não são eliminadas silenciosamente nem recebem `UN` por omissão. Linhas do rascunho antigo sem identidade continuam visíveis, com quantidade e notas conservadas; o técnico precisa de selecionar explicitamente o produto antes de concluir. A gravação redundante ao sair da quantidade foi removida para não desativar o botão durante o clique de conclusão.

O servidor confirma os IDs e o nome/unidade exatos dentro da guia bloqueada. Um ID desatualizado ou incompleto nunca faz recuar para a primeira linha com o mesmo nome. Pedidos antigos sem IDs continuam aceites quando o par nome/unidade identifica uma única linha. Ambiguidade exige revisão; não é resolvida por ordem de inserção.

Quantidades de várias linhas para o mesmo material são somadas antes do débito. A soma decimal evita acrescentar o erro binário de `0.1 + 0.2`; os saldos existentes não são reescritos ou convertidos. A conclusão normal e extra mantém os contratos de repetição do pedido original.

## Correções

O serviço comum compara o consumo anterior, o pretendido e o histórico da viatura, associando-os à linha da guia original. Ajusta apenas a diferença, com os dois movimentos e a visita na mesma transação. Trocar uma quantidade entre duas linhas idênticas continua a ser uma alteração real. Guia encerrada, histórico divergente, unidade ambígua e saldo insuficiente impedem alterações parciais. Na visita normal, os registos químicos e o JSON também têm de concordar.

O editor da visita extra conserva os IDs no rascunho e no pedido; nome e unidade de linhas identificadas são só de leitura. Não há reconciliação automática de registos históricos ambíguos. O formato anterior continua disponível para linhas sem ID, sujeito à confirmação única no servidor.

## Verificação

- 1023 testes unitários em 119 ficheiros, incluindo 28 novos. Sintaxe: 690 backend, 303 frontend e 44 scripts inline.
- Seis grupos locais distintos aprovados: identidade na API, identidade no navegador, rascunhos modernos, execução extra, correção extra e fluxo mensal real. O fluxo mensal concluiu 54 visitas e confirmou 60 consumos químicos/movimentos.
- Nas duas modalidades: quatro repetições concorrentes, correção da linha original, saldo insuficiente, unidade ausente, identidade inválida e recuperação da resposta perdida sem duplicar o débito.
- Navegador real: português, inglês, francês, espanhol e alemão; 320/390/1440 px; 15 capturas, ausência de transbordo horizontal, controlos com pelo menos 44 px e centros desobstruídos após deslocação. Inspeção visual PT390, DE320 e PT1440.
- O ensaio geral `test-field-e2e.js` ficou bloqueado no logótipo antes de chegar aos produtos do técnico: o binário já controlado pelo Git está indisponível no checkout local parcial. As outras duas personas passaram. Este ensaio não conta como grupo aprovado, e a asserção original foi conservada no CI.

A base local é PGlite 0.5.8/pglite-socket 0.2.11, apenas com dados sintéticos e integrações externas desligadas. Não substitui PostgreSQL nativo/restauro. [Evidência local](evidence/20260926_task382_local.json). Cache v193; documentos v3; runner de 297 grupos distintos; nenhuma migração nova.

TASK380 terminou 294/294 grupos, com 293 aprovados e a mesma falha da fixture ADMIN (`15 != 2`), corrigida na TASK381. Restauro ignorado; gate não aprovado. [Evidência nativa](evidence/20260926_task380_ci_failed.json). TASK381 permanece em execução na última consulta.

## Continuação

Confirmar os gates nativos e o restauro. Rever o registo antigo de produtos em `/technician`, que ainda usa uma caixa de texto, e a coerência dos seus pedidos com a seleção estruturada. Depois, seleção/pesquisa em guias extensas, conciliação histórica acompanhada pelo escritório, limites dos alertas, cópias/VPS e piloto físico. Sem merge, implantação ou contacto com clientes reais.
