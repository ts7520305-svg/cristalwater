# Materiais no modo de campo — TASK381

A consulta de materiais em `/technician-field-mode` conserva agora as linhas com nomes repetidos, quantidades zero, correções negativas e unidades literais. O consumo está identificado como utilização acumulada desde a abertura da guia. O saldo apresentado é o registado na guia, com a origem e data de consulta já existentes.

## Quantidades e unidades

Unidades em falta ou vazias aparecem como «Unidade não indicada»; nunca são convertidas em `UN` nem somadas. `L`, `l` e ` L ` permanecem grupos diferentes. Quantidades não confirmadas não são substituídas por zero ou pela quantidade inicial, e impedem a apresentação do total da sua unidade. Uma lista indisponível continua distinta de uma lista confirmada sem materiais.

Os totais incluem todos os materiais, explicitamente identificados, sem tentar descobrir químicos a partir do nome. Somam as representações decimais dos números recebidos, sem acrescentar arredondamento binário: `0.1 + 0.2 = 0.3`. Isto não altera nem corrige valores anteriormente gravados no servidor. Não há conversão de unidades, alteração de saldos, reclassificação ou escrita em movimentos.

As linhas de utilização incluem zero e valores negativos. Zero acumulado não é apresentado como prova de ausência de movimentos. Nomes e unidades mantêm o texto original e são escapados antes de aparecerem no HTML. As explicações novas estão disponíveis em português, inglês, francês, espanhol e alemão.

## Falha integrada identificada

A TASK378 terminou os 292 grupos esperados, com 291 aprovados e uma falha em `test-field-guide-read-scope.js`: a comparação administrativa esperava duas guias em toda a base, mas encontrou quinze. O serviço devolvia também os dados dos cenários anteriores, como permitido ao administrador. O teste passou a consultar a viatura própria do ensaio e a comparar todos os IDs esperados, incluindo os dois técnicos. Os controlos de acesso do técnico continuam intactos.

O estado remoto do job foi devolvido como `cancelled`; o passo da suite terminou com código 1, e o restauro foi ignorado. Não é uma aprovação nem uma mera expiração do tempo. [Evidência nativa](evidence/20260926_task378_ci_failed.json).

## Verificação

- 995 testes unitários em 118 ficheiros, incluindo 13 novos. Sintaxe: 689 scripts backend, 302 frontend e 44 inline.
- Quatro grupos locais distintos aprovados: simulação mensal por API, âmbito dos leitores de guias, materiais no navegador e resumo documental no navegador.
- A simulação mensal foi executada antes do teste de âmbito, deixando outras guias e movimentos na base. A nova comparação administrativa passou nessa condição, mantendo os controlos de permissões e a comparação de 19 modelos.
- O percurso de materiais exercitou oito linhas com nomes repetidos, unidades nulas/vazias/literais, negativos, zero, frações decimais e uma guia aberta anteriormente. Comparou 13 modelos antes/depois; zero escritas da consulta e ficheiro AT original inalterado.
- Cópia offline após recarregar, cópia v3 antiga com quantidades em falta, conservação dos bytes e recuperação online verificadas. Nenhum saldo foi inventado a partir da quantidade inicial.
- Cinco idiomas em 320/390/1440, contraste mínimo 4,5:1, ausência de deslocação horizontal e texto final desobstruído. Dezasseis capturas de materiais. A altura de captura foi ajustada para manter a navegação fixa fora do conteúdo; o grupo completo foi repetido.
- O resumo documental anterior manteve oito de 105 consumos, ligação aos 209 movimentos, validação de contagens, identidade, sessões e origem offline.

[Evidência local](evidence/20260926_task381_local.json). Ambiente sintético com PGlite 0.5.8/pglite-socket 0.2.11; não equivale à confirmação PostgreSQL nativa. Cache v192, documentos v3 e runner de 295 grupos. Nenhuma migração nova; 43 existentes. Inventário: 126 HTML, 114 com referência literal em testes, zero recursos locais ausentes e duas referências Git indisponíveis.

## Publicação

Publicada em `5aa50c57bddd28c2c0a1672fe78866a4fd6da2bf`, árvore `e3644312693c14d757328e955b0feafd4674b12d`, idêntica à preparada e validada localmente, na branch `work/field-readiness-20260915-simulation`. [CI 36231076835](https://github.com/ts7520305-svg/cristalwater/actions/runs/36231076835), job `108374223988`, em execução. Os 295 grupos PostgreSQL e o restauro ainda não estão confirmados.

TASK379 terminou com 292/293 grupos aprovados e a mesma falha administrativa; restauro ignorado ([evidência](evidence/20260926_task379_ci_failed.json)). TASK380 continuava em execução na última consulta. A falha da TASK378 só será considerada resolvida no gate nativo quando a versão corrigida passar o conjunto completo e o restauro.

## Retoma

Confirmar o conjunto exato de 295 scripts e o restauro da TASK381. Rever `productOptions`, `productStockByName` e `normalizedUsedProducts`: a seleção de produtos ainda usa nomes e unidades predefinidas, exigindo análise da ambiguidade de nomes repetidos, unidades e identidade offline em conjunto com o percurso de consumo revisto. A dimensão das listas, conciliação histórica, limites dos alertas, VPS/cópias e piloto físico permanecem abertos. Sem merge, deploy ou contactos reais. O sistema não é declarado completo.
