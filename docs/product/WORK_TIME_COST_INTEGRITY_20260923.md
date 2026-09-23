# TASK305 — impedir a valorização de tempo sobreposto

## Resultado

Uma visita REGULAR/EXTRA só pode ter o trabalho valorizado quando o técnico não tem outro intervalo de trabalho registado em simultâneo. A regra cruza visitas regulares, extras e intervalos declarados de reparação, mesmo com números iguais, outros clientes ou meses diferentes. As bases de uma despesa, parcelas repartidas e composições partilham esta verificação.

O problema foi reproduzido na base TASK304: o ensaio antigo aceitava 90 minutos de uma visita regular e 30 minutos de uma extra que começavam à mesma hora, para o mesmo técnico. Os cenários de regressão conservam os montantes e durações esperados, agora com horários distintos; os cenários próprios de materiais não declaram trabalho do técnico por arrasto.

## Regras e histórico

- Comparação de instantes UTC com intervalo aberto no fim: um serviço pode começar exatamente quando termina o anterior. Técnicos diferentes podem trabalhar em simultâneo.
- Intervalos fechados com duração positiva contam como tempo registado, incluindo estados de apresentação posteriormente alterados. Visitas sem fim só reservam tempo enquanto o estado normalizado é IN_PROGRESS, STARTED ou IN_EXECUTION. Planeamento sem execução, início em falta ou duração inválida não inventam trabalho. Intervalos de reparação anulados deixam de reservar tempo; o histórico permanece.
- Um leitor comum também preserva a verificação anterior dos intervalos de reparação. Pesquisa sem corte por cliente ou mês documental, agrupada por técnico e janela temporal. O índice por início e dois maiores fins distingue a própria origem e deteta intervalos longos que envolvam vários mais curtos. Não faz uma pesquisa a todo o histórico para cada parcela de visita.
- O preview é só de leitura. A confirmação volta a verificar as fontes atuais; pedidos que deixaram de ser válidos são recusados com resultado recuperável. Repetir o UUID não transforma uma recusa numa aceitação depois de corrigir a origem. Despesas/parcela/composição mantêm os mecanismos transacionais anteriores.
- Uma sobreposição registada depois da valorização coloca o custo em revisão nas consultas atuais, incluindo todas as componentes e totais financeiros. A API identifica RECORDED_TIME_OVERLAP e o ecrã explica que os horários precisam de revisão. Comprovativos, cêntimos reservados, pagamentos e fotografias originais não são reescritos. Se a origem do conflito for corrigida e os factos originais voltarem a corresponder, a verificação volta a confirmar o custo original.
- Materiais e atribuições manuais mantêm as suas regras: a deteção não reparte automaticamente minutos, não recalcula preços de venda e não retira pagamentos. A anulação explícita conserva o histórico, mesmo quando há sobreposição.
- Sem nova tabela, migração ou dependência. Mantém 35 migrações e 126 tabelas; fontes e recibos anteriores conservam formato. Cache v121.

## Verificação local

- Novo `test-field-work-time-costs.js`: REGULAR/EXTRA com o mesmo ID, clientes distintos, técnico diferente/inativo, adjacência e um segundo de interseção, atravessamento do mês, execução aberta/fechada/planeada, intervalos de reparação ativos/anulados, leitura sem escrita, pagamentos e recibos imutáveis, revisão posterior, pedido desatualizado/replay, parcelas de salários, composições, recusas concorrentes sem criação parcial e anulação histórica.
- Oito testes unitários do leitor comum, incluindo comparação com uma verificação independente de 1200 intervalos de doze técnicos, com durações curtas/longas, contenção e identidades distintas; falhas de leitura propagadas.
- Ecrã real das despesas: aviso, cálculo recusado, total por confirmar, pedido não enviado, factos anteriores preservados e recuperação após corrigir a fonte. Revisão visual em 320 px claro e 390 px escuro; restante interface em 320/390/1440 px.
- Regressões API/UI de valorização de despesas, tempos de reparação, composição de trabalho/documentos/parcelas, repartição por técnico e consulta financeira por execução aprovadas.
- 409 unitários em 65 ficheiros. Sintaxe: 601 JS backend, 201 frontend, 62 inline. Runner 207 → 208 grupos. Logs `/tmp/cw305-*.log`; imagens em `reports/field-visual/work-time-overlap-*`.

## Publicação e limite

Base remota `dbf55e767d169ab347fb4f135d2405a237c6630a`. Publicar apenas em `work/field-readiness-20260915-simulation`, sem força, e confirmar o CI completo e restauro PostgreSQL 16 da árvore publicada antes do fecho. Principal `feature/technicians-v25` preservada em `6f27081e1d183ff584a62255b016b373836734db`; sem merge/deploy/contactos reais.

A verificação usa o trabalho que está registado no momento da leitura/confirmação. Não certifica a presença física, não impede que outros percursos registem depois um horário incompatível e não corrige automaticamente tempos históricos. Esses casos ficam por rever nas consultas seguintes. Não prova cobertura financeira completa nem dimensionamento de produção. Custos medidos próprios das manutenções, restantes gastos/ajustes/origens de receita, históricos, volume, VPS/fornecedores e piloto físico continuam abertos; IVA externo e preços/frequências caso a caso.
