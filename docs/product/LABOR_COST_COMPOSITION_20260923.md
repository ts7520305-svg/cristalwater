# TASK300 — bases compostas de custo do trabalho

## Resultado e âmbito

A página ADMIN `/labor-cost-bases`, ligada às despesas e à navegação financeira, reúne entre duas e vinte despesas manuais da categoria trabalho/salários. Cada documento precisa de uma base individual confirmada. Técnico, primeiro/último dia e minutos pagos têm de coincidir em todas as parcelas. A composição soma os valores dos documentos e conta o tempo pago comum uma única vez.

O utilizador consulta os documentos, revê a composição e confirma uma justificação. Não são inferidos encargos, percentagens, taxas salariais ou repartições de documentos de vários técnicos/períodos. O montante integral de cada documento é a sua contribuição para a base. Documentos com períodos ou tempos diferentes precisam de correção explícita antes de serem reunidos.

A composição é imutável, com fontes, técnico histórico, autoria, motivo e impressão. Uma composição idêntica não pode ficar ativa duas vezes. Conjuntos parcialmente sobrepostos são permitidos, conservando os limites das despesas originais. A composição não cria outra despesa, pagamento, transferência ou fatura.

## Valorização conjunta e cêntimos

Uma base confirmada valoriza o tempo completo de uma visita REGULAR/EXTRA ou de um intervalo declarado de reparação da TASK298. Reparações mantêm a prova autenticada, cliente original, identidade do intervalo e validações da TASK299. A escolha do serviço e do intervalo é explícita; alterar o contexto invalida cálculo e consentimento.

Cada parcela usa o valor do respetivo documento dividido pelos segundos pagos, multiplicado pelos segundos do serviço. Cada resultado é arredondado em cêntimos, e a última utilização de todo o tempo pago recebe o saldo exato desse documento. O custo conjunto é a soma dessas parcelas. Não se arredonda uma taxa agregada para depois repartir diferenças implicitamente. Uma parcela que não produza um cêntimo positivo dentro do saldo disponível recusa toda a operação, identificando a despesa a rever; não se omite uma parcela nem se perde a sua reserva de tempo.

As parcelas são `ExpenseAllocation` das despesas originais. Visitas, reparações, valorizações isoladas, composições sobrepostas e repartições manuais partilham os mesmos saldos monetários; as valorizações partilham também o tempo pago de cada documento. O serviço/intervalo conta uma única vez na reserva da medição, mesmo tendo várias parcelas. O mês do custo continua a ser o mês UTC da execução do serviço, podendo diferir do mês do documento/período pago.

## Atomicidade, histórico e revisão

O comando bloqueia todas as despesas por ID antes da base e dos bloqueios existentes do serviço/intervalo. Calcula todas as parcelas antes de inserir reservas e relê versões, fontes e saldos dentro da transação. O primeiro documento reserva a chave global de trabalho; os restantes usam chaves de parcela verificadas por restrições SQL. Assim, outra composição ou despesa isolada não pode valorizar simultaneamente a mesma medição. Um grupo, todas as atribuições, ligações, incrementos de versão e recibo são gravados juntos.

`LaborCostBasis`, `LaborCostValuation` e `LaborCostValuationPart` conservam a composição, o cálculo e as identidades das parcelas. As fotografias existentes de fontes e destinos mantêm as suas impressões; a associação ao grupo fica numa propriedade separada da fonte. A tabela de ligações permite detetar parcelas alteradas ou cuja associação na fotografia desapareceu.

A anulação individual de uma parcela composta é recusada. O histórico da despesa encaminha para a composição, onde se revê e anula todo o grupo, com motivo e consentimento. A transação liberta todas as chaves e saldos e preserva o cálculo original. A composição só pode ser anulada depois das suas valorizações. Para corrigir fontes, anulam-se os grupos e a composição necessários e cria-se novo histórico.

Alterações de documentos, bases, intervalos, execução, reservas ou registos propagam a revisão a todas as parcelas afetadas, mesmo quando se consulta apenas uma das despesas. A conferência verifica associação completa, fotografias, fontes atuais, quantidades, cálculo, cêntimos e limites. Totais com parcelas por rever deixam de ser apresentados como custo confirmado. A remoção da reparação conserva os identificadores históricos e permite a anulação conjunta. Alterar o nome atual do técnico não substitui o nome histórico confirmado.

## Recuperação e interface

Comandos usam UUID, conta ADMIN, recurso, conteúdo e recibo durável em `FieldWriteRequest`; recusas de contexto alterado também ficam guardadas. Repetir recupera exatamente o mesmo resultado. A leitura de recibos verifica conta, âmbito, recurso e impressão. A autenticação administrativa é aplicada nas rotas e revalidada dentro dos comandos.

O navegador grava o pedido original em IndexedDB antes do POST, coordena janelas por conta e permite consulta/reenvio explícitos. A perda de resposta depois de gravar no servidor é recuperada após recarregar, sem nova operação. O recibo é validado contra a composição, destino, fontes, cálculos e parcelas revistos; recalcular apenas as impressões externas de um resultado adulterado não o torna aceitável. Leituras atrasadas e mudanças A–B–A de contexto/sessão não restauram seleções antigas. A mudança de conta limpa os dados apresentados. O rascunho conserva documentos e justificação, sem consentimento.

Os relatórios existentes recebem os custos através das parcelas originais, incluindo Gestão com IA e consulta por execução. A contagem de atribuições continua a contar parcelas/documentos; não representa o número de intervalos. Custos/receitas completos e margem permanecem em aberto. Resumo de valorizações v3 preservado; cache v116, sem dependências novas.

## Migração e verificação

A migração 32 acrescenta três tabelas (125 no total), ligações únicas, restrições de estado e a forma das reservas compostas. Conserva atribuições, recibos e intervalos anteriores sem backfill. As restrições anteriores de fonte/intervalo continuam aplicáveis às reparações.

Validação local em PGlite e Chromium 149:

- API: identidade/período/tempo comum, composição duplicada, arredondamento e saldos finais, recusa de parcela inferior a um cêntimo, orçamentos manuais/isolados/compostos, disputa entre documentos partilhados e conjuntos independentes, pedidos concorrentes e recuperação exata.
- Falhas forçadas depois da primeira parcela, na atualização de versões e antes do recibo revertem todo o grupo. Anulação conjunta também reverte perante falha. Revisão propaga-se entre despesas e mantém histórico após anulação do intervalo ou remoção da reparação.
- Navegador: escolha explícita, revisão, consentimento invalidado, pré-visualização de outro cliente e recibo adulterado recusados, resposta perdida/recarregamento/consulta exata, anulação, escolhas REGULAR/EXTRA tipadas, leituras e sessão A–B–A, texto literal e visual móvel/escuro.
- Regressões API/UI de atribuições de despesas, valorização de visitas, materiais e trabalho de reparações aprovadas. 401 unitários/64 ficheiros; sintaxe 596 backend/198 frontend/62 inline; 32 migrações preservam dados e coincidem com o modelo.

Logs locais `/tmp/cw300-api.log`, `/tmp/cw300-ui.log`, `/tmp/cw300-final.log`, `/tmp/cw300-regression.log`, `/tmp/cw300-migrations.log`, `/tmp/cw300-unit.log`, `/tmp/cw300-syntax.log`; imagens revistas em `/tmp/cw-labor-composition-qa/`. O ensaio local não substitui a confirmação dos 199 grupos e do restauro em PostgreSQL 16 da versão publicada.

## Publicação e continuidade

Base `a5c9677558d29403a98626eef297730a4a4330a0`, branch `work/field-readiness-20260915-simulation`. Principal `feature/technicians-v25` preservada em `6f27081e1d183ff584a62255b016b373836734db`. Publicação/CI nativo por confirmar neste registo local; fecho só depois de conferir todos os grupos e o restauro. Sem merge, instalação no VPS ou contactos reais.

Próximo: restantes gastos operacionais, correção explícita das divergências de período e restantes origens/ajustes de receita. Repartir documentos de vários técnicos/períodos continua a exigir um modelo explícito. IVA/emissão fiscal externos, valores e frequências por cliente/época; revisão histórica, volume, fornecedores e piloto físico continuam pendentes. Esta tarefa não declara prontidão global de produção.
