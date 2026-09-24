# TASK340 — Fiabilidade do registo diário administrativo

## Alteração

A página `/admin-service-log` apresenta explicitamente visitas regulares e o dia UTC escolhido. Datas impossíveis, opções duplicadas, identificadores não canónicos e parâmetros desconhecidos devolvem 400. A leitura permanece exclusiva de ADMIN, sem alterar permissões nem registos.

A consulta foi extraída para `dailyServiceLogService.js` e lê uma fotografia consistente numa transação `RepeatableRead`. Uma falha de fonte produz 503 sanitizado, sem inventar listas vazias. A resposta tem versão, identidade, dia, filtros, intervalo e cache privada. Os limites são detetados com uma linha adicional: a interface identifica resultados parciais e pede filtros mais restritos antes de usar os totais.

O cliente apresentado é o gravado na visita; nunca é substituído pelo atual titular da piscina. A alteração do titular fica assinalada. Os dados atuais da instalação e as associações deduzidas de guia/viatura são identificados como tal. Guias explicitamente ligadas através de movimentos podem ser anteriores ao dia consultado. Viaturas divergentes em movimentos ficam por confirmar. Materiais de extras com o mesmo ID numérico e movimentos com duas origens não se misturam com os da visita regular; estes últimos geram um aviso de revisão.

O total de concluídas exige um estado concluído; a simples presença de uma hora de fim não altera o estado. A linha do tempo inclui apenas eventos do dia UTC, distingue um fim registado de uma conclusão e apresenta o número de eventos visíveis, com carregamento de mais 250. Coordenadas zero válidas são conservadas. O GPS associado pelo email atual é identificado na resposta como tal e não é apresentado sob um filtro de viatura histórica que esse GPS não comprova.

A página confirma a sessão antes e depois das leituras, rejeita respostas incompatíveis e impede que pedidos antigos substituam a seleção atual. Falha de qualquer lista de filtros, rede indisponível, limite de 15 segundos ou mudança de conta limpa serviços, métricas, eventos e mapa. Uma consulta realmente vazia tem um estado próprio. O contraste usa as cores do sistema existente; a linha do tempo tem deslocação própria e acesso por teclado.

## Provas

- 600 testes unitários em 82 ficheiros e quatro testes de técnico aprovados.
- Sintaxe: 627 ficheiros backend, 220 frontend e 62 scripts inline.
- API real: acesso ADMIN/recusa CLIENT e TECHNICIAN, filtros/datas estritos, cliente original e ausente, guia anterior, viaturas divergentes, associação de materiais REGULAR/EXTRA, 501 visitas, falha sanitizada e igualdade das fontes antes/depois.
- Chromium: dados, vazio, parcial, erro, filtros indisponíveis, resposta incompatível, offline/repetição, timeout, resposta tardia, mudança de conta, nomes extensos, HTML tratado como texto e GPS zero. Larguras 320/390/1440 em PT-PT, imagens inspecionadas.
- O ensaio administrativo existente também passou, na mesma base após o novo ensaio. A fixture elimina apenas os seus próprios registos depois de conferir que as consultas não os alteraram. O extra fictício é explicitamente sem cobrança.
- Ambiente local isolado: PGlite, Chromium normal e 40 migrações aditivas. Sem alterações de esquema ou dependências. Cache v152. Runner com 237 grupos.

O primeiro ensaio identificou uma preparação de sessão indevidamente executada no iframe externo; a fixture passou a limitar a sessão à origem da aplicação. Conservou-se a exigência de zero erros de JavaScript. A inspeção visual inicial levou à correção do contraste, sem remover cenários de erro ou ocultar avisos.

O inventário tem 115 HTML, 77 páginas com referência literal em 258 scripts ativos e 38 páginas na fila de pesquisa. Referências literais não provam cobertura integral. A revisão visual deste lote abrange PT-PT; a tradução completa nos cinco idiomas e a revisão universal continuam abertas. As duas imagens de marca presentes no índice mas não materializadas nesta cópia local continuam identificadas no inventário.

## CI anterior confirmado

TASK337: [CI 36051791089](https://github.com/ts7520305-svg/cristalwater/actions/runs/36051791089), 234/234 grupos esperados distintos, 17 etapas e restauro de 127 tabelas/48 ficheiros com linhas e hashes iguais. TASK338: [CI 36053066253](https://github.com/ts7520305-svg/cristalwater/actions/runs/36053066253), 235/235 grupos esperados distintos, 17 etapas e restauro de 127 tabelas/46 ficheiros com linhas e hashes iguais. As evidências individuais conservam os nomes de todos os grupos e a comparação com o runner do commit correspondente. Estes resultados também confirmam a geração mensal concorrente em PostgreSQL nativo, que não era representável no executor PGlite local.

## Publicação e continuação

Base `70982c23c2f8b813a9d478de02c1198826ffa49b`. Preparada para publicação na branch `work/field-readiness-20260915-simulation`; CI e restauro deste novo código ainda por confirmar. [Evidência local](evidence/20260924_task340_local.json).

Continuar os resultados do CI e a fila finita de páginas, incluindo os critérios históricos, financeiros e multilingues ainda abertos. Sem merge, deploy, contactos reais ou alterações à produção. Esta tarefa não declara a aplicação completa.
