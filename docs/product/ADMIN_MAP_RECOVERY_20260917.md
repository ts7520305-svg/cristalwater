# TASK233 — Piscinas e sugestão de rota com consulta confirmada

## Defeitos confirmados

A triagem TASK229 e a leitura real `run-1789662888980` encontraram falha sem Leaflet e `/api/routes/optimize` inexistente. A página administrativa aceitava apenas array, embora `/api/pools` devolva `{ ok, pools }`. «Perto de mim» chamava outra rota inexistente (`/api/pools/nearby`); «Rota do dia» desenhava todas as piscinas, sem atribuição nem dia. Coordenada zero era omitida e uma nova carga podia conservar linhas antigas.

## Alteração

- `/admin-map` consulta as piscinas ativas pelo contrato existente. A proximidade usa localização atual e distância em linha reta, ordenada localmente; não é apresentada como rota atribuída.
- `/route-map` exige técnico e dia, consulta `/api/route/optimize` e verifica os cabeçalhos de âmbito e a identidade/estado dos registos. Explica que são visitas regulares planeadas, sem alterar o planeamento, sem trânsito/horários e sem incluir extras ou trabalho iniciado.
- Ambas mantêm lista utilizável quando falta Leaflet ou falham tiles. Coordenadas ausentes/inválidas ficam visíveis sem ligações de navegação; zero é válido. Piscinas sem nome têm identificação pelo número. Nomes e popups são texto literal.
- Navegação Google/Waze é explícita por destino. Uma linha de sugestão só é desenhada quando todas as visitas têm coordenadas; nunca atravessa silenciosamente um registo sem localização.
- Nova consulta limpa marcadores, linhas, lista e destinos antigos. Alterar técnico/dia invalida o resultado; GPS/respostas atrasadas não reativam a seleção anterior. Falhas HTTP, 202, respostas malformadas/duplicadas, vazio e sessão alterada são distintos.
- Mudança de conta aborta consulta e retira resultados, opções de técnicos e mapa, conservando o restante armazenamento. Os campos são geridos pela página, sem restauração genérica de seleções de outra consulta.
- A navegação respeita `data-cw-state-managed="manual"`: a heurística antiga podia converter «sem coordenadas» num estado vazio depois de os dados chegarem. O teste atrasa deliberadamente o script de navegação para cobrir essa ordem de carregamento.

## Validação

`run-1789664116657` aprovou API/Chromium/base reais, GPS recusado/atrasado, troca de seleção/conta, coordenadas zero/ausentes/inválidas, nomes literais, âmbito da resposta, nova consulta e estados vazios/falhados. A primeira execução e a segunda versão diagnosticaram uma corrida na classificação automática dos estados; não contam como aprovação.

`run-1789664178086` aprovou a versão ampliada com nome nulo e apresentação das duas páginas em 320/390/1440 px. Capturas revistas em `reports/field-visual/admin-map-1789664182531`. Navegação partilhada aprovada nas oito páginas/quatro larguras/quatro perfis existentes.

O ensaio com mapa indisponível usa API real e bloqueia todos os recursos externos. Um adaptador Leaflet controlado verifica substituição de marcadores, popups literais e recuperação de falha dos tiles; não comprova disponibilidade real do fornecedor. A sintaxe passou em 539 JS backend, 172 frontend e 65 scripts inline.

Cache v61; sem migração ou alteração de API. Runner passa a 126 grupos; inventário de 101 HTML, 50 páginas com referências literais em 147 scripts ativos e zero recursos locais em falta/divergências catálogo-guarda. Confirmar CI/restauro do commit publicado.

Permanecem por tratar `/map`, `/multi-map`, `/profit-map` e o painel de lucro por técnico, conforme `MAP_CHART_REVIEW_20260917.md`. Estes dois ecrãs mantêm português; GPS físico, redes móveis e serviços de mapas externos exigem ensaio de campo.
