# TASK346 — gravação revista e recuperável da calculadora

A calculadora passa a guardar o perfil, as alterações explícitas da piscina, o histórico e o comprovativo numa única transação. Cada pedido fica ligado à ficha revista e pode ser confirmado após perder a resposta ou reabrir a página. [Evidência local](evidence/20260925_task346_local.json).

## Comportamento entregue

- A consulta `GET /api/pool-calculations/:poolId/edit-state` devolve a projeção necessária e uma versão HMAC do registo original e do perfil completo. Campos internos do resultado antigo não são expostos nesta consulta. IDs canónicos, sessão ADMIN atual, respostas privadas e identidade do administrador são verificados, incluindo acessos recusados. O alias `/api/calculator` conserva o mesmo controlo.
- `POST /:poolId/reviewed` recebe os 34 campos visíveis, a versão revista e o UUID. Campos omitidos, adicionais, não decimais ou não finitos são recusados. Só opções explicitamente alteradas são comparadas com as opções atuais; valores históricos intocados permanecem.
- O bloqueio segue a ordem piscina → perfil, também usada pela edição técnica. A versão inclui os valores originais, não apenas datas, e deteta alterações externas mesmo quando a data foi mantida. Um pedido concorrente obsoleto recebe um comprovativo de conflito e conserva os campos para revisão.
- Só campos do perfil explicitamente alterados são normalizados. Nulos, zeros, opções históricas e diferenças entre volume principal e volume do perfil permanecem quando não foram editados. O volume principal só muda perante alteração explícita de geometria e um volume calculado positivo; o tipo só muda quando o formato foi alterado. Um perfil inexistente é criado com os campos revistos.
- O cálculo usa as fórmulas existentes. Resultados não finitos geram recusa persistente. Cada aplicação cria um evento `POOL_CALCULATOR_CHANGE` com os originais antes/depois e um comprovativo `FieldWriteRequest`, obrigatórios na mesma transação. Uma falha em qualquer escrita anula todas.
- Repetir o mesmo UUID, administrador, piscina e conteúdo devolve a confirmação original, mesmo após edições posteriores, reinício do processo ou remoção do registo. Reutilizar esse UUID para outro conteúdo, recurso ou operação é recusado. Outro administrador não recupera o comprovativo alheio.
- As APIs POST/PUT antigas conservam o contrato e os pressupostos anteriores, mas perfil e piscina passam a ser escritos atomicamente, com a mesma ordem de bloqueio. Essas APIs de compatibilidade continuam sem versão/comprovativo; a página atual usa exclusivamente a gravação revista.
- Antes de enviar, o navegador conserva o pedido exato, a ficha revista e o hash numa chave independente por administrador. Web Locks, revisão e confirmação da escrita impedem que outra janela substitua o pedido. Quota, escrita ignorada ou bytes inválidos bloqueiam o envio e conservam os bytes existentes.
- A confirmação consulta primeiro o comprovativo. Se ainda não existir, envia exatamente o mesmo pedido. Campos, piscina e novas gravações ficam bloqueados enquanto o pedido está pendente; o botão «Confirmar pedido guardado» permite verificar novamente. O pedido reaparece após recarga sem depender de uma consulta atual à piscina.
- Resposta divergente, identidade errada, perda de ligação ou falha ao guardar a confirmação local mantêm o pedido recuperável. Um conflito já confirmado também conserva os campos após recarga; apenas o descarte explícito carrega a versão atual. Mudança de conta limpa a vista e mantém o pedido da conta original.

## Validação

619 testes unitários em 85 ficheiros, quatro testes técnicos, sintaxe de 631 ficheiros backend, 226 frontend e 62 scripts inline aprovados. Sete grupos distintos de integração passaram no ambiente isolado, incluindo três grupos da calculadora, fórmulas existentes, controlo ADMIN e duas regressões de edição de piscinas.

Os testes API usam duas instâncias HTTP reais para pedidos iguais e concorrentes; injetam falhas na piscina, histórico e comprovativo dentro de transações reais; perdem a resposta após o commit e reiniciam o processo. Verificam criação sem perfil, recusa persistente, versões após escrita antiga, originais com nulos/zero/diferentes volumes e recuperação após eliminação da piscina. O rollback da API antiga também é exercitado.

No Chromium são exercitados recarga, offline, quota antes/depois do commit, escrita ignorada, confirmação divergente, cabeçalhos de outra conta, conflito persistente, duas janelas, troca de conta, bytes corrompidos e hash divergente. O ensaio de estado anterior mantém cobertura de campos por piscina, precisão, resultados, respostas tardias, timeout, histórico da página e expiração. Oito alterações são confirmadas no ensaio de recuperação e três no ensaio de estado, cada uma com um único histórico/comprovativo; dinheiro, documentos e notificações não são alterados.

Nove capturas de formulário, resultados e pedido pendente em 320/390/1440 são regeneradas em `reports/field-visual/pool-calculator/`. Revisão PT-PT; não certifica os cinco idiomas. Cache v158, 40 migrações existentes, sem novas dependências ou migrações. O runner passa a 245 grupos; inventário com 115 HTML, 80 páginas com referência literal em 266 scripts ativos e 35 na fila de pesquisa. Referência literal não equivale a revisão completa.

## Publicação e limites

Validação local concluída; publicação deste lote e CI/restauro PostgreSQL nativo por confirmar. TASK344 e TASK345 estão aprovadas nos respetivos CIs: [242/242 grupos](evidence/20260925_task344_ci.json) e [243/243 grupos](evidence/20260925_task345_ci.json), 17 etapas em cada e restauro de 127 tabelas/47 ficheiros com linhas e hashes iguais.

A conservação persistente começa ao premir Guardar; alterações apenas digitadas continuam em memória. O pedido local exige este navegador/conta e armazenamento disponível. Comprovativos confirmam a operação histórica; não afirmam que a ficha nunca mais mudou. As APIs antigas continuam sem proteção de versão para os seus próprios chamadores. Fórmulas, validação científica e tradução completa mantêm critérios próprios. Não houve merge, deploy, contactos reais ou alterações de produção. A aplicação não é declarada completa.
