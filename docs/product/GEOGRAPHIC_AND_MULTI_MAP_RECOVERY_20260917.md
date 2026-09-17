# TASK234–235 — Áreas geográficas e visitas por técnico

## Defeitos confirmados e alteração

`/map` anunciava «Zonas atribuídas» depois de apenas escrever na consola. Obtinha técnicos pela presença GPS e repartia todas as piscinas, incluindo coordenadas ausentes convertidas implicitamente em zero. Não existia escrita de atribuição. A página passa a consultar piscinas ativas pelo contrato existente e a apresentar uma pré-visualização explícita de quatro áreas pelos pontos médios das coordenadas. Cada piscina localizada pertence exatamente a uma área; pontos nas linhas médias pertencem à metade sul/oeste. Coordenadas ausentes ou inválidas ficam fora da divisão e continuam visíveis. Não se desenham retângulos degenerados. Contagens e classificação por piscina funcionam sem mapa. Retirar áreas conserva a lista; atualizar invalida a pré-visualização antiga.

Não foi criada atribuição automática. O percurso para atribuir trabalho continua em `/admin-rounds`, com técnico, ronda, datas e revisão; existe ligação explícita. A divisão geográfica não é uma avaliação de estradas, tempo de trabalho ou disponibilidade, nem representa zonas guardadas.

`/multi-map` chamava `/api/routes/multi-profit-route`, inexistente. Agora usa `/api/technician/today?date=...` como ADMIN e confirma dia, âmbito global, lista completa, contagens, ausência de paginação pendente, tipos REGULAR/EXTRA e identidades. O filtro local por técnico usa ID, inclui sem responsável e não confunde homónimos. Visitas regulares e extra com o mesmo ID continuam distintas. A consulta existente inclui planeamento ou atividade no dia, exclui canceladas/arquivadas e não depende do planeador de lucro antigo. Nomes nulos de piscinas têm identificação pelo número; visitas sem piscina permanecem visíveis sem navegação.

O mapa mostra piscinas das visitas, sem ligar pontos como se fossem uma rota aprovada ou posições GPS dos técnicos. O estado operacional e o responsável aparecem na lista e nos popups. Não apresenta lucro nem altera atribuições. As fontes/custos financeiros e o planeador antigo continuam pendentes.

Ambas reutilizam o carregamento opcional de Leaflet e CSS, lista com navegação por destino, coordenadas estritas incluindo zero, texto literal e invalidação por conta. O carregamento tardio do mapa conserva a área/filtro atual; atualizar ou mudar o dia elimina resultados e camadas antigos. O controlador comum passa a limitar consultas a 20 segundos, recuperando o botão de atualização perante uma ligação que não termina. Falha de tiles mantém a lista utilizável. Cache v63; nenhum backend ou esquema alterado.

## Validação local

- `run-1789666135225`: áreas reais/API/base, casos geométricos controlados, recursos externos retidos, recuperação, nenhuma atribuição escrita, três larguras e regressão TASK233 aprovadas.
- `run-1789666470821`: áreas e regressão TASK233 aprovadas na versão conjunta. A primeira execução do novo teste multi passou os contratos reais e a apresentação, mas o próprio ensaio tentou retirar um intercetor enquanto ainda cumpria uma resposta tardia. Execução global falhada, não usada como aprovação.
- `run-1789666519947`: multi aprovado após o ensaio aguardar explicitamente o fim da resposta retida; nenhuma asserção removida.
- `run-1789666581869`: multi final aprovado com mapa controlado e navegação partilhada nas oito páginas/quatro larguras/quatro perfis. Filtro retira marcadores do técnico anterior, inclusive quando a seleção nova não tem coordenadas. Popups literais, falha de tiles e mudança de dia exercitados.
- Multi confirma os dados reais de ADMIN, visitas regulares/extra com ID igual, homónimos, sem técnico/piscina, visita concluída, cancelada e outro dia. Respostas parciais, de outro dia/técnico, 202/503, duplicadas e inválidas são recusadas. Uma resposta controlada completa com 305 registos é integralmente apresentada; a cobertura API acima de 300 já pertence à TASK221.
- Sessão alterada e data modificada durante resposta atrasada não reativam resultados. Prazo de consulta acelerado pelo relógio do ensaio verifica erro e repetição. Snapshots das piscinas/zonas/atribuições/visitas mantêm-se iguais; o endpoint diário conserva o seu evento operacional de leitura já existente.
- Capturas 320/390/1440 em `reports/field-visual/geographic-areas-1789666139382` e `reports/field-visual/multi-map-1789666523817`; revisão visual das versões móveis. Bibliotecas controladas verificam contratos, não disponibilidade real dos tiles/fornecedores.

Runner passa de 126 para 128 grupos; árvore publicada e restauro nativo confirmados abaixo. Permanecem `/profit-map`, `/api/routes/auto-plan` e `/technician-profit-dashboard`, além de traduções destes ecrãs, revisão dos restantes HTML/PDFs e ensaios físicos/VPS. Não declarar conclusão global.

Sintaxe final: 539 JS backend, 174 frontend e 63 scripts inline aprovados. Inventário: 101 HTML, 52 páginas com referências literais em 149 scripts ativos, zero recursos locais em falta ou divergências catálogo/guarda; referências estáticas não equivalem a cobertura integral.

## Confirmação nativa

TASK234–235 confirmadas no commit `8cd59cd3eb9842a82d4199eb9598a6250371b9d0`, árvore `2265d0e249946dc0efaa7b35ee1b622181683ff2`, CI `35254021003`: 128/128 grupos, 388 unitários/quatro técnicos, 21 scripts de navegador, 20 migrações, sintaxe de 539 JS backend/174 frontend/63 inline e restauro de 110 tabelas/32 ficheiros com linhas e hashes iguais em PostgreSQL 16. Áreas geográficas passaram em 3579 ms, multi em 5252 ms e regressão TASK233 em 5195 ms. Backup local `backup/task235-local-20260917`. O registo posterior altera apenas documentação; esta evidência pertence ao commit de código indicado.

Workflow: https://github.com/ts7520305-svg/cristalwater/actions/runs/35254021003.

A investigação financeira durante o CI encontra-se em `PROFITABILITY_SOURCE_REVIEW_20260917.md`; é diagnóstico pendente, não correção incluída nestes 128 grupos.
