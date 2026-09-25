# TASK349 — histórico de extras com origens conservadas

O histórico de extras passa a consultar páginas de 50 registos, pelo cliente guardado na visita. A mudança posterior do titular da piscina não transfere o histórico para esse cliente. A página distingue a marcação de faturação e o preço da visita de um montante documental ou pagamento confirmado. [Evidência local](evidence/20260925_task349_local.json).

## Comportamento entregue

- Nova consulta ADMIN `GET /api/billing/extras/history/page`, com pesquisa literal por nomes/IDs/notas, filtros de cliente/piscina e datas UTC. Contagem e página pertencem à mesma transação de leitura. Ordenação estável por data de marcação e ID; datas em falta aparecem no fim e são excluídas quando existe filtro de data.
- Só entram visitas com a marcação `billed=true`. Cliente, piscina, preço, notas, estado, modo comercial, data agendada e data de marcação vêm do registo. Nomes apresentados são atuais. A resposta identifica cliente ausente e divergência entre cliente da visita e titular atual da piscina. Nenhum cliente é inferido para preencher uma associação em falta.
- O preço original permanece acessível. A projeção em cêntimos usa a representação decimal exata, sem arredondar subcêntimos, valores minúsculos ou valores fora do limite representável. Preços negativos e valores que exigem revisão são explícitos. A apresentação monetária conserva os cêntimos, incluindo valores grandes e negativos inferiores a um euro. Não se apresenta soma global como saldo ou receita.
- A resposta contém titular administrativo, filtros, paginação e base de consulta verificados no navegador. Erro, vazio e página fora do intervalo são distintos. Respostas de outro titular, valores alterados, contagem/ordem incompatíveis e cabeçalhos incorretos são recusados. Falhas de dados retornam 503 sem detalhes privados.
- Filtros alterados invalidam os resultados até Atualizar. Cancelamento, respostas tardias, timeout, offline, histórico, mudança de conta e expiração limpam a vista privada ou obsoleta. Interface própria em PT/EN/FR/ES/DE, com idioma no endereço e recarga. Texto original é apresentado literalmente, sem executar HTML.
- A rota antiga `GET /api/billing/extras/history` mantém a estrutura agrupada de compatibilidade, mas agrupa pelo cliente da visita, conserva um grupo sem cliente e suporta piscina ausente. Falhas passam a 503; as duas rotas têm respostas privadas antes da autenticação. O total antigo permanece no contrato de compatibilidade e não é utilizado pela nova página.

## Validação

631 testes unitários em 88 ficheiros, quatro técnicos e sintaxe de 632 ficheiros backend, 231 frontend e 61 scripts inline aprovados. Três grupos integrados locais: histórico de extras, histórico administrativo de pagamentos e acessos administrativos antigos. O grupo de extras voltou a passar com a correção da rota antiga e a recusa de cabeçalhos divergentes.

O cenário cria 109 visitas: 105 de um cliente cuja piscina pertence agora a outro, três registos com associações em falta e um ainda não marcado como faturado. Verifica três páginas sem repetição, cliente original, nulos, preço grande, subcêntimos, valor minúsculo, zero, negativo, modo antigo, precisão de datas, limite diário UTC e pesquisa com `%`/`_` literais. Testa filtros inválidos, autenticação/perfis e erro de base de dados sanitizado. O navegador cobre paginação, cinco idiomas, filtros, respostas malformadas/tardias, offline/timeout, histórico, troca de conta e expiração. Todos os registos originais e as contagens de documentos, pagamentos, notificações e relatórios permanecem iguais.

15 capturas dos cinco idiomas em 320/390/1440 são regeneradas em `reports/field-visual/extra-history/`. Foram revistas amostras de alemão em 320, francês em 390 e inglês em 1440; os ensaios verificam transbordo horizontal. A evidência regista fontes, logs e capturas. Cache v161, runner com 248 grupos distintos, 40 migrações existentes. Sem alterações de esquema, dependências ou operações de escrita financeira.

Inventário: 115 HTML, 81 páginas com referência literal em 269 scripts ativos e 34 na fila de pesquisa. Referência literal não equivale a revisão universal de apresentação e comportamento.

## Estado e limites

Publicada em `ee8ca0dd9ccf51b038d7c1fba339a443b5c8b6e8`, árvore `246b13a34684d14bc7455ec0b2be8635f5f5c2c8`, idêntica à preparada e validada localmente. [CI 36108653641](https://github.com/ts7520305-svg/cristalwater/actions/runs/36108653641), job `107986874329`, aprovado: 248/248 grupos esperados distintos, 17 etapas e restauro de 127 tabelas/47 ficheiros com linhas e hashes iguais. [Evidência nativa](evidence/20260925_task349_ci.json). TASK347 confirmada em [246/246 grupos e restauro nativo](evidence/20260925_task347_ci.json), com 17 etapas, 127 tabelas e 47 ficheiros com linhas e hashes iguais. TASK348 confirmada em [247/247 grupos e restauro nativo](evidence/20260925_task348_ci.json) de 127 tabelas/47 ficheiros com linhas e hashes iguais.

A marcação e o preço do extra não são reconciliação com linhas de documentos nem prova de recebimento ou emissão fiscal. Cada página é uma nova consulta; não se congela todo o histórico entre páginas. A rota agrupada antiga permanece sem paginação e conserva o seu total de compatibilidade. A tradução cobre o conteúdo próprio; navegação comum/assistente mantêm revisão separada. Restantes critérios de páginas, históricos financeiros e produção continuam abertos. Sem merge, deploy ou contactos reais; aplicação não declarada completa.
