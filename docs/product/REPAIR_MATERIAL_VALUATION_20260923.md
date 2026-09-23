# TASK297 — materiais valorizados nas reparações

## Resultado e âmbito

Em Despesas e contas a pagar, a administração pode valorizar o consumo de uma reparação com uma linha da compra ligada à despesa. O cliente é o titular original da prova de execução, incluindo clientes históricos inativos; mudar o proprietário da piscina não desloca o custo. A quantidade, a compra e a justificação exigem confirmação explícita. O preço comercial da reparação não entra no cálculo.

A origem são exclusivamente os movimentos guardados numa prova autenticada de conclusão com materiais reservados. Não são usados movimentos de outra visita, outros movimentos da piscina nem estados administrativos de fecho. A prova tem de continuar válida e identificar unicamente os movimentos da reparação. Uma prova de execução sem materiais não cria consumo de valor zero; a valorização é recusada. A repartição manual da TASK296 continua disponível.

A seleção da compra confirma uma base histórica de custo; não demonstra por si só a rastreabilidade física do lote. São exigidos produto e unidade compatíveis, identificadores sem conflito, quantidades e custos válidos e data de compra não posterior à execução. Nenhuma tarifa atual, orçamento ou preço de venda substitui o documento. Não se inferem devoluções da reparação a partir de movimentos sem ligação à sua prova. Alterações à execução ou às fontes exigem revisão, anulação e novo cálculo.

## Quantidades, valores e persistência

São reutilizados os limites e o cálculo exato das valorizações existentes: quantidade medida disponível entre todas as compras, quantidade e cêntimos disponíveis na linha entre todos os serviços e saldo da despesa incluindo parcelas manuais e por rever. As quantidades usam seis casas decimais; o custo usa cêntimos e arredondamento exato, com o remanescente da base atribuído na última parcela. REGULAR, EXTRA e REPAIR com o mesmo identificador permanecem destinos distintos.

O cálculo conserva cliente, reparação, piscina, data UTC, identificador e impressão da prova, movimentos concretos, linha de compra e orçamento anterior. A fotografia de materiais da reparação tem versão 2; as fotografias existentes das visitas não são reescritas. Movimentos também ligados a uma visita, referidos por outra prova ou reservados numa valorização de outro destino retiram a confirmação.

O comando mantém versão da despesa, pedido por conta/UUID, orçamento, atribuição, evento e recibo atómicos. O bloqueio por reparação serializa valorizações de compras diferentes; os bloqueios do cliente histórico, reparação, prova e movimentos seguem a ordem da conclusão. A origem da compra e a despesa mantêm as suas proteções. A operação não modifica stock, execução, pagamentos ou faturas. Depois de apagar a origem operacional, a identidade histórica continua disponível para revisão/anulação.

A 29.ª migração substitui apenas a restrição de forma da valorização. Permite MATERIAL para REPAIR e conserva as restantes restrições e dados. LABOR continua limitado às visitas regulares/extra. Não há coluna, tabela, dependência ou preenchimento retroativo novo.

## Interface e leitura financeira

A reparação com prova de materiais e despesa de compra permite escolher Consumo valorizado por compra, rever a linha, indicar a quantidade e calcular. Montante e mês calculados ficam protegidos de edição; mudar a seleção invalida o cálculo e o consentimento. O tempo de reparação permanece desativado: ainda não existe duração medida confirmada suficiente para aplicar a base de trabalho. Rascunhos conservam escolhas, sem restaurar confirmação ou cálculo aceite.

A interface verifica tipo, cliente original, compra, período, prova, movimentos e impressões do cálculo e do recibo. Respostas incompatíveis não confirmam o pedido; a recuperação consulta ou reenvia o pedido original. Falhas de sessão limpam a apresentação. Texto livre permanece literal. Cache v113, larguras 320/390/1440 e modo escuro.

O custo é MATERIAL na consulta por mês de execução, separado da atribuição manual de compra. Os resumos das valorizações passam à versão 2 e identificam expressamente os movimentos da prova das reparações. A cobertura de tempo/consumo das visitas mantém o denominador REGULAR/EXTRA; o texto esclarece que movimentos sem visita podem ser consumos de reparações apresentados na consulta por execução. Não se soma compra, consumo e pagamento como custos adicionais.

Custos completos, duração de reparações, restantes gastos, base de trabalho composta e margem continuam por apurar. IVA e emissão fiscal são externos; preços/frequências dependem de cada cliente/época. Esta implementação não comprova execução física independente nem aprovação global de produção.

## Validação local e publicação

- API: prova autenticada, cliente original inativo e piscina transferida, exclusão de reparações sem materiais/legadas/pendentes, origem de compra de outro documento/produto/unidade/data recusada, mesmos identificadores entre três tipos, orçamento entre compras e serviços, remanescente exato de cêntimos, pedidos iguais e distintos concorrentes, falhas atómicas e recuperação do recibo.
- Alteração de preço comercial não altera o custo; mudança de consumo, ligação à visita, duplicação de uso da prova ou alteração da compra exige revisão. A revisão manual de um valor medido é recusada; anulação conserva o histórico, incluindo após apagar a reparação.
- Navegador: rascunho sem consentimento, cálculo e mês, dupla confirmação, resposta perdida/recarregamento, cliente adulterado no recibo, fontes inconsistentes mesmo com impressões recalculadas, resposta atrasada, custos por execução, anulação e isolamento da sessão. Conteúdo literal e apresentação móvel/escura.
- Migração: preservação integral de parcelas manuais, materiais/trabalho das visitas e comprovativos; forma nova aceita apenas depois da migração; trabalho de reparação e campos inválidos recusados; identidade manual/medida preservada após apagar a reparação; esquema final coincidente.

401 testes unitários/64 ficheiros e sintaxe 591/194/60 aprovados. 29 migrações aprovadas. API/UI novas e regressões de atribuição manual, valorização de visitas, despesas e Gestão com IA aprovadas localmente. Logs `/tmp/cw297-api.log`, `/tmp/cw297-ui-regressions.log`, `/tmp/cw297-final-regressions.log`, `/tmp/cw297-migrations.log`, `/tmp/cw297-unit.log` e `/tmp/cw297-syntax.log`. A validação local usa um adaptador PostgreSQL e Chromium 149. A concorrência nativa, os 193 grupos completos e o restauro foram posteriormente confirmados no CI PostgreSQL 16 da versão publicada, conforme a evidência abaixo.

Base `1046edbded5bd3486c979feca46f188e33d4755b`. Principal `feature/technicians-v25` conservada em `6f27081e1d183ff584a62255b016b373836734db`; sem merge, deploy ou contactos reais.

## Publicação e CI

Código publicado sem força em `79bdf567c451a39718509b4087d0f6c2218350f1`, árvore `1769e5c15cc9641ec9836bba9c47d06eb51aeaf3`, igual à validada localmente. Backup `backup/repair-materials-local-20260923` (`fa93e5213579d21228f858dc924adc8ef2cbce3f`). [CI 35827924005](https://github.com/ts7520305-svg/cristalwater/actions/runs/35827924005), job `107073676225`, aprovado em 23/09/2026: 06:41:22–07:07:10 UTC, 25m48s, 17 etapas aprovadas.

Logs completos conferidos contra a lista do runner: 193/193 grupos previstos distintos, todos com código zero e sem sinal; nenhuma falta, entrada inesperada ou duplicação. 401 testes unitários/64 ficheiros, quatro testes técnicos e gate geral do navegador aprovados. Sintaxe 591 ficheiros backend/194 frontend/60 scripts inline. 29 migrações aditivas preservam os dados anteriores e coincidem com o esquema atual.

API/UI de materiais de reparações aprovadas em 3197/11475 ms; atribuição manual de reparações 6907/11269 ms, valorização de visitas 3672/10764 ms, despesas UI 7177 ms, Gestão com IA 10014/28347 ms e valores por execução 20065/27187 ms. O restauro PostgreSQL 16 confirmou 121 tabelas e 46 ficheiros enviados, com linhas da base de dados e hashes dos ficheiros iguais.

Evidência completa em `evidence/20260923_task297_ci.json`. O fecho posterior altera apenas documentação e conserva a árvore do código, migrações e testes aprovados. Duração/trabalho de reparações, restantes custos e receitas, base de trabalho composta e correção explícita de períodos continuam em aberto antes de uma margem completa. Esta aprovação não abrange instalação no VPS, fornecedores reais ou piloto físico.
