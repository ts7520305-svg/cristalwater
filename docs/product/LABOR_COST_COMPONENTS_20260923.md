# TASK304 — composição de parcelas de trabalho de vários documentos

## Resultado

O ADMIN pode juntar uma parcela confirmada de cada documento repartido e, se necessário, despesas inteiras não repartidas. A composição aceita de dois a vinte documentos diferentes, uma componente por documento. Todas as componentes têm de confirmar exatamente o mesmo técnico, período e minutos pagos. O montante da base soma apenas os valores escolhidos; o tempo pago não é multiplicado pelo número de encargos.

A mesma base valoriza visitas REGULAR/EXTRA ou intervalos declarados de reparações. Cada componente conserva documento, repartição e parcela originais, cálculo, arredondamento e saldo próprios. O mês do custo continua a ser o mês UTC de conclusão do serviço. Não cria documentos, pagamentos ou divisões automáticas de períodos.

## Integridade, compatibilidade e recuperação

- Novo preview só de leitura `POST /api/labor-cost-bases/component-preview` com `components: [{expenseId, laborPart}]`, por ordem crescente de documento. `laborPart: null` identifica documento inteiro não repartido; uma repartição ativa exige índice explícito. Técnico, datas ou minutos diferentes bloqueiam a composição, sem escolha automática.
- Candidatos `includeParts=true`, paginados por documento, apresentam as parcelas confirmadas e os respetivos nomes históricos. A consulta anterior e `basis-preview` com `expenseIds` mantêm o formato v1. CREATE aceita um dos formatos, nunca ambos.
- Bases, grupos e marcadores novos v2. Cada componente inclui a fotografia integral do documento e, quando repartida, a prova imutável da repartição, fingerprint e índice. A identidade ativa inclui documento/repartição/parcela; bases v1 e v2 de documentos inteiros partilham a mesma chave para impedir duplicação.
- Fontes v4/v5 das parcelas e v1/v3 dos documentos inteiros mantêm os seus formatos. O total original do documento não é confundido com o montante da parcela no cálculo. Limites de tempo/cêntimos por parcela, orçamento monetário global por documento e chave global da visita/intervalo continuam partilhados com valorizações isoladas e outras composições, em todos os meses.
- Exemplo ensaiado: parcelas de 100 e 30 cêntimos, ambas com três minutos pagos, produzem custos conjuntos de 43 + 43 + 44 cêntimos; os arredondamentos individuais são 33 + 33 + 34 e 10 + 10 + 10. Outras parcelas do mesmo documento conservam os seus próprios saldos.
- Gravação ou anulação de todas as componentes, versões e recibo na mesma transação. Não é possível anular isoladamente um custo composto, nem anular a repartição com custos ativos. Repetição do UUID recupera o mesmo resultado; falhas parciais revertem a operação inteira. Substituir uma repartição deixa as bases antigas por rever: não as redireciona para a nova repartição.
- Migração 35 altera apenas duas constraints de `ExpenseAllocation`, permitindo o marcador v2 ligado ao documento/repartição/parcela da fonte. Não acrescenta tabelas/colunas, não reescreve dados, bases nem recibos. O esquema mantém 126 tabelas.
- Interface identifica parcela escolhida, montante dessa parcela e total original. Mudanças de seleção invalidam cálculo e consentimento; rascunhos não recuperam consentimento. O evento `pageshow` limpa caixas de confirmação restauradas pelo navegador. Preview e recibos são validados por componente e contra o pedido original; hashes exteriores recalculados não legitimam trocar a parcela. Recuperação IndexedDB/Web Locks, resposta perdida, leituras tardias A–B–A e limpeza de identidade preservadas.

## Verificação

API e navegador novos em `test-field-labor-components.js` e `test-field-labor-components-ui.js`. Cobrem seleção estrita/permissões, composições mistas, provas v1/v2, identidade duplicada, pools distintos, uso isolado/composto partilhado, arredondamento/resto final, orçamento global, concorrência e replay, rollback, anulação conjunta, mudança de fonte/repartição, pagamentos originais, preview/recibo forjados, recuperação depois de recarregar, consentimento e privacidade. Visuais móveis a 390 px em claro/escuro, com nomes tratados como texto literal.

Verificação local aprovada: novos API/UI, regressões de composição anterior, repartição do trabalho, reparações, valorização de despesas, correção de período, consulta por execução e despesas de manutenções; 401 unitários/64 ficheiros. Sintaxe: 600 JS backend, 201 frontend e 62 inline. As 35 migrações preservam os registos e correspondem ao esquema. Runner 205 → 207 grupos; cache `cristalwater-field-20260923-v120`; sem novas dependências. Logs `/tmp/cw304-*.log`; visuais `/tmp/cw-labor-components-qa/`.

CI completo e restauro PostgreSQL 16 da versão publicada ainda por confirmar; a validação local não os substitui.

## Âmbito e próximos passos

Base `98911561c35cb51a83b70ba728312b425c6e8d01`. Publicação apenas na branch `work/field-readiness-20260915-simulation`, sem força; principal `feature/technicians-v25` preservada em `6f27081e1d183ff584a62255b016b373836734db`. Sem merge, deploy ou contactos reais.

Fecha a composição explícita de parcelas de documentos diferentes. Não divide automaticamente um intervalo entre períodos, não calcula encargos sem documento e não declara cobertura financeira completa. Restantes gastos, custos medidos próprios das manutenções, ajustes/descontos e origens de receita, históricos, volume, VPS/fornecedores e piloto físico continuam abertos. Custos/receitas completos e lucro permanecem por apurar; IVA e emissão fiscal externos, preços/frequências por cliente e época.
