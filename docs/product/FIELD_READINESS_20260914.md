# Validação operacional — 14 setembro 2026

Estado: bateria integrada local aprovada; validação de produção e telemóvel físico pendentes. Não certificado para campo.

Pedido atual: concluir e testar os fluxos do técnico em campo, gestor, cliente e administrador; continuar as correções sem aprovações intermédias. Não implica envio de mensagens a clientes nem alterações destrutivas na base produtiva.

## Base verificada

- Branch principal: `feature/technicians-v25`, commit `6f27081e1d183ff584a62255b016b373836734db` (28 julho).
- Trabalho de campo de hoje preservado: `work/field-validation-ux-20260914`, commit `a584369b7372a71c1aaa280078e5aeca00f8f1d1`.
- Continuação: `work/field-readiness-20260914`.
- Relatórios antigos e testes de presença de texto não demonstram prontidão funcional atual.

## TASK 1 — permissões e documentos autenticados

- Propostas técnicas exigem perfil operacional, com herança de administrador/chefe de equipa existente.
- PDFs das guias: requisição autenticada; apresentação por Blob; tratamento de sessão expirada, falha HTTP e popup bloqueado; rejeição de destinos externos.
- Importação `bcryptjs` no teste mensal restaurada.
- Testes comportamentais verificam autenticação, falhas HTTP e proteção do token.
- Nenhuma alteração de schema.

## TASK 2 — arranque a partir de clone limpo

- A primeira execução real falhou antes de abrir a API: `CrystalBrain` importava `../logs/BrainLogger`, ausente no repositório.
- Corrigido para reutilizar `services/loggerService`, já existente.
- `check:syntax` passa também a resolver os imports locais, pois `node --check` não deteta esta falha.
- TASK 1: 25 ficheiros / 63 testes passaram; testes específicos do técnico 4/4; sintaxe e resolução a revalidar após esta correção.

## TASK 3 — interface móvel e sincronização de água

- Chromium real reproduziu bloqueio da interface: o observador DOM reagia às suas próprias alterações sem parar. Observação suspensa durante a decoração.
- Respostas offline HTTP 202 mantêm o lembrete pendente. Só uma confirmação com ID do servidor confirma sincronização.
- Fecho antes da primeira sincronização reproduz criação seguida de fecho; exclusão de tentativas concorrentes no mesmo ecrã.
- Teste comportamental `npm run test:field-browser`: interface responsiva, check-in explícito, resposta offline e criação/fecho após reconexão passaram. Usa API controlada; não substitui ensaio integral nem telemóvel físico.
- API real: ensaio operacional do técnico e simulação mensal passaram numa base isolada PGlite/TCP, incluindo concorrência no fecho da visita. Não equivale a validar desempenho PostgreSQL de produção.

## TASK 4 — água persistente e alarmes no servidor

- Serviço dedicado com autorização pela visita e pelo técnico real, contexto obtido da base e rejeição de IDs forjados.
- Chave única de repetição e bloqueios transacionais evitam duplicados; fecho e alarme tardio preservam o estado fechado.
- Job de segurança a cada minuto, independente dos jobs de faturação/IA. Escala água vencida mesmo sem navegador aberto. Registos antigos com título de água continuam monitorizados.
- Alarmes e notificações persistem na transação. Fecho resolve apenas o alarme associado. Push respeita o modo QA e a configuração de notificações externas.
- Migração **aditiva**, ainda não aplicada à produção: duas colunas opcionais e índice único em OperationalReminder. Aplicar antes do novo servidor.
- API real: 12 verificações novas passaram; ensaio existente do técnico também passou; 63 testes unitários e 4 do técnico passaram.
- DeviceTokens legados não identificam técnicos. A TASK 14 acrescenta subscrições Web Push individuais; entrega com telefone bloqueado ainda não validada.

## TASK 5 — download do cliente

- Download bloqueava uma ligação numa transação e tentava consultar por outra ligação; com pool de uma ligação expirava e terminava o processo Node (rejeição não tratada).
- Consultas usam agora o cliente da transação; erros seguem para o middleware HTTP.
- Teste utiliza o diretório de uploads isolado configurado. Jornada Customer OS passou integralmente: dashboard, notificações, documentos, download, permissões, mensagens, pedidos e histórico.

## TASK 6 — componente comum de estados

- O teste integral encontrou um segundo ciclo de MutationObserver no adaptador de carregamento/erro: observava alterações de atributos que ele próprio fazia.
- Execução protegida contra os próprios eventos e inicialização repetida; regressão Chromium inclui agora o adaptador real e um elemento de carregamento.
- Ecrãs reais de técnico móvel, cliente móvel e administração desktop abrem sem erros JavaScript ou respostas API falhadas no ensaio.

## TASK 7 — identidade e jornada do técnico

- Corrigida confusão entre IDs de User e Technician. Login por email identifica a origem e associa o técnico por email; a jornada usa o User correto.
- Conta sem associação técnica mantém acesso à sua jornada, mas não herda acidentalmente as visitas de outro técnico com o mesmo ID numérico.
- Revalidação de perfil ativo/role; tokens de administradores eliminados e roles desconhecidas rejeitados. Fallback de administrador exige ativação explícita `ALLOW_ENV_ADMIN_FALLBACK=true` e não ignora conta existente inativa.
- API: segurança 22/22, jornada 7/7 e aceitação de rotas passaram. Testes antigos passaram a autenticar e a reconhecer HTTP 201 na primeira abertura de jornada.

## TASK 8 — fotografias de campo

- Fotografias pendentes persistem como ficheiros em IndexedDB, por técnico e visita; voltam a abrir depois de recarregar sem rede.
- Upload usa a pasta de QA configurada, nomes normalizados, limite de tamanho e autorização da visita antes do ficheiro.
- Conteúdo/hash por visita e tipo evita fotografias duplicadas quando se repete um upload após perda de resposta.
- Chromium real preservou uma fotografia durante recarga offline e sincronizou-a juntamente com a conclusão; API operacional e portal do cliente passaram.

## TASK 9 — privacidade e comunicações

- Notificações do cliente filtram destinatário exato, incluindo o portal. Técnicos recebem apenas notificações destinadas ao seu perfil/identidade.
- Sockets exigem sessão válida, entram apenas nas salas autorizadas e revalidam sessões; mensagens em tempo real vêm de registos existentes, não de conteúdo forjado pelo emissor.
- Broadcasts operacionais sem destinatário explícito passam para a gestão; token HTTP não acompanha pedidos para origens externas.
- Documentos e conversas exigem autenticação; cliente não pode ler outra conversa nem apresentar-se como administrador. Download direto da pasta de documentos deixa de contornar autorização.
- Sincronização exige técnico e verifica propriedade da visita. API: 13 verificações de acesso passaram; ecrãs online mantiveram funcionamento.

## TASK 10 — documentos da viatura e stock

- O seguro aceita o tipo INSURANCE usado pela própria administração; a inspeção é obtida do registo de manutenção e enviada no contexto da viatura.
- Atualização da guia calcula saldo com o consumo corrente na base, evitando restaurar stock a partir de uma leitura anterior durante um consumo concorrente.
- Ensaio móvel com guia AT, guia de obra, seguro e inspeção válidos atravessou o bloqueio documental; simulação mensal passou.

## TASK 11 — conclusão offline e stock uma única vez

- Ronda e rascunhos por técnico; service worker guarda a página certa e os recursos estáticos, sem cache partilhada de APIs autenticadas.
- Outbox persiste a conclusão antes do envio. Fotografia pendente é enviada primeiro; uma resposta sem confirmação não transforma a visita em concluída.
- Chave de pedido por visita e bloqueio transacional permitem repetir após perda de resposta; removida a segunda dedução de produtos que o frontend fazia depois da dedução automática do servidor.
- Débitos condicionais/atómicos evitam saldo negativo em duas visitas concorrentes e em duas linhas do mesmo produto. Cache de dashboard invalidada após commit; eventos publicados após confirmação da transação.
- Chromium/API: offline + recarga + fotografia + reconexão + conclusão + repetição passaram; 10 kg iniciais tornaram-se 9 kg, com um único consumo. Concorrência e repetição de produto sem saldo suficiente foram rejeitadas sem alterar o stock.
- Migração aditiva de completionRequestId ainda não aplicada à produção.

## TASK 12 — estatísticas e contexto persistente

- Estatísticas usam o ID Technician das visitas; GPS associa o User por email. Acesso protegido à gestão/próprio técnico.
- Sincronização de água recupera os lembretes do servidor e mantém abertos os de rondas anteriores. Fechos pendentes locais prevalecem até confirmação.
- Visit OS passou com estatísticas da visita concluída. Route OS passou em seguida, no mesmo processo, depois da invalidação de cache corrigida na TASK 11.


## TASK 13 — dependências verificadas

Atualizações compatíveis de Express, uploads, email, Socket.IO e HTTP. Overrides explícitos uuid 11.1.1 (CommonJS/v4 utilizado pelos clientes Google) e deepmerge-ts 8.0.0 (deepmerge utilizado pelo Prisma), sem downgrade do Prisma. Acrescentado web-push 3.6.7.

Verificação: npm audit completo — 0 vulnerabilidades conhecidas; Prisma validate/generate; 63 testes unitários; 4 testes do técnico; bateria real de 15 grupos após atualização. Não representa auditoria de segurança exaustiva. Fontes: https://github.com/uuidjs/uuid/releases/tag/v11.1.1 e advisories devolvidos pelo npm audit.

## TASK 14 — subscrições de avisos por identidade

Subscrições autenticadas, chave VAPID validada, destinos HTTPS de fornecedores autorizados e rejeição de troca de proprietário. Job de água entrega a técnicos específicos e administradores ativos; retira endpoints expirados; QA bloqueia envios externos. Migração aditiva WebPushSubscription.

API testou subscrição, perfil forjado, tentativa de apropriação de endpoint e rejeição de destino de rede interna. Envio real não efetuado: depende de configuração do servidor e de autorização de notificações no dispositivo. Referência: https://github.com/web-push-libs/web-push .

## TASK 15 — acesso ao cliente e viatura atribuída

Administrador pode consultar o portal de qualquer cliente. Históricos numéricos exigem autenticação e propriedade. Escritas do cliente não aceitam administrador a apresentar-se como cliente. Técnico só consulta/movimenta guias da viatura atribuída, não escolhe identidade pelo formulário e não conclui visita utilizando stock de outra viatura.

Verificação: casos negativos de API e percursos de campo/cliente/gestão da bateria integrada aprovados.

## TASK 16 — correção de consumos após conclusão

Correção exige propriedade da visita, bloqueia a linha durante a transação e ajusta apenas a diferença entre produtos antigos e novos. Acréscimo de consumo ou devolução gera movimentos de auditoria. Repetição da mesma correção não altera stock. Guia encerrada, unidade incoerente ou consumo antigo sem origem identificável exigem reconciliação pela gestão, sem inventar saldos.

Chromium/API: aumento, repetição, diminuição e falta de saldo passaram; rejeição reverte stock e histórico em conjunto. Fixture T1 passou a carregar produtos na guia de transporte que origina a guia de obra, em vez de manter duas guias contraditórias.

## TASK 17 — rota incompleta sem derrubar o servidor

Reproduzido crash Node numa visita PLANNED sem piscina. Otimização conserva os registos sem coordenadas no fim da lista, aceita coordenada zero e valida ponto de partida. Erros seguem para middleware HTTP. Consulta autenticada; técnico vê apenas a sua rota.

Regressão: 15 grupos em sequência passaram, incluindo uma visita sem piscina e consultas sem autorização; servidor terminou apenas por SIGTERM controlado do ensaio.

## TASK 18 — atualização do navegador no campo

Botão de subscrição pede permissão por ação explícita, informa falta de configuração e exige confirmação de entrega real. Service worker apresenta avisos e abre apenas destinos da própria aplicação.

Fila antiga é preservada: aviso visível e cópia recuperável dos registos do próprio técnico, sem exportar tokens. Não se repetem cegamente operações antigas que podem já ter sido executadas. Chromium confirmou preservação, conteúdo binário exportado e ausência de credenciais na cópia. Antes da mudança de versão em campo, a gestão deve reconciliar qualquer fila antiga no respetivo telemóvel.

## TASK 19 — bateria repetível e manutenção dos testes

Runner sem mensagens externas, dados QA e logs por execução, com estado de saída do servidor. CI preparado para PostgreSQL 16 e Chromium. Teste mensal envia mensagens usando login real de cada cliente; estatísticas verificam IDs diferentes para User e Technician. Página de rotas carrega autenticação comum; padrões inválidos de ignore corrigidos.

Execução local do runner: 15/15 grupos aprovados (reports/field-suite/1789398178600). 63/63 testes unitários, 4/4 do técnico, 3 cenários do componente móvel. Chromium adicional de recuperação passou em run-1789398265107. GitHub Actions/PostgreSQL 16 aprovado no run 34860159081. Teste local usa PGlite/TCP; nenhum dos dois certifica desempenho do VPS real.

## TASK 20 — atualização do esquema sem perda de dados

- Teste recusa qualquer base que já contenha tabelas. Apenas QA isolado.
- Reconstitui o schema real do commit anterior, insere visita/lembrete, aplica os três ficheiros SQL da release e confirma preservação dos registos e compatibilidade integral do schema.
- PASS local com PGlite/TCP. CI executa o mesmo ensaio em PostgreSQL 16 antes da bateria operacional.
- Isto não verifica o estado real de `_prisma_migrations` nem eventual desvio do VPS. A pasta histórica de migrações não contém uma baseline de criação; nunca executar `migrate deploy` numa base desconhecida sem diagnosticar o histórico.

## Critérios finais e limites

| Verificação | Resultado comprovado |
|---|---|
| Unitários | 63/63 |
| Técnico específico | 4/4 |
| Componente Chromium: check-in e água offline | 3 cenários aprovados |
| Integração de 15 grupos no mesmo servidor | Aprovada; servidor termina por SIGTERM do runner |
| Móvel: rede interrompida, recarga, foto, conclusão e repetição | Aprovado em Chromium |
| Stock concorrente e correção de produtos | Aprovado; saldo e histórico preservados nas rejeições |
| Registos antigos pendentes no dispositivo | Cópia preserva conteúdo e exclui token; reconciliação humana continua necessária se existirem |
| Audit de dependências | 0 vulnerabilidades conhecidas no npm audit desta execução |
| Upgrade do schema anterior | Três migrações aprovadas com dados existentes em QA |
| GitHub Actions/PostgreSQL | 15 grupos, unitários, Chromium e sintaxe aprovados no run 34860159081; upgrade SQL acrescentado ao gate seguinte |
| Telefone físico e notificações com aplicação fechada | Não executado; falta dispositivo inscrito/servidor configurado |
| VPS real, backup/restauro e integrações externas | Não executado; não há acesso comprovado nesta sessão |

Não foi executado indiscriminadamente todo o catálogo histórico: contém testes textuais obsoletos e scripts de limpeza. Testes antigos v21-freeze/v22.6.7 dependem de documentos ausentes ou de espaçamento literal; não são substitutos da bateria operacional. Não foram alterados para fabricar aprovação.

### Passagem para campo

1. Na cópia de validação do VPS: confirmar commit, Node, configuração, migrações já aplicadas e diferenças do schema. Fazer backup de base/uploads e provar o restauro numa base separada.
2. Aplicar somente as três migrações aditivas desta release depois de verificar o histórico; não usar `db push --accept-data-loss` em produção. Arrancar o servidor novo apenas após o schema necessário existir.
3. Configurar `WEB_PUSH_SUBJECT`, `WEB_PUSH_PUBLIC_KEY` e `WEB_PUSH_PRIVATE_KEY` no servidor. Gerar o par uma única vez através da biblioteca web-push; guardar a privada fora do Git. Validar HTTPS e flags de notificações externas. Não ativar integrações de faturação/WhatsApp apenas para ensaiar água.
4. Técnico entra com a sua conta, confirma a viatura, abre a ronda com rede e ativa os avisos por ação explícita. Se houver registos antigos pendentes, a gestão reconcilia-os antes de limpar ou trocar o telemóvel.
5. Ensaiar numa visita de teste identificada: sem rede → medir/fotografar/concluir → fechar/reabrir → ligar rede → verificar uma visita, uma foto e um débito. Cliente e administração devem ver o mesmo resultado autorizado.
6. Com água **fisicamente fechada**, criar um lembrete de teste e comprovar a entrega no telefone bloqueado e com aplicação fechada; fechar o lembrete e confirmar resolução. Repetir com aplicação reiniciada, sessão expirada e reconexão. Não deixar água a correr para testar software.
7. A gestão só liberta utilização geral depois destes resultados físicos registados. O retorno à versão anterior exige compatibilidade do schema e preservação das filas dos telemóveis; não apagar colunas nem restaurar uma base antiga por cima de trabalho novo.

Proposta guardada: https://github.com/ts7520305-svg/cristalwater/pull/4 (dependente da PR #2). Nada foi fundido ou instalado no VPS.

CI PostgreSQL aprovado: https://github.com/ts7520305-svg/cristalwater/actions/runs/34860159081 (commit remoto 8fe59871d39e44b041e229f7ca9ff54a7d251bac).

## TASK 21 — ensaio repetível de recuperação

CI passa a criar um dump PostgreSQL, restaurar numa segunda base descartável e comparar contagem e impressão digital de todas as tabelas. Verifica também sequências de IDs e recuperação dos ficheiros de uploads por SHA-256. Guarda apenas relatório; elimina dump e base auxiliar. O teste recusa ambientes fora do serviço QA definido no workflow.

Este ensaio mede a recuperação da base de testes desta release; não substitui um backup nem um restauro do VPS real. Resultado remoto aprovado no run 34862036809: 93 tabelas e 9 ficheiros recuperados, com impressões digitais e sequências verificadas.

## TASK 22 — instruções de instalação coerentes

README, preparação VPS e runbook passam a preservar o `.env` existente e logs. Retirada indicação de aplicar migrações cegamente: primeiro verificar histórico/schema e backup restaurável. O relatório de julho não comprova recuperação do VPS atual, e um export JSON de fallback não comprova um backup PostgreSQL restaurável. Scripts apenas preparados; nenhum comando executado no VPS.


## TASK 23 — interface profissional para utilização em campo

Uma única navegação: Hoje, Visita, Mapa, Viatura e Mais. Ações de início/conclusão ao fundo; atalhos Acesso/Serviço/Produtos/Fotos; documentos detalhados na viatura; histórico local em Mais. Contraste e alvos de toque reforçados. Resumo de documentos aguarda os dados reais antes de alertar. Alertas por resolver continuam acessíveis nos vários separadores.

Estados distintos para rascunho local, falha de gravação, ausência de rede, cópia da ronda e envios pendentes da visita. Falha de carregamento sem cópia apresenta nova tentativa. Medição vazia é “Por medir”; vírgula decimal é aceite e zero continua uma leitura real. Nova visita não começa com tarefas marcadas como realizadas; rascunhos preservam as escolhas do técnico.

Referências consultadas em 14/09/2026: [Skimmer](https://www.getskimmer.com/) para rondas, registos e fotografias em campo; [Jobber](https://www.getjobber.com/) para informação e execução de trabalhos no telemóvel; [Pool Founder](https://www.poolfounder.com/) para padrões de utilização em campo. Adaptação ao produto existente, sem copiar marcas ou assumir resultados comerciais dos fornecedores.

### Matriz de situações e limites da evidência

| Situação | Verificação / tratamento |
|---|---|
| Ecrãs de 320, 390 e 768 px | Chromium: sem overflow horizontal, uma navegação, alvos da navegação de pelo menos 44 × 44 px |
| Ronda, visita e documentos | Navegação, atalhos, separação de documentos e ausência de alertas falsos verificados |
| Leituras vazias, zero, vírgula e fora da referência | Estados Por medir/Baixo/OK/Alto verificados sem alterar os limites configurados |
| Trabalho ainda não executado | Novas visitas sem caixas pré-selecionadas; escolhas persistem após conclusão |
| Memória local cheia | Falha simulada apresenta erro de gravação; não afirma sucesso |
| Ronda sem rede e sem cópia | Erro visível e botão de repetição; recuperação ao restabelecer o pedido |
| Ronda em cache, fotografia e conclusão sem rede | Recarga, preservação de dados e repetição após reconexão verificadas |
| Repetição de conclusão/fotografia | Uma visita, uma fotografia e um débito de stock; concorrência e correções verificadas |
| Guias/seguro/inspeção e stock inválidos | Bateria de validação operacional e autorizações; falhas não deixam débito parcial |
| Conta inválida, cliente/viatura/visita alheios | Bateria de acesso bloqueia leitura ou alteração não autorizada |
| Água e check-in sem rede | Componentes Chromium e API: pendência explícita, reconciliação e autorização |
| Gestão, cliente, administração, finanças, reparações e interligações | 15 grupos integrados, incluindo simulação de mês operacional |
| Recuperação de desastre | QA PostgreSQL 16: restauro de 93 tabelas e 9 ficheiros aprovado; VPS real não ensaiado |
| Câmara/GPS recusados, bateria esgotada, sistema a encerrar a aplicação | Exigem ensaio em dispositivos físicos; não comprovados por esta bateria |
| Notificação no telefone bloqueado, aplicação fechada e sessão expirada | Exige telefone inscrito e configuração real; não comprovado |
| Sol direto, luvas, utilização prolongada e redes móveis reais | Aceitação com técnicos em campo ainda necessária |

Não é possível comprovar literalmente todas as combinações de equipamento, rede e operação. Esta matriz identifica classes críticas, testes reproduzíveis e limites explícitos. A release continua em proposta; não foi instalada no VPS.


## TASK 24 — sessão expirada e mudança de conta durante envios

Na visita em campo, uma resposta 401 apresenta um aviso persistente e entrada explícita, mantendo o ecrã e os dados locais. O servidor continua a recusar acesso; não há extensão de validade nem autorização offline. A fila deixa de repetir envios enquanto essa sessão está expirada. A renovação com a mesma conta permite retomar a sincronização. Respostas 401 antigas não invalidam uma sessão entretanto renovada, nem respostas de outras origens encerram a sessão local.

Fotografias e conclusões capturam a identidade e o token do envio. Se a conta mudar enquanto chega a resposta, os registos locais permanecem com o proprietário original; não se elimina a fotografia da nova conta nem se conclui a visita com a identidade nova. URLs temporárias das fotografias são libertadas também em falha.

Três cenários Chromium reproduzíveis em `scripts/test-field-session-browser.js`: expiração com trabalho visível e conclusão pendente, 401 atrasado após renovação e troca de conta durante upload com IDs locais coincidentes. Os dois conjuntos de fotografias permanecem intactos e o envio retoma ao regressar à conta original. Integrados no comando `npm run test:field-browser` e no CI. Isto não comprova entrega de notificações num telefone bloqueado.


## TASK 25 — alternativas em fotografia e destino incompleto

A visita permite escolher uma fotografia existente sem forçar a câmara, indicando Antes/Depois/Problema. Cancelar, escolher um ficheiro vazio/não imagem/acima de 25 MB ou falhar a gravação local apresenta mensagem persistente sem afirmar que a fotografia foi guardada. A confirmação local é distinta da confirmação do servidor. A escolha de ficheiro existente usa a mesma fila offline e deduplicação.

Os links do cartão de destino ficam indisponíveis quando não existem coordenadas nem morada. O cartão pede a localização ao escritório; havendo apenas morada, pesquisa essa morada, sem adivinhar pelo nome do cliente/piscina. O mapa geral da ronda continua disponível.

Chromium cobre cancelamento, tipo inválido, falha de armazenamento, alternativa de ficheiro sem captura obrigatória, fotografia offline/reconexão, destino sem dados e recuperação com morada sem permissão de geolocalização. A abertura efetiva da câmara de Android/iOS continua a exigir ensaio físico; cancelamento do seletor não é apresentado como prova de permissão recusada.


## TASK 26 — envios rejeitados e espera temporária

Uma rejeição definitiva mantém o registo na fila local, com nome da visita e orientação para confirmar com o escritório. Os detalhes dos pendentes oferecem repetição explícita após confirmação, usando a mesma identificação do envio. O servidor volta sempre a validar permissões e stock; o botão não altera a atribuição nem ignora a rejeição.

Respostas 408/425/429 são temporárias. O pedido de espera 429 respeita Retry-After, com intervalo de 30 segundos a uma hora, antes da repetição automática. Registos bloqueados não são repetidos pelo temporizador. Uma correção explicitamente submetida pelo técnico pode substituir o corpo rejeitado, conservando o rascunho no fluxo habitual.

Dois cenários Chromium adicionais verificam preservação após 403/repetição explícita e 429/espera/repetição automática. A bateria de API continua a verificar rejeição real de visitas de outro técnico e stock insuficiente. Não foi simulada comunicação real com o escritório.


## TASK 27 — proteger filas locais ilegíveis

Uma fila local com JSON interrompido, estrutura inesperada ou identificação de visita incoerente apresenta aviso persistente e bloqueia substituição dos dados e novos envios nessa fila. Não é tratada como fila vazia para gravação. Os bytes originais ficam intactos para diagnóstico; não há limpeza ou recuperação automática inventada.

Chromium verifica três formas de dano, tentativa de nova conclusão, ausência de pedidos ao servidor e preservação literal do conteúdo. A reposição de uma fila válida remove o aviso no ensaio; não foi realizada qualquer limpeza de dados de utilizadores.

## TASK 28 — completar ações do portal cliente

Ligado o seletor de anexos ao endpoint autenticado existente, com tipos JPG/PNG/WebP/GIF/PDF e limite de 25 MB. Mensagens, pedidos de visita e avisos de pagamento têm proteção contra duplo toque e falha de rede visível; o texto não é limpo antes da confirmação. Mensagens recebidas por socket e pela resposta HTTP são deduplicadas pelo ID.

Documentos, notificações e permissões carregam independentemente. Uma falha num bloco mostra erro/repetição nesse bloco, preservando piscinas e conta. O histórico de mensagens verifica respostas HTTP antes de apresentar um estado vazio.

Chromium/API aprovados: documentos indisponíveis com piscinas visíveis, recuperação explícita, mensagem preservada após falha, um POST perante dois cliques e anexo efetivamente persistido na conversa do cliente. Os testes usam notificações externas desativadas.


## TASK 29 — apresentação dos portais e estado parcial da gestão

Restabelecida a folha base do layout que faltava ao portal cliente. Navegação móvel única, logótipo contido, controlos de toque, resumo compacto e idioma visível alinhado com os textos. Etiquetas curtas na barra inferior conservam nomes completos acessíveis. Na gestão, links laterais ganham contraste e o resumo deixa de mostrar texto sobre a implementação.

O estado de atualização do centro de comando inclui agora a resposta dos técnicos. Uma falha nessa resposta produz Dados parciais, em vez de afirmar sincronização completa; atualização posterior recupera o estado. Chromium verifica falha/recuperação, idioma PT e ausência de overflow do cliente a 320/390/768 px. Revisão visual do portal realizada com dados de demonstração. Não constitui certificação da migração histórica de todas as páginas.

## TASK 30 — respostas de IA completas e modo de demonstração explícito

O adaptador Responses agrega blocos output_text dentro das mensagens, sem assumir que o primeiro elemento é texto nem depender da propriedade de conveniência do SDK. Rejeita resposta incompleta, vazia ou de recusa, com orientação para revisão humana. Pedido limitado a 20 segundos. O modo de demonstração afirma que não gerou análise técnica.

Quatro testes unitários com respostas simuladas verificam texto em vários blocos, resposta incompleta, recusa/vazio e indisponibilidade/demonstração. Não foram feitas chamadas pagas nem configurados serviços externos. Referência: https://developers.openai.com/api/docs/guides/text (consultada em 14/09/2026).

## TASK 31 — lembrete persistente de bomba em manual

Completado o percurso de registo da bomba em manual: prazo explícito de 1–1440 minutos, nome da piscina e técnico, tempo em curso, aviso persistente nos separadores e confirmação humana de regresso a automático. O lembrete não comanda a bomba nem comprova o estado físico.

A fila local preserva criação e fecho sem rede, incluindo recarga. O servidor reutiliza OperationalReminder com origem pump, idempotência, autorização por responsável, histórico e alerta crítico. O temporizador e a entrega Web Push incluem os lembretes vencidos da bomba; o fecho resolve apenas os avisos correspondentes. Não foi criada migração nem instalado qualquer componente no VPS.

API verifica responsável, repetição, escalada sem navegador, fecho e separação da lista de água. Chromium verifica registo offline, recarga, confirmação física simulada no diálogo e sincronização de criação/fecho. Entrega num telefone real permanece um ensaio externo.

## TASK 33 — cor coerente do estado do cliente

Na inspeção final, o estado atrasado herdava o verde genérico. O estado delayed passa a aviso âmbar; ausência de agenda/fora de horas fica neutra e intervenção em curso azul. Mantêm-se os textos explícitos, sem depender apenas da cor. Verificação visual e percurso Chromium do portal repetidos.

## TASK 34 — isolamento da ficha perante respostas atrasadas

Carregamentos do portal, histórico, mensagens e secções complementares verificam a seleção e a revisão do pedido antes de alterar o ecrã. Respostas e erros antigos são ignorados, incluindo a sequência cliente A → B → A. Mensagens em tempo real têm de identificar o cliente atualmente selecionado. Um envio anterior não limpa o rascunho nem altera o estado da nova ficha.

Ao trocar de cliente, os dados anteriores são retirados imediatamente; rascunhos e seleção de anexo ficam separados por cliente, apenas em memória durante esta página (não são uma fila persistente). Os botões de envio permanecem bloqueados enquanto a ficha não carrega. O teste revelou também que o guard rejeitava o acesso administrativo apesar do botão existente na gestão: passa a admitir ADMIN apenas nesta página, sem substituir a identidade de cliente na sessão. A pré-visualização administrativa mantém os envios bloqueados; não foram alargadas permissões do servidor.

Nove novos testes unitários verificam contexto, respostas fora de ordem, proteção do rascunho, botões e sessão administrativa. O percurso Chromium usa dois clientes reais na base de ensaio, retém uma resposta HTTP de A até B carregar e verifica os dados, o modo de consulta e o regresso ao rascunho de A. Sem alterações de esquema, instalação no servidor ou testes em telefones físicos.

Validação local desta alteração: 76 testes unitários aprovados; os 4 testes específicos do técnico também repetidos; 9 cenários de navegador aprovados; 15 grupos integrados aprovados em reports/field-suite/1789406986837. Sintaxe dos três scripts alterados e git diff --check sem erros. Esta alteração ainda não foi publicada nem executada na CI remota.

Ficheiros: frontend/client-portal.js, frontend/client-auth-guard.js, tests/client-portal-context.test.js, scripts/test-field-e2e.js e este relatório.

## TASK 35 — revisão operacional antes de sair

Adicionada a secção Antes de sair no separador Hoje, sem criar um novo módulo. A revisão apresenta água aberta e bombas em manual primeiro, trabalhos por concluir, conclusões na fila local, fotografias IndexedDB por enviar e ocorrências locais não enviadas. Distingue confirmação física de confirmação no servidor e não considera a ronda confirmada quando carregada de cache ou sem rede. Trabalhos de amanhã abertos para apoio não contam como pendências de hoje.

A consulta de fotografias respeita a conta atual e não cria URLs de blobs. A revisão é apenas de leitura: não encerra jornadas, não resolve alertas e não transfere responsabilidade. Dados ilegíveis produzem verificação inconclusiva, preservando o conteúdo original. O resultado tem hora da consulta e da última ronda confirmada e é invalidado após mudanças de ligação, dados entre separadores, registos sincronizados, edição, visibilidade ou 60 segundos. Não substitui reconciliação com o escritório nem confirmação física no local.

Testes acrescentados: seis casos unitários de classificação e preservação; percurso Chromium offline com conclusão pendente, fotografia, bomba manual e corrupção simulada recuperável. Publicação e aceitação em telefone físico continuam pendentes.

O ensaio de acesso à revisão após recarga offline detetou expansão horizontal e separadores fora da área de toque: a animação genérica dos painéis substituía temporariamente a translação da barra fixa. Desativada apenas nessa barra; incluídas também as duas folhas de estilo da página que faltavam no pré-carregamento offline. O teste confirma largura sem overflow e acesso aos separadores por clique normal, sem forçar eventos.

Ficheiros desta tarefa: frontend/cw-field-day-review.js, frontend/technician-field-mode.js, frontend/technician-field-mode.html, frontend/cw-field-photos.js, frontend/cw-field-professional.css, frontend/sw.js, tests/field-day-review.test.js, scripts/test-field-e2e.js e este relatório.

Validação local: 82 testes unitários aprovados, incluindo os 6 novos; 4 testes específicos do técnico repetidos; 9 cenários de navegador aprovados; 15 grupos integrados aprovados em reports/field-suite/1789407598502. Sintaxe do backend e scripts frontend alterados aprovada; git diff --check sem erros. Sem publicação ou execução de CI remota nesta tarefa.

## TASK 36 — confirmação no servidor e legibilidade da revisão diária

A revisão consulta em paralelo a ronda atual, água aberta e bombas manuais, com limite de 8 segundos por pedido. Inclui lembretes ativos criados noutro dispositivo sem duplicar os já presentes e preserva confirmações físicas locais ainda por enviar. Falhas parciais são explícitas e não apagam os restantes dados. Uma água fechada com closeSyncedAt deixa de ser apresentada como envio pendente. Respostas após alteração de conta, token ou revisão não são aplicadas ao contexto novo.

Layout organizado em três grupos: atenção imediata, por concluir/enviar e por confirmar. A inspeção de imagem revelou que o adaptador genérico de estados transformava o resumo rico numa caixa flex estreita; adicionado opt-out explícito apenas para painéis que gerem os seus estados. Corrigido o contraste do botão. Chromium verifica a largura útil dos grupos (não apenas ausência de overflow), preservação do papel acessível e contraste declarado, em 320/390/768 px. Imagem de QA inspecionada após correção.

Cinco novos testes unitários cobrem falha parcial, lembrete remoto, deduplicação/fecho local, fecho remoto e fecho sincronizado. Teste integrado cria um lembrete na base de ensaio fora do telemóvel e simula HTTP 503 na consulta de água. Ambiente: backend Node e base PostgreSQL compatível PGlite/TCP isolados, com Chromium; não é o VPS de produção nem uma nova execução PostgreSQL 16 nativa da CI.

Ficheiros desta tarefa: frontend/cw-field-day-review.js, frontend/cw-field-professional.css, frontend/technician-field-mode.html, frontend/ui/state-adapter-v2.js, frontend/sw.js, tests/field-day-review.test.js, scripts/test-field-e2e.js e este relatório. Sem migrações ou publicação; o fecho da jornada e a transferência formal de responsabilidades não foram acrescentados nesta tarefa.

Resultados: 87 testes unitários aprovados, 4 testes específicos do técnico repetidos, 9 cenários de navegador aprovados, 455 scripts backend com sintaxe aprovada e scripts frontend alterados sem erros de sintaxe. Os 15 grupos integrados passaram na execução final reports/field-suite/1789408141438, incluindo técnico offline, cliente, gestão, stock, finanças, reparações e simulação mensal.

## TASK 37 — passagem aceite de responsabilidade sobre lembretes críticos

Implementado pedido, aceitação e cancelamento de passagem de água aberta/bomba em manual. Motivo obrigatório, destinatário ativo e identificador único por pedido. O responsável original mantém a responsabilidade e os alertas até o destinatário aceitar. Só o destinatário técnico pode aceitar; após aceitação o anterior não pode fechar o lembrete. Bloqueio transacional da linha impede aceitação simultânea, cancelamento ou fecho de produzir duas responsabilidades. Repetição da mesma aceitação é idempotente. Uma passagem cancelada ou de um lembrete já fechado não pode ser aceite.

Histórico técnico regista pedido, motivo, origem, destino, aceitação e cancelamento. Metadados identificam o autor e papel, datas e antigos responsáveis. O alerta vencido passa a ter uma notificação durável para o destinatário aceite. As listas assinalam explicitamente a transferência aos antigos responsáveis para reconciliar o telemóvel sem marcar água fechada/bomba automática; a lista de antigos responsáveis resiste a passagens subsequentes.

Interface no separador Hoje: escolher colega, indicar motivo, pedir, cancelar e aceitar com confirmação. Lista apenas nomes e identificadores dos técnicos ativos. Sem rede ou resposta perdida, a interface não afirma transferência e pede atualização. O pedido não constitui comprovativo de leitura; o técnico deve combinar a passagem com o colega. Não há aceitação automática nem transferência offline. A funcionalidade transfere o lembrete crítico, não a visita inteira ou a jornada. Comunicação push em telefone físico não foi certificada.

API: responsável original, destinatário, pedido repetido, identificador antigo, aceitação concorrente, cancelamento, fecho antes de aceitar, reconciliação e permissão de fecho após transferência. Chromium: dois técnicos em sessões móveis separadas pedem e aceitam uma bomba; a base confirma a mudança apenas após aceitação e o painel original retira o lembrete transferido.

Ficheiros: src/services/waterReminderService.js, src/routes/technicianRoutes.js, frontend/cw-pump-reminders.js, frontend/crystal-os-v2-shell.js, frontend/cw-field-day-review.js, frontend/cw-field-professional.css, frontend/sw.js, scripts/test-field-water-api.js, scripts/test-field-e2e.js e este relatório. Sem migração de esquema ou publicação.

Validação: 87 testes unitários aprovados, 4 específicos do técnico repetidos, 9 cenários de navegador aprovados e 15 grupos integrados em reports/field-suite/1789409252994. API e percurso móvel repetidos após os ajustes finais de contraste/metadados em run-1789409367126, ambos aprovados. Sintaxe e git diff --check sem erros. Captura móvel da passagem pendente inspecionada.

## TASK 38 — atribuição de rondas por datas ou sem fim

Requisito confirmado pelo utilizador: rondas/rotas podem mudar de técnico por um dia, uma semana, um mês, entre uma data X e uma data Y (mesmo atravessando anos), ou sempre. Implementada a validade da atribuição com início explícito, último dia incluído e opção sem fim. A semana corresponde a 7 dias a partir do início; o mês avança um mês de calendário, ajustando ao último dia existente quando necessário; a confirmação mostra o intervalo efetivo. Não é uma nova frequência mensal de manutenção: a periodicidade da ronda existente mantém-se.

RoundAssignment preserva técnico, ronda, intervalo, motivo, autor e data. A regra mais recente prevalece nas datas coincidentes. Fora de uma substituição temporária, aplica-se a regra anterior válida ou o técnico habitual. Novas visitas geradas consultam a atribuição válida para a data; visitas ainda não iniciadas no intervalo são atualizadas na mesma transação. Visitas iniciadas, concluídas e datas passadas não são reatribuídas por este percurso. Água aberta/bomba manual mantêm responsabilidade independente e exigem passagem aceite.

Formulário integrado em Rondas: validade, início, fim, motivo e pré-visualização sem escrita. Confirmação mostra contagens de visitas elegíveis/preservadas, datas e técnico. O cartão da ronda mostra a atribuição da próxima ocorrência e lista o histórico de períodos. O plano semanal resolve o técnico para cada dia. A geração concorrente usa bloqueio por ronda e piscina para evitar duplicação entre pedidos de geração.

Migração aditiva 20260914190000_round_assignment_periods criada e ensaiada a partir do esquema anterior, preservando dados e verificando ausência de diferenças para o esquema atual. Prisma validado e cliente regenerado. Migração não aplicada ao VPS.

Ensaios: intervalo entre 28/12 e 03/01, último dia incluído, regresso à base em 04/01, datas inválidas, fim anterior ao início, um dia/semana/mês e fevereiro bissexto, período permanente até data distante, preservação de visita iniciada, pré-visualização sem escrita, geração concorrente e plano semanal. Chromium verifica formulário permanente, campo de fim oculto e cancelamento da confirmação sem criar atribuição.

Ficheiros: prisma/schema.prisma, prisma/migrations/20260914190000_round_assignment_periods/migration.sql, src/business/admin/RoundAssignmentBusiness.js, src/controllers/adminRoundsController.js, src/controllers/roundController.js, frontend/admin-rounds.html, frontend/admin-rounds.js, scripts/test-route-os-acceptance.js, scripts/test-field-migrations.js e este relatório.

Resultados finais: 87 testes unitários aprovados, 4 específicos do técnico repetidos, 15 grupos integrados aprovados em reports/field-suite/1789410120057. Teste das quatro migrações aditivas aprovado, preservando dados anteriores e sem diferenças para o esquema atual. Sintaxe dos scripts alterados e git diff --check sem erros. Sem publicação nem migração em produção.

## TASK 39 — visita impedida ou por concluir

No separador Visita, o técnico pode indicar acesso impedido, chave indisponível/incorreta, recusa do cliente, falta de material, avaria, condições meteorológicas ou outro motivo. Próximo passo obrigatório. O registo guarda estado INCOMPLETE, histórico técnico, seguimento pendente e aviso durável à gestão; não inventa limpeza, leituras, consumo de produtos ou hora de conclusão e não fecha água/bomba. Fotografias usam a área existente e os rascunhos ficam separados por visita.

Fila local por técnico conserva o registo antes do pedido. UUID estável e transação impedem duplicação após repetição/concorrência. Recarga sem rede conserva o impedimento e um aviso em todos os separadores identifica registos por confirmar. Mudança de conta/token impede aplicar resposta à sessão nova. Falhas de autorização/conflito bloqueiam repetição automática e exigem confirmação antes de reenviar; Retry-After adia nova tentativa. Falha num registo não impede tentar os restantes. A fila não é apagada perante erro de leitura.

Foi necessário permitir retomar e concluir uma visita INCOMPLETE. Só a conclusão efetiva resolve os seguimentos e avisos VISIT_INCOMPLETE da mesma visita, preservando os outros lembretes e o histórico. O novo registo não agenda automaticamente uma visita de regresso nem transfere a visita a outro técnico; o escritório decide esse próximo passo. Produtos usados parcialmente continuam nos rascunhos/fluxos de stock existentes; este botão não é um lançamento de consumo.

Validação específica: técnico estranho recusado, próximo passo vazio recusado, repetição concorrente cria um só seguimento/aviso, leituras e limpeza preservadas, visita concluída não reaberta. Chromium regista impedimento offline, recarrega, simula atribuição recusada, preserva a fila, confirma reenvio, recebe um só aviso e conclui posteriormente resolvendo o seguimento. Teste unitário da conclusão verifica os filtros exatos de resolução.

Ficheiros: src/business/technician/IncompleteVisitBusiness.js, src/routes/technicianRoutes.js, src/services/serviceVisitCompletionService.js, frontend/technician-field-mode.html, frontend/technician-field-mode.js, frontend/sw.js, scripts/test-field-water-api.js, scripts/test-field-e2e.js, tests/service-visit-completion-flow.test.js e este relatório. Sem migração adicional ou publicação.

Resultados: 87 testes unitários aprovados, 4 específicos do técnico repetidos, 9 cenários de navegador aprovados e 15 grupos integrados em reports/field-suite/1789410695306. Percurso Chromium repetido após acrescentar o cenário de bloqueio/reenvio e a verificação visual em run-1789410814329: aprovado, com captura móvel inspecionada. Sintaxe e git diff --check sem erros.

## TASK 40 — acompanhamento e regresso de visitas impedidas

A página Alertas inclui seguimento das visitas INCOMPLETE: piscina, cliente, técnico que reportou, impedimento, próximo passo e regresso associado. O escritório escolhe data, técnico ativo e instruções, confirma e cria uma visita de regresso independente. A data, o responsável, as leituras, a limpeza e o estado histórico da visita original não são substituídos. A nova visita aparece na rota do técnico atribuído; instruções internas surgem em destaque antes de entrar e ficam separadas das notas destinadas ao relatório do cliente.

Apenas ADMIN pode consultar este painel ou agendar. Datas inválidas/passadas, técnico inativo, impedimento encerrado e visita já existente para a mesma piscina/dia são recusados. Bloqueio transacional da visita e da piscina protege pedidos concorrentes; UUID estável devolve o regresso existente mesmo após cancelamento ou conclusão. Um pedido novo pode substituir um regresso cancelado, mantendo a cadeia anterior no seguimento. Não se altera automaticamente outra visita ou uma ronda existente para contornar conflitos.

Agendar não resolve o aviso. Apenas a conclusão efetiva do regresso resolve os seguimentos associados; uma sequência de regressos também resolve os impedimentos anteriores da mesma cadeia. A visita original permanece INCOMPLETE como histórico e não pode ser concluída novamente enquanto existir um regresso não cancelado, incluindo um já concluído. Novos impedimentos devem ser reportados na visita de regresso. Água aberta e bombas em manual continuam com o responsável anterior até à passagem explicitamente aceite.

Testes específicos: acesso sem papel ADMIN recusado, data impossível/passada, técnico inativo, conflito na mesma piscina/dia, concorrência e repetição, preservação da visita original, impedimento num regresso, terceira deslocação, cancelamento e repetição de pedido antigo, substituição por novo pedido e resolução da cadeia só após conclusão real. Chromium testa agendamento e recarga no escritório, largura de 320/390 px, presença do regresso na rota autenticada do outro técnico e instruções visíveis no ecrã de campo. Capturas de formulário e instruções revistas.

Ficheiros desta tarefa: src/business/technician/IncompleteVisitBusiness.js, src/routes/technicianRoutes.js, src/services/serviceVisitCompletionService.js, frontend/admin-alerts.html, frontend/admin-alerts.js, frontend/technician-field-mode.js, frontend/sw.js, scripts/test-field-water-api.js, tests/service-visit-completion-flow.test.js e este relatório.

Resultados: 457 ficheiros JS do backend com sintaxe válida; 87 testes unitários aprovados e 4 específicos do técnico repetidos. Os 15 grupos integrados passaram em reports/field-suite/1789411519972. Após o destaque visual das instruções, API e percurso de campo repetidos com êxito em run-1789411685364; 9 cenários de navegador aprovados. Verificação final da separação das instruções internas e nova captura em run-1789411772550. Sem migração adicional, commit ou publicação.

Limites: agendamento requer ligação; o técnico tem de atualizar a rota para receber a nova visita. Esta tarefa não envia confirmação externa ao cliente, não calcula deslocações/horários livres e não altera automaticamente uma visita existente em conflito. Servidor de produção e ensaio com telemóveis físicos continuam pendentes; a validação local utiliza PostgreSQL compatível em PGlite e Chromium.

## TASK 41 — controlo de manutenção e redistribuição de trabalho

Rondas passa a mostrar piscinas ativas com visitas em atraso, sem data/técnico ativo, impedimentos, ausência de ronda e ronda prevista hoje sem visita gerada. O controlo da última manutenção utiliza apenas visitas concluídas com endAt; uma visita agendada ou iniciada não serve de prova de manutenção. Clientes/piscinas inativos, em pausa, arquivados ou eliminados são excluídos. A revisão de antiguidade usa o maior intervalo das rondas atuais mais um dia de tolerância; sem ronda, oito dias. Esta indicação pede revisão, não prova que houve incumprimento contratual. Não reconstrói versões antigas das rondas nem representa a periodicidade de visitas extra.

Avisos duráveis VISIT_COVERAGE são exclusivos da gestão, um por piscina, protegidos contra execução concorrente. O processo reavalia e resolve avisos que deixam de ter causa, incluindo pausa do cliente. Foi removida a difusão global do alerta antigo. Verificação ao iniciar o servidor e a cada hora, independente dos motores de IA/faturação e da aplicação aberta; pode ser desativada por CW_VISIT_COVERAGE_ENABLED=false. Não inicia automaticamente em NODE_ENV=test. O painel indica quando a verificação automática está desativada. Isto não certifica entrega push num telemóvel fechado.

Transferência em lote de até 100 visitas regulares por iniciar, com técnico ativo, motivo (incluindo falta de química), pré-visualização e confirmação. Datas e histórico são preservados. Bloqueio ordenado de linhas, verificação de updatedAt e UUID impedem alterações sobre informação desatualizada e repetição do mesmo pedido. Uma seleção com visita iniciada, concluída ou impedida é recusada integralmente; a gestão deve rever a seleção. Água/bomba e visitas em curso não mudam de responsável por esta ação. A confirmação de receção pelo técnico não é presumida; o painel pede atualização da rota e contacto com o técnico.

Visitas INCOMPLETE históricas com regresso já resolvido ou em acompanhamento não reaparecem como trabalho original por transferir. A antiguidade da última manutenção continua a depender da conclusão efetiva do regresso.

Ficheiros: src/services/autoVisitAlertService.js, src/business/admin/VisitCoverageBusiness.js, src/controllers/adminRoundsController.js, src/routes/adminRoundsRoutes.js, src/server.js, frontend/admin-rounds.html, frontend/admin-rounds.js, tests/visit-coverage.test.js, scripts/test-route-os-acceptance.js e este relatório.

Validação: cadência semanal/múltiplos dias, calendário/viragem de ano, contas em pausa, visita apenas iniciada, falta de geração, técnico sem acesso à gestão, tarefas iniciadas excluídas, pré-visualização sem escrita, conflito após alteração simultânea, repetição concorrente com um único histórico, preservação da data, alertas deduplicados/resolvidos e regresso histórico excluído. Chromium confirma/cancela transferências em ecrã de 320/390 px. Primeira execução aprovada em run-1789412349948; repetição com filtro de regressos em run-1789412560193 aprovada. Formulário móvel inspecionado.

## TASK 42 — falta de produtos químicos em campo

Motivo próprio CHEMICAL_MISSING no registo de visita por concluir. Nome do produto obrigatório, quantidade opcional e unidade L/KG/UN. Quantidade desconhecida permanece por confirmar; zero, valores negativos, unidades inválidas e nomes vazios são recusados. Os campos integram o rascunho e a fila offline por visita/técnico. O escritório recebe descrição legível e dados estruturados no seguimento já existente, podendo organizar reposição e regresso sem outro módulo.

O registo não constitui dosagem, consumo de stock, compra, confirmação de entrega ou autorização para substituir um produto. Leituras, limpeza e hora de conclusão permanecem inalteradas. Quantidades informadas referem-se à necessidade de reposição, sem recomendação química automática.

Ficheiros: src/business/technician/IncompleteVisitBusiness.js, frontend/technician-field-mode.html, frontend/technician-field-mode.js, frontend/sw.js, scripts/test-field-water-api.js, scripts/test-field-e2e.js e este relatório.

Validação API: nome obrigatório, quantidade negativa/unidade inválida, quantidade desconhecida preservada, repetição sem duplicar e ausência de consumo de stock. Chromium guarda falta de 25 L de hipoclorito sem rede, recarrega, enfrenta rejeição de atribuição, reenvia após confirmação e verifica os mesmos produto/quantidade/unidade no servidor. Captura móvel revista em run-1789412560193. Service worker v15.

## TASK 43 — início de visita após redistribuição

A atribuição é validada novamente sob bloqueio da visita antes de registar o início. Iniciar uma visita transferida para outro técnico devolve recusa; estados concluídos/cancelados não podem ser iniciados. Repetição concorrente de início conserva o primeiro startAt e não repete o evento de início. Uma visita impedida com regresso associado não pode ser retomada pela via da visita original.

Ficheiros: src/business/technician/TechnicianVisitBusiness.js, src/routes/visitRoutes.js, src/controllers/visitController.js, scripts/test-field-water-api.js e este relatório.

Testes: técnico estranho recusado, início simultâneo/repetido mantém hora, mudança de responsável verificada dentro do Business e visita concluída recusada. Validação específica em run-1789412717917, além do percurso de campo e do grupo operacional de visitas.

Estado da entrega: alterações locais, sem commit, publicação ou migração adicional. PostgreSQL compatível em PGlite e Chromium; ensaio físico de campo e produção continuam pendentes. Reposição automática de stock, confirmação formal de receção da transferência pelo técnico e cálculo de carga/tempo de deslocação não foram apresentados como concluídos nesta entrega.

Resultados finais das TASKs 41–43: 90 testes unitários aprovados (29 ficheiros), 4 testes específicos do técnico repetidos, 9 cenários de navegador aprovados e os 15 grupos integrados aprovados em reports/field-suite/1789412764236. Sintaxe validada em 458 ficheiros JS do backend, com nova verificação dos ficheiros de início de visita após a proteção transacional. Verificação de diferenças sem erros, respeitando os finais de linha CRLF dos dois ficheiros existentes. Nenhuma falha pendente nos ensaios executados; isso não equivale a certificação de todos os cenários em produção.

## TASK 44 — confirmação de receção das visitas redistribuídas

Cada visita alterada pela redistribuição em lote cria um pedido de receção próprio, associado ao técnico destinatário e ao UUID da transferência. O pedido fica guardado no servidor. Transferências posteriores retiram os pedidos anteriores da lista ativa, preservando histórico e confirmações anteriores. Atribuições que já pertenciam ao técnico não criam pedidos redundantes.

No separador Hoje, o técnico consulta Novas visitas atribuídas e confirma explicitamente a receção de cada visita. O escritório vê nas Rondas o destinatário, visita, estado e data/hora da confirmação. Atribuição anterior confirmada, atribuição substituída e visita encerrada sem confirmação aparecem com estados distintos. Esta confirmação atesta receção do trabalho; não inicia nem conclui a visita e não aceita responsabilidade por água aberta ou bomba manual.

Só o técnico destinatário pode confirmar; nem o administrador confirma por ele. A transação bloqueia a visita e verifica destinatário atual e pedido mais recente. Repetição concorrente conserva a primeira data/hora e um único histórico. Transferência A→B→A→B não permite reutilizar o primeiro pedido de B. Visitas canceladas/concluídas não recebem confirmação nova. A confirmação exige rede e não apresenta sucesso local em modo offline. Consultas/atualizações protegem mudança de token/conta; atualização automática de minuto a minuto enquanto a página está aberta, além do botão e recuperação de ligação.

Âmbito: redistribuição em lote da TASK 41. Atribuições por regras de ronda, agendamento de regresso e outros caminhos não foram apresentados como tendo confirmação formal automática nesta tarefa. Não foi acrescentada entrega push quando a aplicação está fechada, nem prazo/escalada automática de pedidos de receção. O escritório mantém a necessidade de contacto se o técnico não confirmar.

Ficheiros: src/business/admin/VisitCoverageBusiness.js, src/routes/technicianRoutes.js, frontend/admin-rounds.html, frontend/admin-rounds.js, frontend/cw-field-day-review.js, frontend/sw.js, scripts/test-field-water-api.js e este relatório. Sem migração adicional, commit ou publicação; service worker v16.

Validação específica: destinatário/administrador recusados quando não autorizados, filtragem por técnico, confirmação concorrente sem duplicar histórico/início, pedidos antigos recusados após nova atribuição, cancelamento, ausência de rede sem confirmação falsa e confirmação no telemóvel visível no escritório. API e percurso de campo aprovados em run-1789413109747; captura móvel inspecionada. Sintaxe e verificação das diferenças sem erros. 90 testes unitários aprovados e 4 testes do técnico repetidos.

Resultados finais: os 15 grupos integrados passaram em reports/field-suite/1789413165927; os 9 cenários de navegador passaram. Após a verificação, foi reforçada a verificação do token também depois da atualização da lista de receções, antes de escrever a mensagem de sucesso. Mantêm-se pendentes publicação, servidor real e ensaios com telemóveis físicos.

## TASK 45 — receção unificada para rondas, geração e regressos

O serviço partilhado visitReceiptService cria o pedido de receção na mesma transação da atribuição. Redistribuição em lote, mudança de técnico por período de ronda, geração de visitas atribuídas e agendamento de regresso utilizam esse serviço. Repetição da geração ou do regresso não cria pedidos duplicados. Atribuições que mantêm o mesmo técnico não renovam desnecessariamente a confirmação.

As alterações de técnico por período bloqueiam as visitas em ordem e voltam a verificar a elegibilidade antes de alterar cada uma. Visitas entretanto iniciadas ficam preservadas. A geração volta a ler a ronda, a sua atribuição base e a presença da piscina na ronda; um técnico entretanto inativo/arquivado não recebe a visita gerada. A visita fica sem técnico, visível no controlo de cobertura, em vez de presumir disponibilidade.

No telemóvel, as atribuições de dias futuros ficam recolhidas numa secção expansível; o trabalho de hoje e em atraso aparece primeiro. A confirmação continua distinta do início/conclusão e da passagem de água/bomba. O estado de receção não é retroativamente inventado para visitas antigas criadas antes desta alteração. Caminhos manuais/legados não ligados ao serviço continuam a exigir revisão; não foi declarada cobertura universal de qualquer endpoint antigo.

Ficheiros: src/services/visitReceiptService.js, src/business/admin/VisitCoverageBusiness.js, src/business/admin/RoundAssignmentBusiness.js, src/business/technician/IncompleteVisitBusiness.js, frontend/admin-rounds.html, frontend/cw-field-day-review.js, frontend/sw.js, scripts/test-route-os-acceptance.js, scripts/test-field-water-api.js e este relatório.

Testes: um pedido por visita de ronda/regresso, repetição concorrente sem duplicação, visita iniciada sem novo pedido, geração com técnico entretanto inativo deixa visita por atribuir e apresentação recolhida/expansível das visitas futuras. Service worker v17.

## TASK 46 — geração semanal sem destruição de registos

A antiga opção force=true deixou de apagar visitas PLANNED. A geração é aditiva e preserva IDs, notas, leituras e pedidos de receção existentes. O botão passou a Verificar visitas em falta, com confirmação que explica a preservação do planeamento existente. Alterar uma atribuição/data continua a ser uma ação de planeamento própria.

O caminho de geração sem rondas reutiliza a criação transacional com bloqueio por piscina/dia. Duas gerações concorrentes não criam visitas duplicadas. A prontidão operacional passa a verificar também pausa/arquivo/eliminação da piscina e do cliente, incluindo nova validação dentro da transação de geração. Não apaga nem cancela automaticamente visitas anteriormente planeadas quando um cliente entra em pausa.

Ficheiros: src/controllers/roundController.js, src/business/admin/RoundAssignmentBusiness.js, src/utils/poolReadiness.js, frontend/admin-rounds.html, frontend/admin-rounds.js, scripts/test-route-os-acceptance.js e este relatório.

Testes: geração normal/forçada conserva a visita, notas, pH e pedido de receção; duas criações simultâneas pelo caminho sem ronda produzem uma visita; cliente em pausa bloqueia nova geração. Grupo operacional de rondas aprovado em run-1789413686886 e, após a leitura atual da atribuição, em run-1789413878241.

## TASK 47 — aviso por falta de confirmação do técnico

O processo horário de cobertura verifica pedidos de receção pendentes há pelo menos 30 minutos, apenas para trabalho de hoje, em atraso ou sem data. Visitas de dias futuros não geram avisos antecipados. O aviso interno VISIT_RECEIPT_PENDING é exclusivo da gestão, identifica visita/técnico e recomenda confirmar o contacto antes de presumir receção. Há um aviso por pedido, preservado durante a pendência.

Confirmar receção resolve o aviso na mesma transação. Atribuição substituída, cancelamento e conclusão deixam de justificar esse aviso na verificação seguinte. Verificação automática e confirmação bloqueiam a visita de forma consistente e releem o pedido, evitando recriar aviso sobre confirmação simultânea. Não há envio externo, compra de produtos ou entrega push certificada. Como o processo corre de hora a hora, o aviso surge na primeira execução após os 30 minutos, não necessariamente no minuto 30.

Ficheiros: src/services/visitReceiptService.js, src/services/autoVisitAlertService.js, src/business/admin/VisitCoverageBusiness.js, scripts/test-field-water-api.js e este relatório.

Testes: pedido antigo produz apenas um aviso mesmo com duas verificações concorrentes, confirmação resolve-o, confirmação/verificação simultâneas terminam sem aviso pendente e visita futura não é alertada. API aprovada em run-1789413878241.

Estado: sem migração adicional, commit ou publicação. A entrega continua local. Validação do servidor real, configuração operacional dos avisos e ensaios físicos de campo continuam necessários. Estes resultados não representam certificação a 100% de todos os módulos e cenários.

Resultados finais das TASKs 45–47: 90 testes unitários aprovados e 4 específicos do técnico repetidos; 9 cenários de navegador aprovados; 15 grupos integrados aprovados em reports/field-suite/1789413789048. Após os últimos reforços de concorrência e apresentação, API e rondas aprovadas em run-1789413878241, e API/percurso de campo aprovados em run-1789413944753, incluindo a expansão das atribuições futuras. Sintaxe válida em 459 ficheiros JS do backend; diferenças verificadas sem erros.

## TASK 48 — preparação de química para as visitas

A gestão vê Preparar reposição de química na área de acompanhamento das visitas por concluir. O técnico vê Química a preparar no separador Hoje, com produto, quantidade/unidade, piscina, visita e data. As listas utilizam necessidades reportadas ainda abertas; não calculam doses, não somam produtos com unidades diferentes e não representam entrega, compra ou movimento de stock.

A necessidade acompanha a visita de regresso e o seu técnico atual. Uma sequência de regressos é percorrida para encontrar a visita operacional correspondente. Para o mesmo produto/unidade nessa sequência, prevalece o registo mais recente, evitando somar pedidos repetidos. Quantidade desconhecida mantém-se por confirmar. Os técnicos só recebem necessidades das suas visitas atuais; a gestão pode consultar todas. Não são incluídos contactos ou valores financeiros.

As listas atualizam mediante botão, recuperação de ligação e, no técnico, a cada minuto enquanto a página estiver aberta. Sem rede ou com erro, mostram explicitamente que não houve confirmação atual. Respostas atrasadas não são aplicadas após mudança de conta/token. A lista não substitui a consulta do stock da viatura nem certifica disponibilidade física.

Validação API: quantidade desconhecida, isolamento entre técnicos, substituição do pedido de 25 L por outro mais recente, transferência da necessidade para o técnico do regresso e ausência de duplicação quando o próprio regresso volta a reportar 10 L do mesmo produto. Chromium confirma apresentação de 25 L após registo/sincronização do impedimento; inspeção visual detetou baixo contraste no botão, corrigido para texto branco e protegido por verificação de estilo.

Ficheiros: src/business/technician/IncompleteVisitBusiness.js, src/routes/technicianRoutes.js, frontend/admin-alerts.html, frontend/admin-alerts.js, frontend/cw-field-day-review.js, frontend/sw.js, scripts/test-field-water-api.js, scripts/test-field-e2e.js e este relatório. Sem migração adicional, commit ou publicação; service worker v18.

Resultados específicos: API e percurso de campo aprovados em run-1789414253438. 90 testes unitários aprovados, 4 específicos do técnico repetidos e 9 cenários de navegador aprovados. Sintaxe dos ficheiros alterados e diferenças verificadas sem erros. Produção e ensaios físicos continuam pendentes.

Fecho da validação: os 15 grupos integrados passaram em reports/field-suite/1789414303680. Após a correção de contraste, o percurso de campo foi repetido com sucesso em run-1789414328545 e a captura final foi inspecionada.

## TASK 49 — integridade dos movimentos de stock

Antes de ligar necessidades reportadas a reposições físicas, foi corrigida a base de transferência do Equipment & Stock OS. O saldo passa a ser alterado por incremento/débito atómico, com proteção contra saldo negativo e bloqueio por chave de stock. Transferências usam ordem consistente de produto/unidade e armazém antes da viatura, incluindo devoluções. Falha num item desfaz toda a transação; uma devolução sem stock suficiente não aumenta o saldo central.

Pedidos com requestId UUID estável são idempotentes: repetição concorrente devolve o mesmo movimento, sem novo débito/crédito. Reutilizar o identificador com outros dados materiais ou outro ator devolve conflito. Chamadas legadas sem requestId continuam aceites por compatibilidade e não receberam uma garantia de idempotência; os clientes devem conservar e reutilizar esse identificador.

Todos os itens são validados antes da escrita. Sentido desconhecido, elementos nulos, quantidades booleanas, negativas/nulas, nomes/unidades inválidos e viatura inativa/inexistente são recusados. Técnicos podem transferir stock apenas da viatura que lhes está atribuída; a gestão pode movimentar outras viaturas. O ator e identificador de utilizador enviados à camada de negócio provêm da sessão, não de dados escolhidos no pedido.

A chave de saldo central pode ter duplicados legados devido ao vehicleId nulo. A operação agora deteta mais de um saldo correspondente e recusa movimentar essa chave, pedindo reconciliação. Não soma, elimina ou escolhe automaticamente um dos saldos, pois seria necessário confirmar o inventário físico. Stock insuficiente ou ambíguo produz resposta controlada 409 tanto nas transferências como no consumo pelo endpoint deste módulo.

Testes: duas transferências concorrentes de 7 L com saldo inicial de 10 L produzem um movimento aprovado e um conflito, com 3 L no armazém e 7 L na viatura; repetição do mesmo pedido produz um único movimento; alteração do pedido identificado é recusada; direção/item inválido e viatura alheia recusados; devolução excessiva reverte o crédito central; devolução válida repõe 10 L; saldo central duplicado é bloqueado sem movimento; consumo acima do disponível é recusado sem falha não tratada.

Ficheiros: src/dal/EquipmentStockRepository.js, src/business/operations/EquipmentStockOsBusiness.js, src/controllers/equipmentStockOsController.js, tests/equipment-stock-os-business.test.js, scripts/test-equipment-stock-os-operational.js e este relatório.

Validação específica em servidor isolado aprovada em run-1789414783219. Uma execução integrada iniciada antes dos últimos reforços recebeu um teste novo contra a versão anterior do servidor e falhou; foi substituída por execução integral num servidor novo com código estável. Sem alteração de esquema, commit ou publicação. A ligação do pedido de química à confirmação de entrega física continua pendente; este trabalho não foi apresentado como inventário físico confirmado nem como reconciliação de todos os mecanismos legados de stock.

Resultados finais da TASK 49: 90 testes unitários aprovados e 4 específicos do técnico repetidos; os 15 grupos operacionais integrados passaram em reports/field-suite/1789414814999, incluindo o percurso de campo no navegador e os cenários concorrentes de stock. Sintaxe dos ficheiros alterados e diferenças verificadas sem erros. A bateria separada de 9 cenários de navegador não foi repetida nesta tarefa, que não alterou o frontend. Resultados obtidos em servidor isolado com PGlite; validação em PostgreSQL de produção, servidor real e telemóveis físicos continua pendente. Alterações locais, sem publicação.

## TASK 50 — confirmação de receção de química por necessidade

O técnico pode confirmar uma quantidade efetivamente recebida a partir de uma transferência para a viatura já registada no Equipment & Stock OS. A opção aparece dentro de Química a preparar, sem novo módulo. Apresenta transferências posteriores ao reporte da falta, do mesmo produto/unidade e da viatura atualmente atribuída, com quantidade ainda disponível para confirmação. A lista apresenta até 100 movimentos recentes dessa viatura; transferências anteriores ao reporte e outros mecanismos legados de entrega não são ligados automaticamente.

A confirmação guarda necessidade, visita atual, movimento, viatura, quantidade, utilizador que registou a transferência, técnico que confirmou e momento de receção. É um registo de receção histórica, não uma medição de stock físico atual nem uma prova independente da identidade de quem fez a entrega física. Não efetua novo débito/crédito, não calcula dose, não dá a visita como concluída e não elimina o impedimento. Aceita entregas parciais; uma necessidade sem quantidade definida continua por confirmar quanto ao total necessário.

O servidor bloqueia quantidades superiores à transferência ainda não associada ou à necessidade por receber. Um mesmo movimento não pode ser integralmente associado a várias necessidades. Pedidos simultâneos usam bloqueios de movimento/visita e identificadores idempotentes; repetição do mesmo pedido devolve a mesma confirmação e reutilização com outros dados é recusada. Necessidade fechada, substituída ou reatribuída deixa de aceitar uma nova confirmação pelo técnico anterior. A gestão consulta o estado, mas não confirma em nome do técnico.

A quantidade recebida apresentada corresponde ao técnico e à viatura atuais. Após mudança de técnico ou viatura, receções anteriores ficam identificadas no histórico da gestão e não são tratadas como recebidas pela nova atribuição. Não há transferência física automática entre viaturas nem reutilização automática de uma entrega já associada.

O formulário tem seleção de transferência, quantidade decimal, botão explícito de receção e cancelamento. Atualizações periódicas não substituem um formulário aberto. O identificador é guardado no dispositivo antes do envio e reutilizado após falha de rede, incluindo recarregamento da página com os mesmos dados. Sem rede não apresenta receção confirmada. Dados introduzidos no formulário não são uma fila automática de entregas: uma nova tentativa requer ação explícita do técnico. Respostas de outra conta/token são ignoradas. O service worker passou a v19.

A gestão vê recebido, por receber e histórico com técnico/data na área de acompanhamento existente. Quantidade desconhecida não é convertida em zero necessário. As mensagens distinguem receção de conclusão da visita; confirmar receção não garante que o produto continua na viatura após consumo ou devolução.

Ficheiros: src/business/technician/ChemicalDeliveryBusiness.js (novo), src/business/technician/IncompleteVisitBusiness.js, src/routes/technicianRoutes.js, frontend/cw-field-day-review.js, frontend/admin-alerts.js, frontend/sw.js, scripts/test-equipment-stock-os-operational.js, scripts/test-field-e2e.js e este relatório.

Validação específica aprovada em run-1789415594498: opções de entrega, receção parcial, repetição concorrente, conflito de identificador, limites de associação por movimento, sentido/produto incorreto, bloqueio administrativo, mudança de técnico/viatura, necessidade encerrada e quantidade total desconhecida. Chromium confirmou a sequência com perda da resposta após gravação e repetição sem duplicação, mostrando 5 L recebidos de 25 L necessários e mantendo 8 L no saldo da viatura. A visita permanece INCOMPLETE. 90 testes unitários, 4 específicos do técnico e 9 cenários de navegador aprovados. Sintaxe e diferenças verificadas. Sem migração adicional, commit ou publicação; testes em servidor isolado com PGlite, não em produção.

Resultados finais da TASK 50: os 15 grupos integrados passaram em reports/field-suite/1789415674107. Após o reforço final do formulário (invalidar respostas anteriores à sua abertura, limpar a lista ao mudar de sessão, preservar a quantidade durante atualização automática e bloquear controlos durante envio), o percurso de campo passou novamente em run-1789415774068; os 9 cenários separados de navegador também passaram novamente. Captura móvel final inspecionada. Sintaxe e diferenças válidas. O código permanece local e não publicado; servidor real, instalação e ensaio com telemóveis físicos continuam pendentes.

## TASK 51 — carga de química ligada ao acompanhamento da gestão

A gestão pode registar a carga física diretamente na necessidade reportada, usando o produto/unidade dessa necessidade e a viatura atribuída ao técnico. O formulário apresenta matrícula, quantidade e confirmação explícita; só deve ser usado depois da carga física. Reutiliza a transferência existente de armazém para viatura. Não representa compra, reserva de material ou confirmação de receção pelo técnico.

Dentro da transação, o servidor bloqueia as visitas relevantes e o técnico e volta a verificar necessidade, atribuição, viatura, produto e unidade. Uma necessidade encerrada/substituída, viatura alterada ou técnico inativo impede novo movimento. A gestão é o único perfil autorizado a criar estas cargas associadas. Para quantidade conhecida, cargas concorrentes não podem exceder a necessidade ainda por cobrir. O cálculo inclui receções anteriores de movimentos não associados, sem voltar a somar receções dos movimentos já associados.

O pedido fica identificado antes do envio. Perder a resposta não implica voltar a carregar fisicamente; repetir com os mesmos dados recupera o movimento existente. A interface mostra cargas associadas e receções separadamente. O total necessário desconhecido mantém-se sujeito a confirmação humana. Movimentos legados não associados e devoluções posteriores não são automaticamente reconciliados com a necessidade: o registo de carga é histórico e não certifica stock físico atual. A gestão deve rever movimentos posteriores antes de decidir uma nova reposição.

Ficheiros: src/business/operations/EquipmentStockOsBusiness.js, src/business/technician/IncompleteVisitBusiness.js, frontend/admin-alerts.js, frontend/sw.js, scripts/test-equipment-stock-os-operational.js, scripts/test-field-e2e.js e este relatório. Service worker v20. Sem migração, commit ou publicação.

API aprovada em run-1789416315643: exclusividade da gestão, viatura desatualizada, produto incorreto, cargas concorrentes com limite, contabilização de receções legadas e repetição sem novo débito.

Percurso visual da TASK 51 aprovado em run-1789416377426: a gestão regista 8 L no ecrã de acompanhamento, perde a resposta depois da gravação, repete e obtém um único movimento. O técnico confirma depois 5 L, também com perda de resposta simulada, sem duplicar receção ou consumo. Captura do formulário da gestão inspecionada.

## TASK 52 — autorização e repetição segura do consumo operacional

O endpoint de consumo do Equipment & Stock OS passou a receber a identidade da sessão, em vez de confiar num ator ou utilizador indicado no corpo. Dentro da transação bloqueia e relê a visita; para o técnico, confirma a atribuição e bloqueia/relê a sua ficha antes de aceitar a viatura. Visita alheia ou viatura não atribuída é recusada. Viaturas indisponíveis e visitas encerradas não aceitam um novo consumo; correções de visitas concluídas devem seguir o procedimento próprio de correção.

Transferências e consumos partilham a normalização/validação de produtos: entre 1 e 100 itens, nomes/unidades limitados, quantidades positivas finitas e rejeição de elementos inválidos. Um item inválido impede todo o lote, em vez de ser ignorado. A ordem de produto/unidade é estável para limitar conflitos de bloqueio.

Consumos com requestId UUID estável são idempotentes. Repetição concorrente devolve os mesmos movimentos; usar o mesmo identificador com outra quantidade gera conflito. Recuperar a resposta de um consumo já aceite continua possível depois de encerrar a visita, sem novo débito. Chamadas legadas sem requestId continuam compatíveis e não recebem garantia de idempotência. O fluxo existente de conclusão da visita mantém o seu mecanismo próprio; esta tarefa reforça o endpoint separado do módulo de stock.

Ficheiros: src/business/operations/EquipmentStockOsBusiness.js, src/controllers/equipmentStockOsController.js, scripts/test-equipment-stock-os-operational.js e este relatório. API aprovada em run-1789416527053: viatura/visita alheia, validação integral, repetição concorrente, conflito de dados e bloqueio de novo consumo em visita concluída. 90 testes unitários aprovados. Sem migração adicional, commit ou publicação.

Reforço final da TASK 51: uma transferência explicitamente associada a uma necessidade não pode ser utilizada para confirmar outra necessidade. O seletor filtra esses movimentos e o servidor repete a validação no POST, sob bloqueio do movimento. A API de necessidades consulta apenas confirmações/cargas dos reportes abertos; sem necessidades abertas responde sem carregar o histórico de stock. A consulta de entregas limita confirmações aos movimentos apresentados e, na escrita, ao movimento concreto. Ficheiro adicional: src/business/technician/ChemicalDeliveryBusiness.js. Cenários aprovados em run-1789416692602, incluindo isolamento entre necessidades e regressão da API de campo.

Verificação acumulada das TASKs 51–52: 90 testes unitários aprovados; 4 específicos do técnico repetidos; 9 cenários separados de navegador aprovados; sintaxe válida em 460 ficheiros JS do backend, além dos ficheiros de frontend/teste alterados. As quatro migrações aditivas foram novamente aplicadas sobre o esquema anterior, preservaram os dados existentes e ficaram alinhadas com o esquema Prisma atual. A primeira bateria integral passou nos 15 grupos em reports/field-suite/1789416573603. A nova bateria integral, já com a proteção final entre necessidades e as consultas limitadas ao histórico relevante, também passou nos 15 grupos em reports/field-suite/1789416741904.

Limites de aceitação desta versão: testes executados no ambiente isolado, não no VPS de produção. Não foram enviados commits ou alterações ao GitHub, nem feita instalação no servidor. Validação em telemóveis reais, entrega de notificações com a aplicação fechada e validação operacional de produção continuam necessárias. Não há uma garantia universal de ausência de erros; devoluções posteriores e outros caminhos legados de stock ainda não são automaticamente reconciliados com os totais históricos das necessidades. Estes pontos impedem apresentar a versão como certificada a 100% para campo.

## TASK 53 — devoluções ligadas à carga original

A gestão regista devoluções parciais ou totais escolhendo a carga original na necessidade. O pedido usa returnOfMovementId e UUID estável. Só permite um produto/unidade coincidente, a viatura da carga e quantidade não superior ao que falta devolver. O movimento original e a receção do técnico permanecem imutáveis. Uma devolução aceite cria o movimento de retorno, repõe o armazém e desconta a viatura na mesma transação; falta de stock desfaz tudo. A ligação explícita permite também receber no armazém material de viatura inativa/arquivada, sem permitir novas cargas nessa viatura.

Os totais da necessidade descontam as devoluções associadas: a quantidade por carregar volta a aumentar, e a receção apresentada é limitada ao remanescente da carga. O histórico mantém a quantidade originalmente confirmada. Produtos já devolvidos não aparecem como disponíveis para nova confirmação de receção. Duas devoluções concorrentes respeitam o saldo da carga; a repetição identificada devolve o mesmo movimento. A API também permite devolver uma carga depois de encerrada a necessidade, preservando o histórico; a interface de acompanhamento mostra as necessidades ainda abertas.

A receção líquida considera primeiro devolvido o que ainda não tinha sido confirmado: por exemplo, carga de 8 L, receção confirmada de 5 L e devolução de 5 L deixam 3 L na carga e 3 L recebidos após devoluções, mantendo a confirmação histórica de 5 L. Não representa medição de stock físico atual após outros consumos. Devoluções antigas sem ligação explícita ao movimento original continuam a exigir reconciliação; não são inferidas pelo nome do produto.

Ficheiros: src/services/stockPreparationService.js (novo), src/business/operations/EquipmentStockOsBusiness.js, src/business/technician/IncompleteVisitBusiness.js, src/business/technician/ChemicalDeliveryBusiness.js, frontend/admin-alerts.js, frontend/cw-field-day-review.js, frontend/sw.js, scripts/test-equipment-stock-os-operational.js, scripts/test-field-e2e.js e este relatório. Service worker v21. Sem migração adicional, commit ou publicação.

API aprovada em run-1789417229528: devolução parcial, repetição, concorrência, reposição posterior, histórico preservado, stock insuficiente com reversão total, viatura retirada de serviço e necessidade encerrada. Percurso visual aprovado em run-1789417149632: devolução de 5 L depois de carga de 8 L e receção de 5 L, perda da resposta e repetição sem duplicação, atualização do técnico para 3 L recebidos após devolução. 90 testes unitários e 4 específicos do técnico aprovados.

Fecho da TASK 53: 15 grupos integrados aprovados em reports/field-suite/1789417293453. Captura da gestão inspecionada. Sem publicação.

## TASK 54 — frequência diária, semanal e mensal das rondas

A ronda ganhou frequência DAILY/WEEKLY/MONTHLY, dia do mês e início/fim opcionais. A migração aditiva mantém todas as rondas anteriores como semanais, sem alterar o dia existente. O intervalo é inclusivo; fim vazio permite continuação sem limite. Frequência diária abrange todos os dias do calendário. No modo mensal, dias 29–31 que não existam nesse mês passam ao último dia do mês, incluindo ano bissexto.

O gerador verifica cada data dos próximos sete dias segundo a regra e volta a verificar a regra dentro da transação de criação. O plano semanal apresenta a ronda nos dias efetivamente previstos. A frequência da ronda e a atribuição do técnico por período continuam independentes. Alterar a regra não apaga nem desloca automaticamente visitas já geradas. Os bloqueios por ronda/piscina e pedidos de receção continuam aplicados a cada visita. A alteração da ronda relê a configuração sob bloqueio antes de guardar.

Ficheiros: prisma/schema.prisma, prisma/migrations/20260914220000_round_recurrence/migration.sql, src/services/roundScheduleService.js (novo), src/controllers/adminRoundsController.js, src/controllers/roundController.js, src/business/admin/AdminWeeklyPlanningBusiness.js, src/business/admin/RoundAssignmentBusiness.js, scripts/test-route-os-acceptance.js, scripts/test-field-migrations.js e este relatório.

API e rondas aprovadas em run-1789417577435: fim de mês, ano bissexto, limite inclusivo, geração concorrente sem duplicação, alteração sem perda de visitas e validação de datas/frequências inválidas. Cinco migrações aditivas aplicadas sobre o esquema anterior, com preservação de visitas, lembretes e ronda semanal anterior e correspondência exata ao esquema atual. A interface e a adaptação dos alertas à cadência são tratadas na TASK 55 antes da validação final da versão. Sem commit ou publicação.

## TASK 55 — interface e alertas de frequência das rondas

A gestão escolhe frequência diária/semanal/mensal ao criar ou editar a ronda, com dia da semana ou dia do mês conforme necessário e datas opcionais. A frequência diária indica explicitamente todos os dias. Sem data final, a regra continua enquanto a ronda estiver ativa. As rondas diárias e mensais têm grupos próprios na lista, sem serem apresentadas como uma única ronda de segunda-feira. A próxima ocorrência vem do serviço do servidor e é usada para apresentar a atribuição por período; se não houver próxima ocorrência, é identificada a atribuição base.

O editor tem campos com rótulos e uma coluna em ecrãs pequenos. Foram verificadas larguras de 320, 390 e 1280 px. Os controlos de dia do mês/semana só aparecem quando aplicáveis. Os alertas de cobertura usam a cadência diária ou mensal e a data de ocorrência real para Não agendado hoje. Fora do intervalo definido da ronda, não presumem uma manutenção recorrente em falta apenas com base nessa regra. Para uma ronda mensal isolada, a revisão por antiguidade usa até 31 dias mais um de tolerância; a comparação mantém caráter de revisão operacional, não certificação de incumprimento contratual.

Ficheiros: frontend/admin-rounds.html, frontend/admin-rounds.js, frontend/sw.js, src/controllers/adminRoundsController.js, src/services/autoVisitAlertService.js, scripts/test-route-os-acceptance.js, tests/round-schedule.test.js (novo), tests/visit-coverage.test.js e este relatório. Service worker v22.

Validação específica aprovada em run-1789417819183: criação mensal no ecrã, configuração de dia 31, alteração para diária com datas, ausência de transbordo no editor em 320/390/1280 px, geração e preservação do histórico. Captura final inspecionada. 96 testes unitários aprovados em 30 ficheiros, incluindo ano bissexto, limites de calendário, validação e cadência dos alertas. Os casos de atribuição mensal de técnico e frequência mensal da ronda permanecem distintos e testados. Sem publicação.

Fecho acumulado das TASKs 53–55: os 15 grupos operacionais passaram com o código final em reports/field-suite/1789417905676. 96 testes unitários em 30 ficheiros, 4 específicos do técnico repetidos e 9 cenários de navegador aprovados. Sintaxe válida em 462 ficheiros JS do backend, além dos ficheiros alterados de frontend/teste; diferenças verificadas sem erros. As cinco migrações aditivas preservaram dados anteriores e alinharam o esquema. Devoluções associadas e recorrência mensal deixam de ser pendências de implementação nesta versão; devoluções legadas sem vínculo ao movimento original não são inferidas automaticamente. Publicação, execução das migrações no servidor real, validação em telemóveis físicos e confirmação de notificações com a aplicação fechada continuam pendentes. Alterações locais, sem commit ou publicação.

## TASK 56 — proteção do inventário anterior e contagens físicas

As transferências do inventário anterior usam agora a transação partilhada com Equipment Stock, com bloqueio do saldo, rejeição de saldo negativo, identificação do operador pela sessão e repetição segura quando fornecido o identificador do pedido. A interface escolhe viaturas ativas e produtos existentes no armazém e conserva o identificador quando a resposta se perde. O teste visual encontrou uma chamada incorreta à lista de viaturas; foi corrigida para /api/guides/vehicles e o percurso repetido com sucesso.

A contagem física exige identificador e expectedQuantity com o saldo consultado. Uma contagem desatualizada não substitui consumos entretanto registados; repetições devolvem o movimento original. O ajustamento partilhado passa também a proteger os saldos usados nas compras e consumos anteriores, sem presumir equivalência entre nomes históricos diferentes.

Ficheiros: src/dal/EquipmentStockRepository.js, src/controllers/inventoryController.js, src/business/operations/InventoryCountBusiness.js (novo), frontend/admin-inventory.js, frontend/admin-inventory.html, frontend/sw.js, scripts/test-equipment-stock-os-operational.js, scripts/test-field-e2e.js e este relatório. Service worker v23. API aprovada em run-1789418833887; navegador aprovado em run-1789419155494, incluindo repetição depois de resposta perdida e seleção efetiva de viatura/produto. Contagens repetidas e concorrentes, conflito com consumo, rejeição de valores negativos/booleanos e conservação entre os dois módulos verificados. Clientes antigos da API de contagem têm de enviar os novos campos obrigatórios. A sincronização antiga e a idempotência própria de compras/consumos manuais ainda requerem revisão. Sem commit ou publicação.

## TASK 57 — sincronização antiga sem duplicação de consumos

A rota /api/sync/text delega a sincronização numa Business. Cada visita é relida sob bloqueio, com autorização atual e confirmação da viatura atribuída antes de mexer no stock. O estado da visita permanece planeado/em curso/incompleto; sincronizar dados não conclui nem esconde uma visita da operação. Visitas encerradas rejeitam novas alterações, mas uma repetição já registada pode recuperar a resposta original depois de verificar a autorização.

Cada sincronização conserva uma resposta durável e o estado dos consumos. Alterar leituras mantém o stock; alterar quantidades reconcilia apenas a diferença, incluindo devolução por correção. A versão esperada faz parte da identidade do pedido, permitindo voltar legitimamente a uma quantidade anterior sem confundir essa correção com uma repetição. Reenvios antigos após alterações posteriores não voltam a descontar stock. O bloqueio do saldo é partilhado com as transferências e consumos Equipment Stock. Todo o lote de produtos de uma visita é validado e aplicado atomicamente; uma falha não deixa parte do débito aplicado.

Contrato de compatibilidade: a resposta mantém results por visita; cada sucesso novo inclui syncHash. Para alterar uma visita já sincronizada, enviar expectedSyncHash com a versão consultada. Listas vazias explícitas removem os consumos desse registo; omitir consumos preserva-os. Visitas antigas com produtos cujo débito não é demonstrável exigem reconciliação pela gestão antes de alterar produtos; não se inventa um saldo inicial. O modelo legado Visit conserva leituras e checklist no estado durável, porque não dispõe desses campos na tabela, sem marcar a visita como concluída. Limite de 100 visitas por pedido e 100 linhas por visita.

Ficheiros: src/routes/syncRoutes.js, src/business/technician/LegacyVisitSyncBusiness.js (novo), scripts/test-equipment-stock-os-operational.js e este relatório. Teste específico aprovado em run-1789419437629: repetição simultânea, alteração só de leituras, aumento/redução/retorno à quantidade anterior, pedido fora de ordem, correção sem saldo, reversão total, viatura/visita de outro técnico, visita encerrada, concorrência com o módulo novo e modelo Visit legado. Sem alteração de esquema, commit ou publicação. A revisão adicional da contagem recusa também campos vazios, para não os converter em zero.

## TASK 58 — entradas por fatura e consumos manuais repetíveis

As entradas por fatura e consumos manuais passam por InventoryWriteBusiness, com identificador obrigatório, impressão dos dados e operador autenticado. Dois pedidos simultâneos ou a repetição após perda de resposta recuperam o mesmo movimento/entrada. Reutilizar o identificador com outros dados é recusado. São validadas todas as linhas antes da transação, incluindo quantidades, custos, data da fatura e referências; não se omitem silenciosamente linhas inválidas. Consumos ligados a visitas encerradas ou guias inexistentes/de outra viatura são recusados. O débito continua a usar o bloqueio partilhado do saldo.

O formulário conserva a identidade do pedido em armazenamento local por conta e conteúdo, incluindo o conteúdo do anexo. Erros mantêm os campos para repetir e os botões de envio ficam bloqueados durante o pedido. Os anexos recebem nomes aleatórios; anexos redundantes de uma repetição e de operações recusadas são removidos, preservando o documento da entrada registada. Um erro posterior à confirmação da transação não remove o documento já associado à fatura. O auxiliar existente de produtos foi movido para DAL para reutilização pela Business e pelo cadastro de produtos.

Ficheiros: src/dal/InventoryProductRepository.js (novo), src/business/operations/InventoryWriteBusiness.js (novo), src/controllers/inventoryController.js, src/routes/inventoryRoutes.js, frontend/admin-inventory.js, frontend/admin-inventory.html, frontend/sw.js, scripts/test-equipment-stock-os-operational.js, scripts/test-field-e2e.js e este relatório. Service worker v24. API e navegador aprovados em run-1789419833963: entrada e consumo concorrentes com um único movimento, identificação do operador, linha inválida sem entrada parcial, data impossível, referência inválida, saldo disputado com transferência e perda da resposta de uma entrada com anexo.

Compatibilidade: integrações antigas destes dois endpoints precisam de enviar requestId UUID v4 e conservá-lo nas repetições. Identificadores diferentes continuam a representar operações distintas; não se presume duplicação apenas por número de fatura/fornecedor. Consumos manuais não substituem nem reconciliam automaticamente os registos separados das guias de obra. Sem migração adicional, commit ou publicação.


Fecho das TASKs 56–58: 15 grupos operacionais aprovados com o backend final em reports/field-suite/1789419938281; 96 testes unitários em 30 ficheiros e 9 cenários de navegador aprovados. Sintaxe verificada em 470 ficheiros JS e diferenças sem erros. A revisão visual final substituiu IDs e nomes livres no consumo por seleção de viatura/produto com unidade do saldo, e mensagens de rede técnicas por instruções em português junto do formulário. Mensagens de tentativas anteriores são removidas ao repetir, sem empilhar alertas sobre os campos.

O percurso final foi repetido em run-1789420188826, depois dos ajustes de interface: transferência, consumo manual e entrada com anexo recuperaram a resposta perdida sem duplicar stock; o anexo repetido não deixou ficheiro adicional. Todos os controlos dos três formulários ficaram dentro do ecrã a 320, 390 e 1280 px, incluindo testes geométricos que não dependem de esconder o transbordo com CSS. Captura móvel inspecionada. O aviso temporário de ligação da sessão permanece distinto do resultado da operação.

Limites mantidos: alterações locais, sem commit ou publicação; servidor real, aplicação das migrações nesse servidor, telemóveis físicos e notificações com a aplicação fechada continuam por validar. Integrações antigas devem respeitar requestId nas entradas/consumos/contagens e expectedSyncHash nas alterações da sincronização. Históricos sem prova do débito inicial e registos separados de guias de obra não são reconciliados por suposição. Estes testes não constituem garantia universal de 100% para todos os cenários reais.

## TASK 59 — repetição e validade dos avisos críticos

Água aberta e bomba em manual geram um novo par de avisos, para gestão e técnico responsável, a cada 15 minutos enquanto continuarem por resolver. O ciclo corre no servidor, sem depender de a página estar aberta. A repetição é protegida pelo bloqueio do lembrete: dois processamentos simultâneos não criam dois pares. Avisos anteriores ficam SUPERSEDED, preservando o histórico; o lembrete e o alerta técnico continuam abertos. Aceitar uma passagem invalida também avisos SENT do técnico anterior. O fecho impede novas repetições.

Antes de entregar cada aviso, os canais de envio verificam o estado atual do aviso e do lembrete. O Web Push verifica também o responsável atual. A confirmação do envio não volta a colocar como SENT um aviso entretanto resolvido. A fila de Web Push percorre páginas de 100 registos por ID, evitando que 100 avisos já entregues impeçam os seguintes de avançar. Subscrições expiradas continuam a ser retiradas sem declarar uma entrega inexistente.

Ficheiros: src/services/waterReminderService.js, src/services/browserPushService.js, scripts/test-field-water-api.js, tests/critical-push-delivery.test.js (novo) e este relatório. API aprovada em run-1789420849555: intervalo exato, repetição concorrente, ambos os tipos de lembrete, transferência após SENT e fecho. 102 testes unitários aprovados em 31 ficheiros, incluindo fila superior a 100, responsabilidade antiga, fecho durante envio, subscrição expirada e bloqueio de notificações externas em QA.

Limites: um pedido já entregue ao fornecedor não pode ser recolhido quando o fecho acontece durante esse pedido; a verificação interrompe os envios seguintes. Os testes de transporte usam um fornecedor simulado, sem enviar mensagens a pessoas. A entrega real com a aplicação fechada depende das permissões, configuração do servidor, ligação e regras do sistema operativo e continua a necessitar de ensaio físico. Sem migração, commit ou publicação.

## TASK 60 — destinatário e leitura das notificações

Lista, contagem e leitura usam agora o mesmo filtro de destinatário na base de dados. A contagem já não é limitada aos primeiros 250 registos globais e marcar todas já não seleciona até 500 notificações sem os metadados do técnico. A atualização confirma o destinatário no momento da escrita, incluindo nas duas rotas de leitura individual. Clientes continuam limitados às suas mensagens públicas. Avisos SUPERSEDED deixam de aparecer na lista ativa e na contagem, sem inventar uma confirmação de leitura.

O filtro financeiro mantém os avisos sem campos opcionais preenchidos. Os eventos operacionais explícitos de água/bomba não são ocultados apenas porque o nome de uma piscina/cliente contém texto como Bill. O conteúdo financeiro geral continua excluído da área do técnico.

Ficheiros: src/services/notificationScopeService.js (novo), src/routes/notificationRoutes.js, scripts/test-field-access-api.js e este relatório. Teste específico aprovado em run-1789421124878 com 510 avisos próprios, 550 de outro técnico, aviso substituído e conteúdo financeiro: contagem correta, leitura integral apenas dos destinatários autorizados e preservação das mensagens internas da gestão. A versão final acrescenta o caso de nome semelhante a faturação à bateria integrada. Sem migração, commit ou publicação.

Complemento da TASK 59: a verificação de situações vencidas tem agora um bloqueio de execução separado do envio externo. Enquanto um fornecedor estiver lento, o próximo ciclo continua a verificar e a registar novas situações críticas; não inicia outra entrega concorrente nesse processo. O teste mantém o fornecedor pendente e confirma uma segunda verificação. Falhas parciais entre dispositivos preservam os destinatários já entregues e repetem apenas os restantes.

Complemento da TASK 60: avisos de água/bomba com estado RESOLVED também saem da lista ativa e da contagem. O histórico técnico e os registos das notificações permanecem guardados, sem marcar artificialmente como lidos. O caso foi acrescentado ao teste de acesso.

## TASK 61 — inscrição concorrente de dispositivos

A verificação do proprietário e a gravação de uma subscrição Web Push passaram para a mesma transação, com bloqueio por endpoint. Dois pedidos simultâneos de contas diferentes não podem ambos declarar a inscrição bem-sucedida. Uma repetição da mesma conta devolve a mesma inscrição; uma conta diferente não consegue desativá-la. Não se transfere automaticamente uma inscrição entre contas.

Ficheiros: src/services/browserPushService.js, scripts/test-field-access-api.js e este relatório. API aprovada em run-1789421342300: um sucesso e um conflito numa disputa entre técnico e cliente, proteção contra desativação pela conta perdedora e repetição simultânea pela conta proprietária. A ativação normal continua a usar a subscrição fornecida pelo navegador. Sem migração, commit ou publicação.

Fecho das TASKs 59–61: 15 grupos integrados aprovados com o código final em reports/field-suite/1789421457161. 104 testes unitários em 31 ficheiros aprovados; 9 cenários de navegador aprovados nesta revisão. Sintaxe validada nos seis ficheiros CommonJS alterados e no módulo de testes Vitest, e diferenças sem erros. Inclui repetição de avisos, falha parcial, fornecedor lento, leitura com mais de 1.000 notificações, nome semelhante a faturação, remoção de avisos críticos resolvidos e disputa de inscrição entre duas contas. A bateria integrada voltou a verificar técnico, cliente, gestão, rotas, visitas, stock, finanças, reparações e fluxo mensal. Alterações locais; sem migrações adicionais, commit ou publicação. A confirmação do fornecedor de push não prova que uma pessoa leu o aviso. Ensaios no servidor e em telemóveis físicos continuam necessários.

## TASK 62 — saída de sessão e ativação tardia de Web Push

Sair da sessão retira a inscrição Web Push com a credencial anterior, pede ao navegador que termine essa subscrição e fecha os avisos já apresentados. As visitas pendentes e fotografias mantêm os seus armazenamentos próprios. Trocar de conta retira a inscrição anterior no servidor e fecha os avisos identificados dessa conta, sem desligar a subscrição que a nova conta possa já ter criado. As respostas de limpeza usam a credencial capturada e não ativam o tratamento de expiração da nova sessão.

A ativação dos avisos verifica a sessão depois da permissão, do registo do service worker e da resposta do servidor. Uma ativação concluída tarde na conta anterior é retirada com a credencial original e não aparece como ativação bem-sucedida na conta nova. O login do técnico reutiliza a gestão de sessão comum. O Web Push transporta apenas o identificador não secreto do destinatário, além do conteúdo já existente, permitindo identificar a conta dos avisos mostrados. Service worker v25.

Ficheiros: frontend/cw-auth.js, frontend/cw-browser-push.js, frontend/technician-login.js, frontend/sw.js, src/services/browserPushService.js, scripts/test-field-push-session-browser.js (novo), package.json, tests/critical-push-delivery.test.js e este relatório. Cinco cenários novos em Chromium: saída com fila real preservada; troca de conta e resposta 401 anterior; permissão demorada; ativação POST em curso durante troca; falha de limpeza offline. Foram acrescentados à execução normal test:field-browser, que passou nos 14 cenários.

Limites: sem ligação, a retirada junto do servidor/fornecedor pode falhar; a sessão continua a ser encerrada e o trabalho local fica preservado. Não se afirma que uma inscrição foi retirada quando o transporte falha. Um aviso já em trânsito ou apresentado pelo sistema operativo exige ensaio no telemóvel real; o teste do navegador simula PushManager e as respostas do fornecedor. Sem migração, commit ou publicação.

## TASK 63 — verificação efetiva antes da instalação

O preflight de campo exige produção, QA desativado, JWT próprio, PostgreSQL, porta válida, origens HTTPS explícitas e Web Push configurado/ativo. Jobs opcionais de faturação/IA podem continuar desligados, porque a vigilância crítica tem o seu próprio agendamento. Os diagnósticos de configuração não apresentam passwords, URLs de ligação ou chaves.

Além da ligação à base de dados, o preflight compara o esquema real com o Prisma desta versão, sem executar migrações. Uma diferença ou falha da comparação impede a aprovação. O diretório de uploads verificado é o mesmo que o runtime utiliza. Foi removida a indicação incorreta de que seria necessário um frontend/dist separado e corrigida a indicação de pasta nas instruções do VPS: a raiz contém package.json, src/ e prisma/.

Ficheiros: scripts/preflight-vps.js, scripts/lib/vps-preflight-checks.js (novo), scripts/deploy-vps.sh, tests/vps-preflight-checks.test.js (novo), scripts/test-field-preflight.js (novo), scripts/test-field-suite.js, package.json, docs/SAFE_RELEASE_AND_ROLLBACK.md e este relatório. Teste real de comparação aprovado em run-1789422283439: esquema alinhado, modelo deliberadamente ausente no esquema de comparação e nova confirmação de que a base de dados não foi modificada. O teste passou a integrar a bateria, agora com 16 grupos. A comparação não certifica backups nem receção no telemóvel. Sem instalação, migrações aplicadas, commit ou publicação.

## TASK 64 — filtrar avisos antigos no telemóvel

O service worker consulta uma identificação local da conta antes de mostrar o conteúdo de um Web Push. Um aviso identificado para outra conta, ou recebido depois de uma saída de sessão registada localmente, é suprimido. Quando não é possível confirmar a identidade local ou chega um aviso do formato anterior, só é mostrada uma mensagem genérica, sem nomes de clientes/piscinas ou outros detalhes operacionais. O aviso genérico abre o login.

A identificação local contém apenas papel e ID, sem JWT, passwords ou chaves de subscrição. As gravações são sequenciadas e usam a sessão atual no momento da escrita. A saída aguarda a atualização local, independentemente de a limpeza junto do fornecedor funcionar offline. Os quatro fluxos de login aguardam a atualização antes de navegar. Se a gravação local falhar, tenta-se remover a identificação anterior para evitar reutilizá-la. Service worker v26, com o auxiliar incluído no cache público da aplicação; a identificação é guardada separadamente e não é apagada pela atualização desse cache.

Ficheiros: frontend/cw-push-session.js (novo), frontend/cw-auth.js, frontend/sw.js, frontend/technician-login.js, frontend/admin-login.js, frontend/client-login.js, frontend/login.js, scripts/test-field-push-session-browser.js, tests/push-session-privacy.test.js (novo) e este relatório. Verificações cobrem conta correta, conta diferente, saída, estado desconhecido, mensagem antiga e falhas do armazenamento; o próprio handler do service worker é executado no teste. Os ensaios em Chromium confirmam que a identificação fica vazia após sair mesmo com falha da limpeza de rede, e acompanha a troca de conta.

Limites: esta identificação auxilia a apresentação local e não substitui a autorização no servidor. Não é uma garantia contra adulteração do armazenamento por quem controla o dispositivo. Falhas simultâneas de armazenamento/fornecedor e o comportamento específico do sistema operativo continuam dependentes de ensaio físico. Sem migração, commit ou publicação.


Fecho das TASKs 62–64: 16 grupos integrados aprovados com a versão final em reports/field-suite/1789422742868/results.json, incluindo o percurso completo no navegador e a comparação não destrutiva do esquema. 123 testes unitários em 33 ficheiros aprovados, incluindo a execução do handler real do service worker. Os 14 cenários de test:field-browser passaram com as alterações finais de sessão e push. Sintaxe verificada nos 72 ficheiros JavaScript alterados/adicionados e diferenças sem erros.

Estado de entrega: implementação e verificações locais concluídas para estas tarefas, sem commit ou publicação. Não se atribui uma percentagem de prontidão de produção com base apenas nestes testes. Continuam pendentes a instalação/configuração no servidor real, aplicação controlada das migrações, ensaio de backup/restauro e validação em telemóveis físicos, incluindo notificações com a aplicação fechada e comportamento em rede móvel. Os testes locais usam PGlite e simulação do fornecedor/PushManager; não certificam esses ambientes externos.


## TASK 65 — armazenamento indisponível e atualização offline incompleta

O service worker v27 entrega a resposta válida da rede mesmo quando não consegue abrir ou escrever no cache. A gravação corre em segundo plano, acompanhada pelo ciclo de vida do evento, sem atrasar a página. Sem rede e sem cache legível, apresenta a instrução de recuperação em português. Erros HTTP reais continuam visíveis; pedidos API, uploads e escritas permanecem fora deste cache público.

Uma atualização só termina a instalação depois de obter todos os ficheiros do shell offline. Se uma descarga falhar, não chama skipWaiting nem substitui a versão ativa por uma versão incompleta. Ficheiros: frontend/sw.js, tests/service-worker-resilience.test.js (novo) e este relatório. Dez testes específicos aprovados: quota, abertura/leitura indisponíveis, escrita demorada, recuperação offline, HTTP 503, exclusões e instalação completa/incompleta. Sem migração ou publicação. A perda efetiva do armazenamento continua a impedir recuperar conteúdos que já não existam no dispositivo.


## TASK 66 — repetição coerente da redistribuição de visitas

Uma repetição da redistribuição só recupera o resultado anterior se mantiver o operador, as visitas, o técnico destinatário e o motivo. Reutilizar o identificador com outros dados devolve conflito, sem anunciar uma transferência que não ocorreu. Pré-visualizações malformadas, incluindo elementos nulos, devolvem conflito controlado em vez de erro interno.

Ficheiros: src/business/admin/VisitCoverageBusiness.js, scripts/test-route-os-acceptance.js e este relatório. Percurso de rotas aprovado em run-1789423166195: concorrência, três alterações indevidas do pedido, pré-visualização inválida, preservação dos dados e interface móvel. Sem alteração de esquema ou publicação.


## TASK 67 — backups sem bloquear o servidor nem anunciar ficheiros parciais

O pg_dump passa a executar de forma assíncrona, com prazo máximo por tentativa. A ligação é transmitida pelo ambiente do processo, sem passwords nos argumentos. Só uma saída concluída e não vazia é renomeada para o ficheiro final; tentativas falhadas são removidas e ficheiros parciais não entram na lista. As cópias têm nomes únicos e permissões restritas. A exportação JSON usa uma transação RepeatableRead, inclui todos os modelos e suporta BigInt sem falhar a serialização. Não omite silenciosamente modelos indisponíveis.

Ficheiros: src/services/databaseBackupService.js, tests/database-backup-resilience.test.js (novo), scripts/test-field-backup.js (novo), scripts/test-field-suite.js e este relatório. Seis testes específicos aprovados, incluindo falha, saída vazia, evento não bloqueado, concorrência e modelo indisponível. Exportação real dos 94 modelos aprovada no ambiente PGlite em run-1789423316086; o teste elimina apenas a cópia que criou. A bateria integrada passa a 17 grupos. O formato JSON continua identificado como fallback; estes ensaios não certificam restauro SQL no PostgreSQL de produção, nem incluem uploads.

## TASK 68 — otimização da revisão de cobertura

A revisão das manutenções agrupa rondas e visitas por piscina uma única vez e usa conjuntos para consultar o planeamento do dia. Evita percorrer todas as visitas e todas as associações de rondas novamente para cada piscina. Mantém a ordenação, os alertas e a exclusão de regressos já tratados; as regras de recorrência continuam no serviço existente.

Ficheiros: src/services/autoVisitAlertService.js, tests/visit-coverage.test.js e este relatório. Regressão adicional com 400 piscinas verifica que cada piscina mantém a sua ronda, visita e estado de agendamento. Não se declara ganho percentual de velocidade sem medição em produção. Sem migrações ou publicação.


Fecho da revisão das TASKs 65–68: 140 testes unitários em 35 ficheiros e 14 cenários de navegador aprovados. Os 17 grupos integrados passaram com o código final em reports/field-suite/1789423401755/results.json: água/bomba, autorização, navegador completo, trabalho diário do técnico, visitas, rotas, cliente, administração, finanças, stocks, reparações, interligações, fluxo mensal, preflight e exportação alternativa de backup. Verificação de sintaxe aprovada em 467 ficheiros backend e 160 ficheiros frontend/testes; novo script de backup verificado separadamente. Project Doctor sem módulos locais ou modelos Prisma em falta. Diferenças sem erros.

A revisão corrigiu as falhas concretas descritas e otimizou o cálculo de cobertura; não demonstra ausência universal de erros. O código permanece local, sem commit, push ou publicação. PostgreSQL nativo/pg_dump/restauro, instalação real e notificações em telemóveis físicos continuam pendentes de validação no respetivo ambiente. Não foram enviadas mensagens externas nem alterados dados de produção.


## TASK 69 — orientação na ronda existente

Foi confirmado que já existe mapa da ronda em technician-map; não foi criado um módulo concorrente. Corrigida a associação entre visita e marcador quando existem piscinas sem GPS. A abertura respeita a visita selecionada no modo de campo; a atualização conserva a seleção e o regresso transmite a seleção atual. As paragens são numeradas, apresentam estado legível e assinalam GPS em falta. Próxima piscina salta concluídas/retiradas, sem alterar a ordem atribuída pela gestão. Sem GPS, usa a morada no Google Maps quando disponível e desativa navegação por coordenadas.

Falhas de atualização removem marcadores/destinos antigos. Respostas de uma sessão anterior não preenchem a ronda atual. A lista continua utilizável se a biblioteca de mapas estiver indisponível. Ajustada a largura do ecrã para não depender das folhas de estilo externas. Ficheiros: frontend/technician-map.js, frontend/technician-map.html, scripts/test-field-map-browser.js (novo), package.json e este relatório. Três cenários Chromium aprovados, incluindo 320/390/1280 px; biblioteca Leaflet e API simuladas, sem validar tiles/trânsito externos. Sem migrações ou publicação.


## TASK 70 — confirmação de leitura no portal

O portal apresenta Por ler/Lida e permite ao próprio cliente marcar uma mensagem como lida. A leitura só é confirmada visualmente depois do sucesso do endpoint existente, que valida o destinatário e grava readAt. Uma falha mantém a mensagem por ler e permite repetir. A consulta da gestão não mostra o botão nem pode executar a ação. Respostas tardias não alteram outro cliente/sessão. Os rótulos acompanham PT/EN/FR/DE, os idiomas já suportados pelo portal.

Ficheiros: frontend/client-portal.js, tests/client-portal-context.test.js e este relatório. Cinco regressões adicionais verificam sucesso, falha, consulta da gestão, troca de cliente e idiomas. Não se confunde confirmação de leitura com entrega de email/WhatsApp/push. Nenhuma mensagem externa foi enviada.


## TASK 71 — saída efetiva do portal do cliente

O botão Sair passa a chamar o encerramento de sessão comum, em vez de apenas retirar IDs de cliente e navegar para o login mantendo o JWT. Reutiliza a retirada de push e preservação das filas de trabalho já testadas. A gestão continua a regressar à lista de clientes sem terminar a sua própria sessão. Ficheiros: frontend/client-portal.js, tests/client-portal-context.test.js e este relatório. Duas regressões específicas verificam os dois percursos.

Complemento da TASK 70: scripts/test-client-notifications-browser.js (novo) e package.json acrescentam testes de interação real em Chromium para leitura, falha com repetição, troca de cliente e consulta da gestão. O transporte API é simulado nestes testes; a autorização real continua coberta pela bateria integrada.


## TASK 72 — coerência entre avisos visíveis e leitura antiga

A rota antiga do portal também usa agora o filtro comum de destinatário no momento da atualização. Um cliente não consegue marcar como lido um aviso interno associado à sua ficha, um aviso de outro cliente ou um aviso substituído. A confirmação regista readAt. A listagem do portal usa o mesmo filtro, evitando apresentar avisos substituídos com um botão que nunca conseguiria confirmá-los. A rota delega a atualização no serviço existente.

Ficheiros: src/services/customerPortalService.js, src/routes/clientPortalRoutes.js, scripts/test-field-access-api.js e este relatório. Testes específicos de API aprovados em run-1789424454387; a bateria final inclui também a exclusão de avisos substituídos da lista. Sem migração, publicação ou envio externo.

## TASK 73 — espera pelo estado de recuperação visível

Na primeira bateria desta revisão, 16 de 17 grupos passaram; o teste de navegador do cliente excedeu a espera por networkidle após recarregar uma página com falha de documentos simulada. O teste foi corrigido para aguardar o aviso de recuperação visível, mantendo as verificações de piscinas, recuperação e envio de mensagens. Não se aumentou o prazo nem se removeu a validação funcional.

Ficheiros: scripts/test-field-e2e.js e este relatório. Percurso completo repetido e aprovado em run-1789424454387. O resultado inicial permanece em reports/field-suite/1789424325064.


Fecho das TASKs 69–73: 147 testes unitários em 35 ficheiros e 20 cenários de navegador aprovados. Os 17 grupos integrados passaram com o código final em reports/field-suite/1789424527667/results.json. Os nove ficheiros JavaScript alterados nesta revisão passaram na verificação de sintaxe; Project Doctor não encontrou módulos locais nem modelos Prisma em falta; diferenças sem erros.

Resultado operacional: melhorias no mapa existente, orientação entre visitas por terminar, estados legíveis e confirmação de leitura pelo cliente, saída efetiva da sessão e proteção da rota antiga de notificações. Não foram criados novos módulos concorrentes, aplicada qualquer migração, feito commit/push ou publicado o sistema. As notificações externas e os mapas de terceiros foram simulados nos testes de componentes; receção em telemóveis, tiles/trânsito reais e instalação no servidor continuam a depender de ensaio no ambiente final.


## TASK 74 — painel central protegido e verificação de arranque mais rigorosa

A execução adicional de saúde revelou que /api/core/dashboard respondia sem sessão. A exceção no middleware tratava-o como metadados mínimos, mas a resposta inclui contagens, clientes, visitas, acessos e histórico operacional. A exceção foi removida: só a administração autenticada pode consultar o painel. O endpoint mínimo /api/core/health permanece acessível para verificar o arranque.

Os testes antigos de saúde e smoke aceitavam 200 sem sessão em endpoints protegidos. Agora exigem recusa de acesso nesses endpoints. A verificação de saúde passou também a integrar a bateria principal, que fica com 18 grupos. O teste de acesso confirma 401 sem sessão, 403 para cliente/técnico, ausência de dados operacionais nas recusas e sucesso para administrador válido.

Ficheiros: src/routes/coreFlowRoutes.js, scripts/test-field-access-api.js, scripts/test-production-runtime-health.js, scripts/smoke-test.js, scripts/test-field-suite.js e este relatório. Testes específicos aprovados em run-1789424861600. O resultado inicial permissivo permanece em reports/production-runtime-health-1789424744937.json; não é prova de controlo de acesso correto. A bateria inicial de 17 grupos desta execução está em reports/field-suite/1789424737298. Sem migração, commit ou publicação. Esta correção local ainda precisa de ser aplicada ao servidor para proteger uma instalação que tenha a versão anterior.


Fecho da TASK 74: 18 grupos integrados aprovados com a correção final em reports/field-suite/1789424903988/results.json. 147 testes unitários em 35 ficheiros aprovados; 20 cenários de navegador aprovados nesta execução. Verificação inicial de sintaxe dos 467 ficheiros backend aprovada e nova verificação dos cinco ficheiros JavaScript alterados após a correção aprovada. Diferenças sem erros.

Os registos de erro foram revistos: as entradas observadas correspondem aos testes negativos de token inválido/expirado, tentativa de correção por outro técnico, utilizador de jornada inexistente e datas/recorrências inválidas. A bateria confirma as recusas esperadas. O servidor de teste foi encerrado de forma controlada. Esta execução usa base isolada PGlite e não é uma auditoria exaustiva de produção. A proteção do painel ainda não foi publicada no servidor real.


## TASK 75 — validação GPS com responsável e estado atuais

A validação de proximidade recebe o operador autenticado e confirma a atribuição da visita dentro de uma transação, com o mesmo bloqueio da visita usado na redistribuição. Recusa visitas de outro técnico e visitas concluídas/retiradas antes de criar auditoria ou iniciar trabalho. Uma falha ao iniciar a visita deixa de ser ignorada. Valores vazios/nulos não são convertidos em coordenadas zero.

Sem coordenadas da piscina, a presença é desconhecida (inside:null), é pedida confirmação manual e a visita não é iniciada pelo GPS. Se o serviço falhar, a rota devolve 503/success:false, sem afirmar que o técnico está no local. O modo de campo continua a ser a via indicada para confirmação manual.

Ficheiros: src/business/technician/TechnicianGpsBusiness.js, src/routes/gpsRoutes.js, scripts/test-field-access-api.js, tests/gps-geofence-failure.test.js (novo) e este relatório. API aprovada em run-1789427405934: cliente/outro técnico recusados, distância fora/dentro do raio, visita encerrada, coordenadas nulas e ausência de GPS. Três testes unitários verificam falha da escrita, operador obrigatório e falha do serviço. Sem migração ou publicação.


## TASK 76 — diagnóstico de saúde sem falso sucesso nem detalhes internos

Os dois endpoints públicos de saúde reutilizam a mesma verificação de ligação à base de dados. Uma falha devolve HTTP 503 e uma mensagem genérica, em vez de HTTP 200 no core ou de expor a mensagem interna da base de dados. As respostas de sucesso conservam os campos usados pelo arranque e pela monitorização.

Ficheiros: src/services/databaseHealthService.js (novo), src/routes/coreFlowRoutes.js, src/routes/systemRoutes.js, tests/database-health.test.js (novo) e este relatório. Três testes específicos, com base de dados simulada, cobrem a consulta de disponibilidade e a ocultação de mensagens internas. Os percursos de sucesso dos dois endpoints são verificados com a base de dados na bateria integrada. Sem migração ou publicação.


Fecho das TASKs 75–76: 153 testes unitários em 37 ficheiros aprovados; 20 cenários de navegador aprovados; 18 grupos integrados aprovados com o código final em reports/field-suite/1789427524956/results.json. Sintaxe verificada nos oito ficheiros JavaScript alterados/adicionados e diferenças sem erros. Inclui autorização GPS real, visita encerrada, coordenadas ausentes, falha de escrita simulada, diagnóstico público sem mensagens internas e repetição dos percursos de técnico, cliente, gestão, finanças, rotas, stocks, reparações, fluxo mensal e backup.

As correções estão locais, sem commit, push, migração ou publicação. A proximidade calculada depende das coordenadas recebidas; não constitui prova independente de presença física. A aplicação das alterações no servidor e os ensaios em telemóveis reais continuam pendentes.


## TASK 77 — simulação de ronda com GPS, troca de técnico e leituras fora de ordem

A telemetria distingue o ID do técnico do ID da conta User. Um login direto de técnico não usa uma conta diferente apenas porque os números coincidem. Contas User associadas conservam os dois IDs e podem consultar o seu histórico pela identidade do técnico. Os pedidos que tentem indicar outro técnico são recusados. A posição atual e o histórico são gravados na mesma transação, com bloqueio por técnico; só depois é emitida a atualização à gestão.

Leituras com mais de cinco minutos são reconhecidas como antigas e não atualizam o mapa nem geram avisos. Uma leitura repetida/fora de ordem não substitui uma posição mais recente. Os emissores GPS passam a enviar a data da medição; a sincronização antiga envia a data que guardou. O ecrã distingue Sincronizado de leitura antiga e não anuncia sucesso quando o servidor recusa a gravação.

Os avisos de proximidade só consideram visitas abertas atribuídas ao técnico para o dia atual, cliente/piscina ativos e opção de aviso autorizada. Exigem precisão indicada até 100 m. A atribuição é relida sob bloqueio antes de criar o aviso; a deduplicação fica na base de dados por visita/técnico, em vez de depender da memória do processo. O aviso destina-se à gestão e diz explicitamente que proximidade não confirma chegada; não inicia nem conclui a visita. Falhar este aviso não transforma uma localização já gravada em falsa falha de gravação.

Ficheiros: src/business/technician/TechnicianGpsBusiness.js, src/routes/gpsRoutes.js, frontend/technician-gps.js, frontend/gps.js, frontend/js/offline/offline-gps.js, scripts/test-field-gps-flow.js (novo), tests/gps-field-feedback.test.js (novo), scripts/test-field-suite.js e este relatório. Quatro testes de feedback passaram. A simulação inicial passou em run-1789444979846; a versão final acrescenta transferência real pela API e cliente em pausa. O cenário integra a bateria, agora com 19 grupos.

O ambiente de QA foi recuperado após desaparecer uma dependência temporária: as dependências PGlite/socket passaram a ser resolvidas no diretório de runtime do projeto, com drenagem antes do encerramento. Isto não modifica dependências de produção. Sem migração, commit, publicação ou mensagens externas. Compatibilidade: o envio administrativo de GPS deve identificar technicianId/technicianDbId; a consulta administrativa por técnico usa scope=TECHNICIAN. Os avisos são inferências de proximidade, não prova física de presença.

Complemento da TASK 77: getTargetCoordinatesFromPool usa sempre um par completo de coordenadas da piscina ou do cliente. Deixa de combinar latitude de uma origem com longitude de outra. Acrescentado caso em tests/gps-geofence-failure.test.js (décimo ficheiro da tarefa). A simulação com transferência e pausa passou em run-1789445098402.


## TASK 78 — compatibilidade segura do GPS administrativo antigo

A primeira bateria de 19 grupos encontrou duas incompatibilidades nos percursos antigos que enviavam userId. A Business passou a resolver esse formato apenas quando a conta User tem uma ligação única, por email, a um técnico ativo; conserva ambos os IDs. Se não existe qualquer conta User com esse número, aceita o identificador legado de técnico. Quando existe uma conta sem ligação inequívoca, devolve 409 e pede technicianId, sem escolher outra pessoa por coincidência numérica. O teste administrativo que pretendia indicar diretamente um técnico passou a enviar esse campo explicitamente.

Ficheiros: src/business/technician/TechnicianGpsBusiness.js, scripts/test-fcs-sec-tech-auth.js, scripts/test-field-gps-flow.js e este relatório. A simulação acrescenta compatibilidade com User associado e recusa de uma conta ambígua. O teste operacional de visitas conserva o pedido antigo userId, para validar a compatibilidade real. Resultado inicial preservado em reports/field-suite/1789445164396.


Fecho das TASKs 77–78: 158 testes unitários em 38 ficheiros e 20 cenários de navegador aprovados. Os 19 grupos integrados passaram com o código final em reports/field-suite/1789445375409/results.json. Os três percursos afetados pela compatibilidade administrativa passaram antes, em run-1789445329489. Sintaxe verificada nos dez ficheiros JavaScript alterados nesta revisão; diferenças sem erros.

A simulação nova usa a API e base de dados isolada para verificar: IDs coincidentes de conta/técnico; envio simultâneo do mesmo ponto; leituras antigas/fora de ordem; piscinas vizinhas de outra ronda; visita do dia seguinte; transferência de visita com pré-visualização; cliente em pausa; login User com ID distinto do técnico; histórico próprio; compatibilidade administrativa e recusa de identidade ambígua. A bateria mantém também o percurso mensal, stock, visitas, reparações, cliente, gestão, permissões, recuperação offline e backup.

Limites: simulação local em PGlite, sem deslocações físicas, trânsito real ou envio a pessoas. Não se afirma prontidão universal nem 100% de cobertura. As alterações permanecem sem commit, push ou publicação e precisam de ser aplicadas/testadas no servidor e telemóveis reais.


## Cópia separada autorizada — 15/09/2026

O utilizador autorizou guardar a versão completa numa branch separada no GitHub. Nome reservado: versions/cristal-water-20260915. Este checkpoint reúne as TASKs concluídas acima; as referências históricas a alterações locais descrevem o estado antes deste checkpoint. Não corresponde a instalação no servidor ou declaração de prontidão a 100%.

Verificações repetidas antes de guardar: npm test (158 testes, 38 ficheiros), npm run test:technician (4 testes) e npm run check:syntax (468 ficheiros backend), todos aprovados. Mantém-se a evidência anterior de 20 cenários de navegador e 19 grupos integrados. A árvore publicada será comparada com a árvore Git local para confirmar a integridade da cópia. Ficheiros de ambiente, uploads, bases de dados, backups e dependências locais ficam excluídos pelo controlo de versões.
