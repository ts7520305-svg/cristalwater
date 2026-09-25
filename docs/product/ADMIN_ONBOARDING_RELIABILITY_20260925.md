# TASK361 — entrada guiada com revisão e criação atómica

## Problemas confirmados

A entrada administrativa usava um rascunho global sem proprietário, preenchia uma data civil com uma conversão UTC e fazia um POST seguido de um PUT da piscina. Uma resposta perdida não tinha recuperação idempotente. O servidor ignorava campos fiscais apresentados, tolerava a falha de escritas auxiliares e copiava a mensalidade para a receita da primeira visita. A ficha técnica recebia valores automáticos que podiam não corresponder à revisão do administrador.

## Alteração

- Uma revisão explícita precede a criação. A prova de cinco minutos liga administrador, campos e versão das escolhas de ronda/técnico. Alterar o formulário invalida a revisão; a confirmação tem uma caixa própria. A gravação antiga sem revisão é recusada com 409.
- Cliente, piscina, ficha técnica obrigatória, eventual ronda/associação/primeira visita, pendências internas, auditoria e comprovativo são gravados numa transação. As nove classes de escrita obrigatória têm ensaios de falha e rollback. O cliente fica em SETUP, com faturação desativada; a mensalidade é conservada, mas a receita da visita começa em zero.
- Identificação fiscal, opção de fatura e número de série são conservados. Os valores técnicos obrigatórios começam vazios e precisam de preenchimento; mudar o tratamento não os substitui. Nulo e zero permanecem distintos, a mensalidade aceita até duas casas decimais e nenhum perfil de cálculo é inventado.
- A primeira visita usa a hora civil de Lisboa, mesmo num navegador com outro fuso horário. Horas inexistentes são recusadas; a hora repetida no outono exige escolher a primeira ou a segunda ocorrência. O técnico aplica-se à primeira visita e não altera a equipa permanente da ronda.
- O pedido exato é conservado antes do POST, por administrador, no navegador. A recarga não o reenvia: consulta-se primeiro o comprovativo e, se não confirmado, existe repetição explícita do mesmo pedido. Respostas incoerentes e recusas que não provam rollback conservam o pedido. A repetição após commit ou reinício recupera o primeiro comprovativo, sem nova criação.
- Rascunhos antigos sem proprietário e dados de outras contas não são importados nem apagados. Há proteção para falha de armazenamento, bytes inválidos, alteração noutra janela, sessão trocada/expirada, suspensão e respostas tardias. Campos dinâmicos e nomes são texto literal.
- Opções privadas ADMIN apresentam apenas identidades mínimas de rondas e técnicos ativos. ENV_ADMIN não pode criar. O formulário, revisão, recuperação e comprovativo têm conteúdo próprio em PT/EN/FR/ES/DE. O comprovativo abre os destinos existentes com as identidades reais e conserva o idioma.
- A migração aditiva alinha `Pool.serialNumber` opcional e único com a coluna já prevista na migração SQL antiga. A atualização preserva valores existentes e pode ser repetida. O teste oficial de atualização inclui a nova migração, conservação dos registos e unicidade. Não são criadas tabelas nem dependências.

## Validação local

**710 testes unitários em 98 ficheiros, quatro técnicos, Prisma válido e sintaxe de 642 ficheiros backend, 252 frontend e 46 scripts inline.** São 12 testes unitários novos. O script de migrações passou também a verificação de sintaxe após a inclusão do novo ensaio. Um ensaio SQL isolado confirmou a coluna ausente, a conservação de registos e do número de série existente, a repetição e a unicidade com SQLSTATE 23505.

Os dois grupos novos passaram com a API real e Chromium. A API verifica nove falhas SQL, revisão ligada ao ator/dados/escolhas, perda de resposta após commit e reinício, seis repetições concorrentes em dois processos e duas criações concorrentes para a mesma piscina. O formulário verifica o percurso completo, campos fiscais/técnicos, revisão invalidada por edição, perda de resposta e recarga, recuperação apenas por GET, repetição explícita, opções e comprovativos incoerentes, recusa ambígua sem perda do pedido, duas janelas, armazenamento, offline, suspensão e troca/expiração de sessão. Exatamente três clientes no ensaio de interface; nenhum segundo PUT da piscina nem comunicações externas.

Trinta capturas em `reports/field-visual/admin-onboarding/`, cinco idiomas e larguras 320/390/1440. Revistos PT390, PT1440 e DE320/revisão. O conteúdo próprio cabe nas larguras verificadas; a navegação comum conserva traduções anteriores e dois recursos binários não materializados localmente. Capturas longas de elementos incluem sobreposições da navegação fixa; a confirmação foi acionada no navegador real. Não se declara revisão visual global.

Runtime PGlite 0.5.8 / pglite-socket 0.2.11 isolado, 41 migrações e Chromium em múltiplos processos com segurança web ativa. **Duas regressões antigas não concluíram localmente:** `test-field-pool-edit-atomicity.js` encontrou erros de transporte/prepared statement e resposta 401 durante a injeção de falhas; `test-field-client-intake.js` passou criação, repetição e rollback, mas recebeu 401 em vez de 503 no ensaio de falha da aprovação no segundo processo. Esta última falha permanece por diagnosticar no runtime nativo. Nenhum destes grupos é contado como aprovado neste lote e os testes não foram enfraquecidos. O ambiente local só disponibiliza UID 0 e não permitiu iniciar PostgreSQL nativo com um utilizador próprio; não se alteraram essas restrições. O CI nativo é o próximo verificador desses percursos e do restauro.

Cache **v172**, runner com **259 grupos distintos**. Inventário: 115 HTML, 99 páginas com referência literal em 280 scripts ativos, 16 na fila de pesquisa e zero recursos ausentes do repositório. Referência literal não prova conclusão funcional.

## CI e publicação

TASK359 confirmada em [256/256 grupos e restauro PostgreSQL nativo](evidence/20260925_task359_ci.json), 17 etapas e duração 36m51s. TASK360 confirmada em [257/257 grupos e restauro nativo](evidence/20260925_task360_ci.json), 17 etapas e duração 37m12s. Ambos restauraram 127 tabelas e 47 ficheiros com linhas e hashes iguais.

Publicada em `0c71fffacff52c495eaca4695e277e6a1723efb5`, árvore `5d9105f48d76f2445ba670496391df6873d00e9d`, idêntica à preparada e validada localmente nos termos acima. [CI 36145083182](https://github.com/ts7520305-svg/cristalwater/actions/runs/36145083182), job `108104107654`, em execução; os 259 grupos, as duas regressões, a atualização de esquema e o restauro PostgreSQL nativo deste lote continuam por confirmar.

## Limites e retoma

A deteção de duplicados usa número de série ou correspondência exata de morada/local/tipo neste percurso; não reconcilia o histórico nem todos os outros escritores. O rascunho e a prova pendente no navegador não constituem cópia entre dispositivos. As opções completas de rondas/técnicos não foram avaliadas com volume de produção. Outros percursos antigos de `operational-flow`, a atribuição permanente de equipas e a calculadora mantêm o respetivo âmbito.

Retomar primeiro CI nativo, incluindo as duas regressões e o restauro, e depois os 16 HTML restantes, começando pela aplicação efetiva das preferências de tema/densidade. Conciliação histórica, volume, infraestrutura/VPS, cópias operacionais, fornecedores externos e piloto físico iPhone/Android continuam pendentes. Sem merge, deploy ou contactos reais; aplicação não declarada completa.
