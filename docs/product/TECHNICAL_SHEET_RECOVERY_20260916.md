# TASK195–196 — Recuperação da ficha técnica

A página específica da ficha técnica tinha gravação atómica (TASK194), mas uma resposta perdida podia levar a outro histórico ou a uma segunda nota. Um rascunho antigo também podia substituir alterações feitas noutra janela. Esta revisão acrescenta versão, pedido identificado e recuperação ao formulário existente.

## Contrato e persistência

- `GET /api/core/pools/:id/technical-sheet/edit-state` devolve um estado consistente, lido em transação `RepeatableRead`, com versão HMAC opaca da piscina e das quatro relações técnicas. O estado público contém apenas os campos do formulário e o contexto necessário ao cálculo, sem credenciais, chaves ou histórico anterior. A leitura complementar da ficha também deixa de devolver password/PIN do cliente.
- O formulário envia apenas os campos alterados, `requestId` UUID e `expectedVersion`. O servidor normaliza o conteúdo e calcula a assinatura da intenção antes de derivar profundidade/volume. O contrato com recuperação aceita os campos desta página; chamadas antigas sem identificação conservam a compatibilidade transacional da TASK194.
- A transação bloqueia primeiro o pedido por conta/UUID e procura a confirmação. Se já existir, devolve o resultado original antes de consultar a versão atual. UUID reutilizado com outra piscina/conteúdo é recusado. A primeira execução bloqueia piscina e componentes na mesma ordem do editor geral e recusa versões obsoletas antes de alterar qualquer dado.
- Piscina, componentes, histórico, nota opcional, evento, notificação interna e `TechnicalSheetEditRequest` são confirmados na mesma transação. A falha do novo registo também reverte todo o conjunto. As confirmações não dependem da conservação das linhas mutáveis do histórico.
- A nota é uma ação de acrescentar ao histórico: o pedido conserva o texto, a confirmação contém `noteHistoryId` e o campo regressa a vazio apenas depois da confirmação válida. Cada nova execução avança a versão, mesmo que só acrescente uma nota. Assim, repetir o pedido original é distinto de escrever deliberadamente outra nota igual.
- A resposta imutável confirma persistência interna; a projeção opcional no EventBus/Base de Conhecimento só ocorre na primeira execução, depois do commit. O resultado guardado não promete publicação em tempo real nem receção externa.

## Formulário e recuperação

`cw-technical-sheet-edit.js` gere os campos existentes. O cálculo de pré-visualização usa também formato, diâmetro e fator guardados, incluindo piscinas circulares. A profundidade média derivada e os três volumes são verificados na confirmação; pré-visualizar não acrescenta campos ao pedido. Ausência de componentes respeita os valores predefinidos da criação em Prisma.

- Rascunhos por conta/piscina em sessionStorage; pedido original, base e assinatura em IndexedDB, com leitura de confirmação local antes do transporte. O formulário fica protegido da memória genérica de formulários sem âmbito.
- Perda de resposta, reload, timeout, estado intermédio ou confirmação incompleta conservam o mesmo pedido. A repetição é explícita. A validação inclui HTTP 200, âmbito, conta, UUID, piscina, versões, assinatura, históricos, notificação e todos os campos resultantes.
- Web Locks e BroadcastChannel coordenam janelas. Uma janela conserva o seu rascunho diferente quando confirma o pedido de outra. Confirmações anteriores verificadas permanecem guardadas: uma janela ausente durante duas gravações não ressuscita a nota da primeira ao regressar.
- Conflitos mostram valores atuais, rascunho e pedido anterior por campo. Sobreposições exigem escolha. A preparação não envia alterações e só substitui um pedido após nova rejeição definitiva da versão; guardar depois cria outro UUID.
- Falta de espaço antes de guardar o pedido impede envio. Falha ao guardar a confirmação conserva a repetição original. Registos corruptos permanecem guardados e bloqueiam novos envios.
- Mudança de conta limpa os campos e os painéis relacionados e impede a aplicação de respostas atrasadas. Rascunhos/pedidos de outra conta não são apresentados. Leituras complementares de chaves/histórico/propostas/lembretes não substituem os campos do editor.
- Novos controlos, estados e revisão usam PT/EN/FR/ES/DE. Texto introduzido é apresentado literalmente. O seletor de idioma passou para uma linha própria, após inspeção que mostrou sobreposição no cabeçalho móvel. Foram repostas as duas folhas de estilo da navegação já usadas no editor geral: a sua ausência nesta página apresentava a barra lateral completa como conteúdo no telemóvel. A tradução integral dos painéis antigos não é afirmada por este ensaio.

## Validação

- `test-field-technical-sheet-recovery.js`: oito pedidos idênticos em dois processos, concorrência de versões, alterações das quatro relações mantendo timestamps, notas deliberadas distintas, replay depois de outra edição/arquivo/eliminação do histórico, falha obrigatória da confirmação, resposta destruída após commit e reinício do processo; campos/acessos, dados privados, componentes inexistentes e cálculo circular.
- `test-field-technical-sheet-recovery-ui.js`: página real, alterações parciais, nota única, perda de resposta/reload, nove confirmações adulteradas, conflitos por campo, preparação sem envio, janelas com notas diferentes, regresso depois de várias confirmações, quotas, corrupção, rascunhos por piscina, memória antiga, valores inválidos, formato circular e resposta tardia após mudança de conta. Revisão e seletor real nos cinco idiomas a 320/390/1440 px; PNGs de QA em `reports/field-visual/technical-sheet/`.
- `test-field-technical-sheet-atomicity.js` conserva as oito injeções de falha e a verificação no formulário real, adaptada ao botão de confirmação do pedido original e ao estado `aria-busy` observável.
- Servidor e atomicidade aprovados inicialmente em `field-qa-runtime/run-1789561799991`. UI e regressões dos editores gerais de clientes/piscinas aprovadas em `run-1789562097430`. A correção visual e o percurso E2E passaram em `run-1789562225786`. Revisão final de UI/servidor/atomicidade em `run-1789562369853`; navegação e UI final aprovadas em `run-1789562553648`.
- 324 testes unitários, quatro testes de técnicos, 17 scripts de navegador e sintaxe de 527 ficheiros backend aprovados; Prisma validado. O executor local usa PGlite por TCP; o CI da branch verifica PostgreSQL 16 nativo e restauro.
- Runner: 98 grupos. Migração aditiva `20260916150000_technical_sheet_edit_requests`: acrescenta uma tabela sem alterar dados anteriores. O teste da atualização passa a dezasseis migrações; restauro esperado de 107 tabelas, com comparação de linhas e ficheiros.
- Base confirmada da TASK194: commit `d98651ff84b1f0626aa6c04e4495b9f5967ca78c`, árvore `6cb05301da0667c3e78d48987e47e6f25f7d49af`, workflow `35090624706`: 96 grupos e restauro de 106 tabelas/22 ficheiros. Este relatório antecede a execução do CI da nova árvore; conferir a execução associada ao commit publicado.

## Limites e retoma

Rever a seguir os escritores de propostas técnicas (submissão, transição e aprovação), incluindo a sua aplicação aos mesmos componentes e a propagação antiga. A versão da ficha não torna esses escritores recuperáveis. Chamadas antigas sem UUID não adquirem deduplicação própria. A conservação local das confirmações está sujeita à capacidade e permanência dos dados deste navegador; os comprovativos do servidor persistem em PostgreSQL.

Continuam as restantes escritas antigas e o inventário visual global. Sem merge em main, deploy/VPS, mensagens a fornecedores reais ou emissão fiscal. O PNG preexistente do guia técnico permanece fora deste lote. Não há declaração de prontidão global.

## Primeiro CI e correção do ensaio legado

O workflow `35097630168`, sobre `deb89535040a83609e3bedff5a0f883cce89c35f`/árvore `75202b7a0bb92c039da27117d58da2eb3998a96c`, aprovou dezasseis migrações, unitários, técnicos, navegador e 97 dos 98 grupos. Os três grupos da ficha técnica passaram em PostgreSQL 16. O restauro não correu nessa execução.

A falha foi `document.querySelector('.cw-undo').click()` no ensaio de recuperação de clientes. A navegação atual remove a barra antiga através de temporizadores de arranque, mas o teste carregava a barra e tentava usar o botão mais tarde. A fixture passa a capturar o botão real na inserção, força a remoção da barra e exerce o mesmo handler original. Mantém todas as verificações de exclusão de credenciais, proteção do editor gerido e troca de conta, sem alterar código de produção nem aumentar timeouts. Ensaio corrigido aprovado em `field-qa-runtime/run-1789563326029`. Verificar a execução completa da nova árvore.
