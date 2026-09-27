# Produtos na correção de visitas extra — TASK385

O editor de correção de visitas extra passa a selecionar produtos das guias originais comprovadas pelo histórico de consumo/devolução da visita. Não utiliza a guia atual da viatura como substituição. A consulta privada existente devolve uma projeção mínima das guias originais numa transação de leitura consistente, ligada à conta, visita, piscina e versão do registo.

## Seleção e revisão

Pesquisa por nome, unidade e ID exato com `#`, com páginas de 25 e seleção retida fora da página/filtro. Cada opção identifica a guia e a linha por ID; nomes, unidades, notas e quantidades mantêm os valores literais. Produtos com nomes/unidades iguais continuam separados. Uma unidade ausente fica visível mas indisponível para seleção; não se presume uma unidade nem se altera o saldo mostrado.

Adicionar produto cria uma linha vazia, sem escolher o primeiro resultado. Nome e unidade deixam de ser texto livre. Uma linha nova exige seleção exata e quantidade positiva antes da revisão. Os registos históricos sem IDs permanecem conservados, sem atribuição automática de identidade; alterações históricas continuam sujeitas às verificações do servidor. A revisão identifica a mudança de ID mesmo quando nome, unidade e quantidade são iguais.

A consulta não oferece produtos quando não há guia original, quando está encerrada ou quando mudou de responsável. Esses estados conservam os produtos guardados. Não criam uma nova relação histórica. A correção continua a ajustar apenas a diferença nos movimentos e no stock, com os recibos e controlos de concorrência existentes.

## Rascunhos, consulta e idioma

O rascunho v1 recebe uma cópia opcional do catálogo consultado quando o utilizador edita os dados. Mantém-se a leitura dos rascunhos anteriores sem esse campo: offline, os seus valores continuam disponíveis, mas a escolha de novos produtos precisa de uma consulta válida. Uma cópia existente mas ilegível ou de outro contexto bloqueia a edição sem substituir os bytes guardados.

A cópia válida permite pesquisar, selecionar e preparar a correção sem rede, com origem/data visíveis e verificação definitiva no servidor. A paginação limita as opções no ecrã; a consulta e a cópia do catálogo continuam completas e sujeitas à quota protegida do rascunho. Nenhum catálogo é acrescentado ao pedido de correção.

Pesquisar, paginar e mudar o idioma não gravam nem alteram o rascunho. A língua dos produtos é escolhida dentro do diálogo através do mecanismo da aplicação. A atualização visual ocorre quando a língua muda, evitando reconstruir os seletores por notificações repetidas da mesma língua. Ao fechar o diálogo ou mudar de conta/visita, os dados privados do diálogo são limpos; as respostas tardias não voltam a apresentá-los.

A secção dos produtos está em PT/EN/FR/ES/DE. Os restantes textos do diálogo — medições, checklist, motivo, revisão e mensagens gerais — ainda precisam de localização completa; não se declara o diálogo integralmente traduzido.

## Verificação

- 1073 testes unitários/122 ficheiros, incluindo 15 novos sobre o contexto, integridade da cópia, vários originais, unidades literais, escolhas exatas e compatibilidade histórica.
- Sintaxe: 690 ficheiros backend, 307 frontend e 44 scripts inline. Os ficheiros editados após a execução completa também passaram em `node --check`.
- Quatro grupos de integração distintos aprovados: produtos na correção extra, correções extra existentes, identidade de produtos no navegador e identidade/stock na API.
- 61 linhas percorridas sem omissões/repetições, em três páginas; guia mais recente excluída, duplicados, unidade nula, saldo negativo, pesquisa sem resultados e troca apenas de ID visível na revisão.
- Recarregamento offline real, rascunho v1 anterior sem catálogo, cópia corrompida conservada, consulta recusada/contexto errado sem reutilização, resposta atrasada após troca de conta e bytes do rascunho conservados ao pesquisar/traduzir.
- Correção confirmada após perda da resposta: uma devolução e dois consumos nas linhas originais, um recibo e uma auditoria; a guia mais recente fica intacta. Os grupos existentes verificam concorrência, versões antigas, reversão após falha obrigatória, conflitos entre janelas, quota e histórico ambíguo recusado.
- Cinco idiomas, larguras 320/390/1440, altura 1100: 15 combinações e 30 capturas do topo/fundo. Controlos de 44 px, centros desobstruídos após deslocação e ausência de transbordo horizontal. Inspeção manual de DE320 topo e PT1440 fundo.

Preparação dos testes: a propriedade DOM `disabled` é verificada diretamente nos elementos de opção/fieldset; a espera assíncrona usa o helper existente que aguarda o resultado booleano. O teste anterior de correções passou a aguardar a disponibilidade do editor/fila após recarregar, em vez da ausência de tráfego. As verificações de recibo, stock e preservação não foram removidas. Aprovação refere-se às execuções finais.

Base local PGlite 0.5.8/pglite-socket 0.2.11, Chromium 153.0.8010.0/Playwright 1.61.1, 43 migrações existentes, dados sintéticos e integrações externas desligadas. Não substitui PostgreSQL nativo/restauro. [Evidência local](evidence/20260928_task385_local.json). Cache v196; documentos v3; runner 300; nenhuma migração nova. Inventário: 126 HTML, 114 com referência literal em QA, zero recursos ausentes, duas referências Git indisponíveis localmente e zero diferenças de guardas.

TASK383 confirmada: [298/298 grupos](https://github.com/ts7520305-svg/cristalwater/actions/runs/36354384627), 17 etapas concluídas e restauro de 128 tabelas/47 ficheiros, com linhas e hashes iguais. [Evidência nativa](evidence/20260928_task383_ci.json). TASK384 também confirmada: [299/299 grupos](https://github.com/ts7520305-svg/cristalwater/actions/runs/36356317137), 17 etapas e restauro de 128 tabelas/47 ficheiros, linhas e hashes iguais. [Evidência nativa](evidence/20260928_task384_ci.json).

## Publicação

Publicada em 28/09/2026 (Europe/Lisbon) no commit `798cc6134478fa6e113c2abc326138484c478c03`, árvore `c04db9e0c3f0a269d0957da89ae5d5811de3707b`, idêntica à preparada e validada localmente, na branch `work/field-readiness-20260915-simulation`. [CI 36359031040](https://github.com/ts7520305-svg/cristalwater/actions/runs/36359031040), job `108732368488`, em execução. Os 300 grupos PostgreSQL e o restauro desta alteração ainda não estão confirmados.

## Continuação

Confirmar os CI/restauros e localizar os restantes textos do diálogo de correção extra em PT/EN/FR/ES/DE, preservando a revisão, os rascunhos e os envios pendentes. A localização integral das páginas antigas, conciliação histórica explícita, limites dos alertas, VPS/cópias e piloto físico continuam abertos. Sem merge, implantação ou contactos reais; aplicação não declarada completa.
