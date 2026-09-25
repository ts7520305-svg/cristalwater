# TASK348 — calculadora técnica em cinco idiomas

A calculadora dispõe de PT-PT, inglês, francês, espanhol e alemão. O seletor atualiza os campos, ações, resultados, recomendações conhecidas, mensagens e diálogos, incluindo recuperação e conflitos. A escolha fica no endereço e sobrevive à recarga. [Evidência local](evidence/20260925_task348_local.json).

## Comportamento entregue

- Os 34 campos e a seleção de piscina têm rótulos e nomes acessíveis traduzidos. As opções de carga e fase passam a declarar valores explícitos, mantendo os códigos do protocolo quando os rótulos mudam. Opções históricas desconhecidas conservam o valor original com uma indicação traduzida.
- A mudança de idioma atualiza o estado atual, sem calcular, consultar, guardar ou descartar. Campos, casas decimais, zero, rascunho, versão revista, UUID, hash e comprovativo permanecem iguais. A navegação pelo histórico que altera apenas o idioma também conserva a vista e não cria uma consulta.
- Uma resposta de cálculo ou confirmação iniciada num idioma é apresentada no idioma entretanto escolhido. As mensagens de falha, quota, sessão, rascunho recuperado e conflito podem mudar de idioma mantendo os bloqueios existentes. Os diálogos de descarte e limpeza usam o idioma atual.
- Resultados mantêm os números recebidos e as fórmulas existentes. Só textos gerados conhecidos são traduzidos; nomes, notas, opções históricas e texto inesperado da origem permanecem literais e escapados. A tradução de uma recusa usa o código validado, sem reescrever a mensagem guardada no comprovativo.
- `lang` reconhece apenas um dos cinco códigos suportados; idioma ausente, desconhecido ou repetido usa PT. A tradução comum não substitui o conteúdo controlado pela calculadora.

## Validação

626 testes unitários em 87 ficheiros, quatro testes técnicos e sintaxe de 631 ficheiros backend, 228 frontend e 62 scripts inline aprovados. Quatro grupos locais de integração API/Chromium: estado da calculadora, idiomas, rascunhos e recuperação. O novo grupo voltou a passar após acrescentar confirmação em curso, estados vazio/falha e capturas do cabeçalho e resultados.

O ensaio usa duas piscinas reais na base isolada e cobre os cinco idiomas, todos os rótulos acessíveis, opções, resultados, notas técnicas, recarga, histórico, cálculo e gravação em curso, offline, quota, texto literal, campos antigos, zero, precisão, sessão e conflito. Uma gravação é aplicada e recuperada após perda de resposta sem segundo POST; uma segunda operação é recusada por conflito. O pedido pendente conserva exatamente os bytes entre idiomas. A outra piscina e as contagens de documentos, pagamentos e notificações permanecem iguais.

23 capturas são regeneradas em `reports/field-visual/pool-calculator-languages/`: formulário nos cinco idiomas em 320/390/1440, cinco cabeçalhos em 320 e resultados em alemão nas três larguras. Amostras do formulário, cabeçalho e resultados foram revistas visualmente. Os ensaios verificam ausência de transbordo horizontal. A evidência regista fontes, logs e capturas. Cache v160; runner com 247 grupos distintos; 40 migrações existentes. Sem alteração de fórmulas, esquema, backend ou dependências.

Inventário: 115 HTML, 80 páginas com referência literal em 268 scripts ativos, 35 na fila de pesquisa. Referência literal não equivale a revisão completa de uma página.

## Estado e limites

Publicada em `e20d2e2835af565bc743728f66456401d62bec46`, árvore `b2a7db8ea31bcc041e4f546eeeb037a82eb9cc5e`, idêntica à preparada e validada localmente. [CI 36106189648](https://github.com/ts7520305-svg/cristalwater/actions/runs/36106189648), job `107979138585`, em execução; os 247 grupos e o restauro PostgreSQL nativo deste lote continuam por confirmar. O CI da TASK346 passou em 245/245 grupos esperados distintos e 17 etapas, incluindo restauro PostgreSQL de 127 tabelas e 47 ficheiros com linhas e hashes iguais ([evidência](evidence/20260925_task346_ci.json)). A TASK347 tem [246/246 grupos e restauro nativo aprovados](evidence/20260925_task347_ci.json): 127 tabelas/47 ficheiros com linhas e hashes iguais.

A tradução cobre o cabeçalho e conteúdo próprios da calculadora. Navegação comum e assistente mantêm o seu contrato anterior; mensagens nativas do navegador seguem a configuração do navegador. Notas e nomes escritos pelos utilizadores não são traduzidos. As fórmulas foram preservadas, sem nova certificação científica. Mantêm-se os limites de armazenamento e os chamadores antigos sem versão das TASK346/347, além dos restantes critérios de páginas e produção. Sem merge, deploy ou contactos reais; aplicação não declarada completa.
