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

Este ensaio mede a recuperação da base de testes desta release; não substitui um backup nem um restauro do VPS real. Resultado remoto ainda por verificar.
