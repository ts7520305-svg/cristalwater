# TASK303 — repartição de uma despesa de trabalho por técnico/período

## Resultado

O ADMIN pode confirmar entre duas e vinte parcelas explícitas de uma despesa manual de trabalho. Cada parcela identifica técnico, primeiro/último dia inclusivos, minutos pagos e montante em cêntimos. A soma tem de corresponder exatamente ao documento. Não há percentagens, divisão automática, criação de outras despesas ou alteração dos pagamentos.

Uma parcela confirmada pode valorizar o tempo registado de visitas REGULAR/EXTRA ou um intervalo declarado e confirmado de reparação. Técnico e período devem corresponder integralmente à parcela escolhida. O custo usa o montante e minutos dessa parcela, mantendo na prova o total e a identidade do documento original. O mês do custo continua a ser o mês UTC de conclusão do serviço, não o mês do documento ou período pago.

## Integridade e recuperação

- Migração 34 aditiva: tabela `ExpenseLaborDistribution`, FK restritiva para a despesa e uma repartição ativa por documento. Fotografia versionada com parcelas ordenadas, nomes históricos, fingerprint e razão. Anulação conserva fotografia, data, autor e motivo; outra repartição exige nova confirmação. Não altera bases, atribuições nem recibos anteriores.
- Montantes inteiros positivos e períodos reais; minutos positivos limitados pelos dias pagos. Parcelas do mesmo técnico não podem sobrepor dias; técnicos diferentes podem partilhar datas. Para salário e encargos coincidentes em documentos distintos continua disponível a composição da TASK300. Um documento repartido não entra inteiro numa composição; composições antigas ficam por rever.
- Enquanto a repartição está ativa, a base antiga de um técnico fica preservada mas não é usada; mudar essa base ou valorizar sem escolher parcela é recusado. Não se pode criar repartição com valorizações ativas nem anular repartição enquanto existirem custos de trabalho ativos. A anulação histórica continua disponível depois de cancelar o documento, respeitando as regras anteriores dos pagamentos e custos.
- Orçamento de tempo e cêntimos por parcela, partilhado entre visitas e reparações; orçamento monetário global do documento, partilhado com atribuições manuais e todos os meses. Cálculo inteiro e último resto exato por parcela: por exemplo, 100 cêntimos/3 minutos resulta em 33 + 33 + 34, sem usar o saldo de outro técnico/período.
- Chave global da medição mantém-se: uma visita/intervalo não é valorizada novamente noutra parcela, despesa ou composição. Não reparte implicitamente um intervalo que atravessa períodos; deve ser corrigido explicitamente na origem. Fontes da valorização v4 (visitas) e v5 (reparações) incluem a prova integral da repartição. Fontes antigas v1/v3 mantêm formato e recuperação.
- Documento, versão, repartição/custo e recibo na mesma transação; preview atual e bloqueios de despesa, serviço e técnico confirmados. UUID repetido recupera o mesmo resultado, incluindo recusas. Falhas na auditoria/versão revertem a operação. Mudanças relevantes no documento ou prova assinalam revisão; renomear/desativar um técnico não reescreve o nome histórico.
- Interface ADMIN com parcelas editáveis, revisão explícita, seletor de parcela, intervalos elegíveis por técnico/período e anulação com motivo. Valida soma, provas, contexto, cálculo/arredondamento e recibos contra o pedido original. Alterar parcela limpa tempo selecionado, cálculo, mês e consentimento. Rascunhos por conta/despesa sem recuperar consentimento; IndexedDB/Web Locks e recuperação exata existentes. Respostas tardias e mudanças de identidade A–B–A não repõem dados privados.

## Verificação local

API nova: permissões/inputs, soma exata, sobreposições, técnico/período, previews sem escrita e alterados, documentos/pagamentos/bases preservados, concorrência entre processos, replay, rollback, limites próprios/globais, arredondamento final, identidade regular/extra/reparação, intervalo único, composição incompatível, fontes alteradas, anulação/recriação e cancelamento.

Navegador novo: parcelas explícitas, rascunho sem consentimento, prévia forjada com hash recalculado e resposta tardia A–B–A recusadas, recuperação após perda de resposta na repartição e valorização, recibo forjado recusado, elegibilidade por parcela, cálculo ao cêntimo, visita extra, histórico de anulação e limpeza de sessão. Layout a 320/390/1440 px e modo escuro, conteúdo literal.

Regressões locais aprovadas: valorização de despesas, reparações, bases compostas, correção de período, despesas de manutenções e administração das despesas. 401 unitários/64 ficheiros; sintaxe 599 JS backend, 201 JS frontend e 62 inline. As 34 migrações preservam os registos anteriores e correspondem ao esquema de 126 tabelas. Runner 203 → 205 grupos; cache `cristalwater-field-20260923-v119`. Sem dependências novas. Logs `/tmp/cw303-*.log`; visuais `/tmp/cw-labor-distribution-qa/`.

O CI completo e o restauro PostgreSQL 16 da versão publicada ainda têm de ser confirmados antes do fecho.

## Âmbito e próximos passos

Base `8c94ccfa531b7cc0f40df8f3c8dd8e5d63c07730`. Publicação apenas na branch `work/field-readiness-20260915-simulation`, sem força; principal `feature/technicians-v25` preservada em `6f27081e1d183ff584a62255b016b373836734db`. Sem merge, deploy ou contactos reais.

Fecha a repartição explícita de um documento por técnicos/períodos e a utilização de cada parcela nas valorizações já suportadas. A composição de parcelas de vários documentos não foi acrescentada; a composição anterior trabalha com documentos inteiros não repartidos. Restantes gastos, custos medidos próprios das manutenções, ajustes/descontos e origens de receita, históricos, volume, VPS/fornecedores e piloto físico continuam abertos. Custos/receitas completos e lucro permanecem por apurar; IVA e emissão fiscal externos, preços/frequências por cliente e época.
