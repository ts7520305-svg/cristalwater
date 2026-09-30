# Inventário de idiomas — C05 / TASK415

Base: `3c3e65eb307e59176dc58a316b4822cfb403e651`. 126 HTML frontend (119 entradas de raiz), 1 HTML servidor, 307 JS frontend, 695 JS servidor e 45 scripts inline (inclui o HTML servidor). Fontes e hashes no JSON adjacente.

**Inventário estático, não aprovação funcional de traduções.** Cada página e fonte tem responsável C06–C09 e lote de até quatro fontes; cada alteração continua limitada a dez ficheiros, incluindo testes/documentação. Os lotes são unidades de revisão: fontes sem texto ou auxiliares podem ser encerradas por evidência, sem editar produto. A atribuição por módulo/nome/perfil é uma fila de trabalho, não prova de que o ficheiro só serve esse perfil; caminhos de servidor partilhados exigem revisão dos consumidores.

O dicionário global tem 198 chaves com EN/FR/ES/DE disponíveis. Isso só demonstra existência de tradução. O observador não traduz texto protegido, títulos da página, valores de inputs e select sem opt-in. Os módulos próprios são classificados à parte; fragmentos incompletos não são automaticamente falhas.

**Lacuna confirmada no contrato atual dos relatórios:** os módulos de visita e mensal aceitam PT/EN/FR/ES e recusam DE. C09 deve adicionar o idioma e testar HTML/PDF, normalização, formatação e rejeição de idiomas inválidos; conservar nomes, notas e evidência original. Isto não significa que os restantes PDFs estejam traduzidos.

## Progresso funcional — TASK454 / C06-005, mensagens do helper de lembretes

`cw-field-reminders.js`:23 entradas/115 textos para22 erros próprios e aviso de lembretes antigos. Identidade privada protege a apresentação de erros externos coincidentes ou falsas propriedades copy. `Error.message`, `legacyWarning()` original e strings `syncError` persistidas permanecem literais/originais; não se traduz texto histórico por comparação de palavras. `cw-pump-reminders.js` integra esta apresentação e repinta os mesmos nós com o seletor real; referência histórica C08-045 conservada. Água aberta e outros consumidores ainda usam a API original e requerem integração própria. [Prova454](evidence/20260930_task454_local.json).

Cinco integrações,1 356 unitários/quatro técnicos/sintaxe aprovados. As22 guardas reais e aviso antigo nos cinco idiomas, fallback PT/DOM reduzido e ausência de escrita/rede na formatação. Página real a320/390/1440: nós/foco/valores/contexto/conta/SQL/bytes preservados; arquivo ilegível/inválido, contexto, locks, quota externa, duplicado, conta trocada, cache offline, legado,403, resposta retida/perdida/reenvio e fecho físico. Um lembrete SQL/uma abertura/um fecho; regressões EXTRA/água/bomba/componente aprovadas. Código operacional restaurado byte a byte ao inverter apresentação; cache237/runner346,345 grupos anteriores na ordem exata. Captura alemã320 revista. Publicação/gates346/restauro454 pendentes. CI452/453 nas suites344/345 após dez etapas aprovadas. Próximo:painel real de água aberta; dados persistidos sem origem inequívoca permanecem literais. C06/C08/C10 e contagens estáticas abertas/inalteradas; entradas abaixo históricas.

## Progresso funcional — TASK453 / painel técnico de bomba em manual

`cw-pump-reminders.js`:18 entradas/90 textos para título/introdução, minutos, ações, registo, validação, nomes de reserva, estados/tempo decorrido e confirmação física. O inventário estático agrupou esta fonte por nome em C08-045, mas o consumidor confirmado é `/technician-field-mode`; esta execução conta funcionalmente para C06, com referência cruzada e sem reescrever a fotografia estática. Os textos do helper `cw-field-reminders.js`, mensagens persistidas e avisos antigos continuam literais e pendentes. [Prova453](evidence/20260930_task453_local.json).

Quatro integrações,1 356 unitários/quatro técnicos/sintaxe aprovados. Cinco idiomas/320/390/1440; nós/foco/dados/contas/pedidos conservados sem reler os produtores na mudança de idioma. Offline/cache,REGULAR/EXTRA,cancelamento físico,quota,403,resposta retida/perdida,reenvio e fecho incompleto; duas linhas SQL e abertura/fecho únicos. Código operacional conservado após inverter apresentação; cache236/runner345,344 grupos anteriores na ordem exata. Captura alemã320 revista. Código `715bcc59` publicado; [CI36673052696](https://github.com/ts7520305-svg/cristalwater/actions/runs/36673052696) em execução no commit exato. Gates345/restauro453 pendentes. CI451 aceite343/343/restauro128 tabelas51 ficheiros com linhas/hashes iguais;452 na suite344.

`frontend/gps.js` continua sem referências literais nas páginas/fontes frontend e servidor atuais, coerente com `no-page-reference` do inventário. Fica conservado como compatibilidade; não se declara traduzido nem se excluem consumidores antigos/externos. Próximo: helper de lembretes e painel água aberta; C06/C08/C10 mantêm pendências. Entradas abaixo históricas.

## Progresso funcional — TASK452 / textos próprios da página GPS

`technician-gps.js` e `technician-gps.html`, continuação C06-009:31 entradas/155 textos PT/EN/FR/ES/DE para título, ações, rótulos, estados de sincronização, hora original e erros próprios. Identidade privada separa os erros próprios dos externos; Error.message e pontos/arquivos permanecem intactos. Trocar idioma não relê GPS nem envia pedidos. Nós, foco, controlos, conta/credenciais e precisão preservados. Cache235/runner344;343 grupos anteriores na ordem exata. [Prova452](evidence/20260930_task452_local.json).

Quatro integrações,1 356 unitários/quatro técnicos/sintaxe aprovados; cinco idiomas/320/390/1440, offline/cache, permissões, arquivo antigo, falhas literais, confirmação retida/perdida, repetição sem duplicar e conta trocada. Captura alemã320 revista. Teste da preferência de idioma/foco transitório corrigido sem alterar guardas. Código `87bfeed4` publicado; CI36671372520 em execução no commit exato. Gates344/restauro452 pendentes; CI451 na suite343 após dez etapas aprovadas. C06/C06-009 continuam abertas: entrada de compatibilidade gps.js a avaliar pelos consumidores efetivos, navegação partilhada/avisos de autenticação e restantes painéis. C08/C10 e contagens estáticas415 não encerradas por associação. Entradas abaixo históricas.

## Progresso funcional — TASK451 / avisos e erros do helper GPS

`js/offline/offline-gps.js`, C06-009:21 entradas/105 textos PT/EN/FR/ES/DE para avisos próprios/erros/contagem/parâmetros aninhados. Error.message, pontos/arquivo e falhas externas mantêm-se originais; identidade privada decide a apresentação. Consumidor real `technician-gps.js` e seletor `cw-i18n.js` integrado na página. Zona de GPS/avisos protegidos da tradução genérica; repintura não relê produtores nem envia pontos. Transporte/guardas/ordem/coordenadas/UUID/corpo/hora e finais de linha mistos preservados após inverter apresentação. Cache234/runner343;342 grupos anteriores na ordem exata. [Prova451](evidence/20260929_task451_local.json).

Quatro integrações,1 356 unitários/quatro técnicos/sintaxe aprovados. Cinco idiomas pelo seletor real/320/390/1440, foco/nós/controlos/KPIs, offline/cache, ilegível/leitura inválida/quota/permissão, erro externo coincidente/falsa copy, confirmação incompleta/de outra conta, resposta real retida/perdida/reenvio e um ponto SQL. Captura alemã320 revista, cenário passa com/sem captura. Cache preparado online antes de cortar rede; DOM reduzido suportado com fallback PT sem mudar os21 testes existentes. CI448/449 aceites341/341 e restauro128 tabelas50 ficheiros medidos/hashes iguais; CI450 aceite342/342/restauro128/51. TASK451 publicada `61eb17da`, CI36667051825 em execução no commit exato; CI450 aceite342/342/restauro128 tabelas51 ficheiros medidos/hashes iguais. Gates343/restauro451 próprios pendentes. C06/C06-009 abertas: textos próprios da página GPS, compatibilidade gps.js e restantes fontes/painéis por rever. C08/C10 e contagens estáticas415 não encerradas por associação. Entradas anteriores são históricas.

## Progresso funcional — TASK450 / erros da fila antiga de conclusões

`js/offline/offline-queue.js`, C06-010:dois erros/dez textos em PT/EN/FR/ES/DE. Aviso de arquivo na barra/recuperação e alert da operação recusada usam a identidade privada do Error; Error.message, arquivo/rascunhos/rótulos e falhas externas/persistidas continuam originais. Helper e consumidor inteiros preservados após inverter só apresentação; guardas/envio/payload/UUID/hash/ordem fotografia→conclusão inalterados. Cache233/runner342;341 grupos anteriores na ordem exata. [Prova450](evidence/20260929_task450_local.json).

Quatro integrações,1 356 unitários/quatro técnicos/sintaxe aprovados. Cinco idiomas/320/390/1440, nós/foco/caret/seis campos/bytes preservados sem produtores ou pedidos extra; guards de URL/método/headers e arquivo ilegível, texto externo coincidente/falsa copy, botões reais, fotografia/conclusão offline/cache,403 literal e resposta perdida/reenvio. Uma conclusão auditada, uma fotografia e dois recibos. Captura alemã320 revista; cenário passa com/sem captura. Preparação local recuperou cinco objetos Git históricos originais, verificados com o GitHub, para o gate unitário existente; aplicação/teste desse gate não alterados. CI447 nativo340/340 e restauro128 tabelas49ficheiros/hashes confirmados;448/449 nas suites341. TASK450 publicada `78a384fc`, CI36636579876 em execução no commit exato; gates342/restauro completo450 pendentes; PGlite não substitui estes gates. C06/C06-010 abertas:GPS/C06-009, reminder-visits e restantes painéis/fontes por rever. C08/C10 e contagens estáticas415 não encerrados por associação. Entradas anteriores são históricas.

## Validação de continuidade — TASK449 / sessão do formulário de impedimentos

CI446 terminou338/339; a única falha usa o seletor de idioma depois de a guarda ocultar a página. Reprodução determinística39 174ms confirma o listener existente. Teste corrigido mantém os cinco avisos e o botão desativado, comprova bloqueio persistente após repor o token e segue o link real de reabertura offline. Bytes de rascunhos REGULAR/EXTRA, contexto/arquivo e pedidos/UUID/hash/recibos/revisão conservados; mudança de idioma bloqueada não relê produtores nem faz pedidos operacionais. Quatro integrações e sintaxe individual/diff aprovados; nenhuma guarda/espera/asserção retirada. [Prova449](evidence/20260929_task449_local.json).

Aplicação/cache232/runner341 e contagens de traduções inalterados; gates de produto448 herdados sem repetição. Restauro446 não executado; CI447/448 nas suites340/341 após dez etapas iniciais aprovadas. TASK449 publicada `217cdbee`, CI36632923826 em execução no commit exato; PostgreSQL16/upgrade/suite341/restauro449 pendentes. C06/C06-010/C08/C10 continuam abertos; próximo: fila antiga `js/offline/offline-queue.js` depois dos gates. Entradas anteriores conservam o estado histórico.

## Progresso funcional — TASK448 / erros de fotografias da página antiga

`js/offline/offline-photos.js`, C06-010:três erros/15 textos em PT/EN/FR/ES/DE no catálogo existente. `technician.js` apresenta o aviso do arquivo na barra/recuperação e o erro da seleção no alert atual, por identidade privada do Error. Error.message, labels guardados, detalhes externos/persistidos e blobs não são traduzidos nem regravados. Catálogo anterior/helper/consumidor preservados após inverter só apresentação. Cache232/runner341;340 grupos anteriores na ordem exata. [Prova448](evidence/20260929_task448_local.json).

Quatro integrações,1 356 unitários/quatro técnicos/sintaxe aprovados. Cinco idiomas/320/390/1440, erros de arquivo/sessão/MIME/vazio/tamanho, falsa propriedade copy e erros externos de texto coincidente; seis campos/nós/foco/bytes estáveis. Botão/câmara real, fotografia offline/cache,403 literal, resposta perdida/reenvio:uma fotografia/um recibo, visita SQL inalterada. Captura alemã320 revista; cenário passa com/sem captura. TASK448 publicada `0a102e99`, CI36629776697 em execução; gates341/restauro pendentes. CI446/447 nas suites. C06/C06-010 abertas: fila antiga `js/offline/offline-queue.js` e outros consumidores/fontes continuam; GPS, outros painéis modernos, C08/C10 e inventário estático415 não fechados por associação.

## Progresso funcional — TASK447 / painel moderno de fotografias

`technician-field-mode.html/js`, C06-012:38 entradas/190 textos em PT/EN/FR/ES/DE para títulos/aria, botões, tipos, estados, seleção/armazenamento, toasts e alternativas de imagem. Textos próprios repintam os mesmos nós; ficheiros, nomes literais, rascunhos, seleção, foco, pedido e recibo preservados. Ajuste local das ações a320px resolve o excesso de largura alemão. Cache231/runner340;339 grupos anteriores na ordem exata. [Prova447](evidence/20260929_task447_local.json).

Quatro integrações,1 356 unitários/quatro técnicos/sintaxe aprovados. Cinco idiomas/320/390/1440; falhas de seleção/ficheiro/quota/câmara, remoção offline, cache, visitas REGULAR/EXTRA com igual ID, resposta extra real retida/perdida/reenvio, uma fotografia/um recibo e visitas SQL intactas. Captura alemã320 revista; sobreposição comum da navegação fixa continua C08. Sete funções operacionais iguais após inverter apresentação; backend/schema/workflows/helper/write-store inalterados. TASK447 publicada `bc178c71`, CI36627447422 em execução; gates340/restauro próprios pendentes. CI446 continua na suite339. C06/C06-012 abertas: helper antigo `js/offline/offline-photos.js`/C06-010 e restantes painéis modernos ainda por localizar. C08/C10 e inventário estático415 não fechados por associação.

## Validação de continuidade — TASK446 / testes dos idiomas e impedimentos

CI441 (333/335) e CI442 (334/336) revelaram três erros nos testes: página protegida após perda de sessão, pendência extra sem regresso e escolha de alemão dependente de capturas opcionais. Todos reproduzidos; testes corrigidos para reabrir a página real preservando dados, verificar pendências por ID/tipo e escolher o idioma sempre. Seis integrações aprovadas, incluindo química com/sem capturas e regressões de impedimentos/sessão. Aplicação/cache230/runner339 e ordem inalterados; gates de produto445 conservados, sem nova contagem de traduções. TASK445 publicada `19ad9727`, CI36622422522 na suite; publicação/gates nativos446 pendentes. [Prova446](evidence/20260929_task446_local.json).

## Progresso funcional — TASK445 / erros próprios de fotografias

`cw-field-photos.js`: sete erros/35 textos em PT/EN/FR/ES/DE; duas apresentações/dez textos no modo de campo. Fila e recuperação utilizam a identidade do erro, preservando Error.message e detalhes externos/persistidos mesmo quando coincidem com texto próprio. Idioma atualiza folhas existentes sem reler produtores de fotografias, alterar rascunhos ou enviar; renderizações de arquivo já existentes na fila mantêm-se. Cache230/runner339. [Prova445](evidence/20260929_task445_local.json).

Quatro integrações,1 356 unitários/quatro técnicos/sintaxe aprovados. Cinco idiomas/320/390/1440, erro de arquivo/recuperação, fotografia offline real, nós/foco/preview/bytes/UUID/hash,403 literal, recarregamento cache e resposta real retida/perdida/reenvio com uma fotografia/um recibo. Captura alemã320 revista. C06/C06-005 abertas: painel normal/seleção/feedback e helper antigo ainda por traduzir. Antes de continuar, reparar dois testes do CI441 (333/335; restauro não executado); CI442–444 ainda em execução. Gates339/restauro nativos pendentes. C08/C10 e inventário estático415 não fechados por associação.

## Histórico funcional — TASK444 / recuperação do arquivo antigo

`cw-field-recovery.js`: aviso de registos antigos e botão de guardar cópia em PT/EN/FR/ES/DE, duas entradas/dez textos. Contagem e nós capturados; idioma não consulta IndexedDB nem exporta/envia. Filtro de conta/role, leituras, projeção/exportação binária e nome do ficheiro originais preservados byte a byte. Cache229/runner338. [Prova444](evidence/20260929_task444_local.json).

Quatro integrações aprovadas: cinco idiomas/320/390/1440, seis registos/dois elegíveis, nós/foco/bytes iguais, seis downloads reais incluindo offline, texto UTF-8 e32 017 bytes binários íntegros sem credenciais nem registos alheios; nada apagado/enviado. Atualização explícita da conta/exportação conserva o filtro anterior. 1 356 unitários/138 ficheiros, quatro técnicos e sintaxe695/308/44 aprovados. Captura alemã320 revista; PostgreSQL16/suite338/restauro pendentes. C06/C06-005 permanecem abertos; próximo:`cw-field-photos.js`, mensagens próprias ainda em português. C08/C10 e inventário estático415 não encerrados por associação.

## Histórico funcional — TASK443 / revisão administrativa dos cadastros

`cw-field-intake-review.js`:41 entradas/205 textos em PT/EN/FR/ES/DE, com título/intro, rótulos, estados, diálogos, recuperação e erros próprios. `admin-operational-settings.html` passa a carregar o seletor normal, com `data-cw-no-i18n` no body para proteger os outros painéis e dados; o painel de revisão usa associações explícitas. Não equivale a tradução da página C08-013. Datas apenas mudam de formato; dados/notas/servidor/recibos permanecem literais. Cache228/runner337. [Prova443](evidence/20260929_task443_local.json).

Quatro grupos aprovados;1 356 unitários/quatro técnicos/sintaxe. Cinco idiomas/320/390/1440, nós/foco/bytes/payload/UUID íntegros sem reler produtores nem pedidos operacionais; cancelamento/quota,403 literal, recusa real por edição posterior, revisão explícita, resposta retida/perdida/reload e reenvio exato sem duplicação, offline/vazio/troca de conta. Teste usa administrador próprio, preservando preferência do administrador comum; ajustada expectativa para ativação legítima do cliente. Captura alemã320 revista no contentor com scroll; PostgreSQL16/suite337/restauro pendentes. C06-004/C06 e C08/C10 continuam abertos. Próximo:`cw-field-recovery.js`/C06-005; mensagens próprias de fotos ainda pendentes. Contagens estáticas TASK415 não recalculadas.

## Histórico funcional — TASK442 / preparação e receção de química

`cw-field-day-review.js`: necessidades, quantidades, transferências, receção física, formulário e estados/erros próprios em PT/EN/FR/ES/DE:34 entradas/170 textos. Textos dentro de labels conservam inputs; mensagens de recuperação usam um filho, preservando o formulário após recuperar uma transferência em falta. Dados/valores/IDs/chaves/UUID/payload e detalhes externos conservados; idioma não consulta fontes nem envia operações, apenas a preferência habitual pode ser gravada. Catálogo81 e código anterior inalterados. Cache227/runner336; [prova442](evidence/20260929_task442_local.json).

Novo grupo e três regressões aprovados;1 356 unitários/quatro técnicos/sintaxe. Cinco idiomas/320/390/1440, REGULAR/EXTRA de igual ID, quantidade desconhecida, formulário após falta de transferência, quota,403 literal, resposta perdida/reenvio exato, receções parciais1,25+2,75 sem duplicação, stock/visitas íntegros, offline/cache/vazio. Devolução0,5 apenas em leitura controlada. Captura alemã320 revista; nav/chrome C08-025/026 e datas C10 pendentes. C06/C06-003 abertas; gates336/restauro nativos pendentes. Próximo:`cw-field-intake-review.js`/C06-004 em `admin-operational-settings.html`, com rótulos/estados/confirmação ainda em português. Contagens estáticas TASK415 não recalculadas.

## Histórico funcional — TASK441 / passagem de responsabilidade e receção de visitas

`cw-field-day-review.js`: dois painéis em PT/EN/FR/ES/DE, incluindo atributos acessíveis, diálogo de aceitação, estados, erros próprios e apresentação de datas. 39 entradas/195 textos; catálogo anterior42 e regras de recolha/revisão preservados. Texto literal dos técnicos/piscinas/motivos/erros externos, dados, nós, foco, seleção, inputs e abertura de dias futuros mantidos na mudança de idioma. A preferência continua a ser guardada pelo mecanismo existente; não há consultas/envios operacionais por traduzir. Cache226/runner335; [prova441](evidence/20260929_task441_local.json).

Quatro integrações, 1 356 unitários/quatro técnicos e sintaxe aprovados. REGULAR/EXTRA de igual ID, pedido/cancelamento/aceitação reais, cinco diálogos cancelados, recusa literal, confirmação extra única com resposta retida, offline/cache/vazio. Capturas alemãs320 revistas. **Limites:** preparação/receção de química continua byte a byte por traduzir; C06/C06-003 abertas, nav/chrome C08-025/026 e datas C10 pendentes. Publicação autorizada em repositório público durante desenvolvimento, com conversão para privado antes da conclusão. PostgreSQL16/suite335/restauro ainda pendentes. Contagens estáticas TASK415 não recalculadas.

## Histórico funcional — TASK440 / formulário e fila de equipamento

`field-equipment-maintenance.js`: formulário/fila, rótulos, opções, controlos de tempo/material, estados de consulta/recuperação e erros próprios em PT/EN/FR/ES/DE. 115 entradas/575 textos; catálogo existente do write-store reutilizado para erros identificados. Associações a nós de texto conservam inputs dentro de labels, valores, seleção, foco, nós e estado dos controlos. Datas e números mudam apenas de apresentação, com instantes/fuso conservados. Títulos/instruções/notas, materiais/unidades, recibos e falhas persistidas mantêm os originais; erros próprios conservam Error.message português. Resumos anteriores e regras de negócio conservados. Cache225/runner334; [prova440](evidence/20260929_task440_local.json).

Novo grupo e três regressões aprovados. Cinco idiomas/320/390/1440, rascunhos REGULAR/EXTRA de igual ID, dois intervalos, quantidade com vírgula, material inválido, mudança de modo protegida, quota, conflito, erro403 literal, revisão extra aplicada uma vez, recusa regular/ack, rascunho ilegível, offline/cache ausente e proteção permanente de conta. Mudanças de idioma conservam dados/bytes/UUID/payload/hash/recibo e não invocam produtores nem pedidos operacionais. Stock e execução das visitas preservados, descontando apenas a alteração deliberada do início da fixture regular. Sintaxe, 1 356 unitários e quatro técnicos aprovados.

**Limites:** publicação suspensa por privacidade; PostgreSQL16/suite334/restauro pendentes. Captura alemã320 revista e opções traduzidas encurtadas; ações/nav comuns fixas sobrepõem-se ao meio da captura longa, permanecendo C08-025/026. QA alinhada com Lisboa; política entre fusos/datas C10 não alterada nem aceite. C06/C06-003 abertas. Próximo: passagem/receção e restantes fontes. Contagens estáticas TASK415 não recalculadas; histórico abaixo mantém o âmbito à data.

## Histórico funcional — TASK439 / formulário e banner de impedimentos

`cw-field-incomplete.js` localiza rótulos, opções, ajuda, estados, banner, confirmação e recuperação em PT/EN/FR/ES/DE (46 entradas); `cw-incomplete-workflow.js` associa dez erros próprios a cópias de apresentação privadas e imutáveis. Total280 textos. Error.message português e SyntaxError original conservados; erros externos/servidor e texto dos registos continuam literais, mesmo com conteúdo igual ao de um erro próprio. Mudança de idioma só repinta textos/atributos; dados, decisões operacionais e catálogo/construtor/produtor dos resumos permanecem conservados. Cache224/runner333; [prova439](evidence/20260929_task439_local.json).

Novo grupo e três regressões aprovados: cinco idiomas/320/390/1440, rascunhos reais REGULAR/EXTRA de igual ID, quantidade com vírgula, validação, quota, conflito entre janelas, recusa403 literal, diálogo cancelado, recusa real INCOMPLETE_STALE, envio extra único, revisão de recusa no outro tipo de visita, legado válido/ilegível/recuperado, offline/cache/contexto ausente e sessão inválida. Valores/bytes/UUID/payload/hash/recibos/nós/foco/seleção/visibilidade/bloqueios preservados nas mudanças de idioma, sem chamadas aos produtores nem pedidos operacionais. Stock e execução extra original conservados. Sintaxe, 1 356 unitários e quatro técnicos aprovados.

**Limites:** publicação suspensa até resolver privacidade; aceitação PostgreSQL16/suite333/restauro pendente. Captura alemã320 revista, com texto/controlos dentro da largura; ações/nav fixas comuns aparecem sobre o meio da captura longa e continuam C08-025/026. Outros consumidores do workflow continuam a receber Error.message original; não são traduzidos por esta alteração. Próximo: formulário/fila/tempo/material de equipamento, depois passagem/receção e restantes fontes. C06/C06-003 abertas. Contagens estáticas TASK415 não recalculadas; histórico abaixo conserva o âmbito à data.

## Histórico funcional — TASK438 / mensagens do formulário de ocorrências

`cw-field-problem-report.js`: rótulos, opções, atributos acessíveis, contexto, gravação e recuperação localizados em PT/EN/FR/ES/DE. 49 entradas/245 textos novos e dois avisos antigos reutilizados. Valores das opções/campos e textos de origem conservados; eventos de idioma só repintam associações de apresentação. Erros próprios conservam Error.message português, com cópia de apresentação privada; detalhes externos e erros do servidor ficam literais. Catálogo/construtor dos resumos437 inalterados; classificação do legado independente do idioma mostrado. Cache223/runner332; [prova438](evidence/20260929_task438_local.json).

Novo grupo e três regressões aprovados. Cinco idiomas/320/390/1440, valores/bytes/UUID/payload/hash/recibos/nós/foco/seleção/bloqueios preservados, sem novas leituras/envios por mudar idioma. Quota, recuperação fechada, contexto diferente, recusa403, lock ocupado, offline/cache, resposta retida, falha de limpeza após confirmação, conflito entre janelas, rascunho ilegível, pedido ausente/incompatível e troca de conta cobertos. Preparação aguarda sincronização de lembretes no arranque/reconexão antes de medir os pedidos. Sintaxe, 1 356 unitários e quatro técnicos aprovados; captura alemã320 revista.

**Limites:** publicação pendente de privacidade e aceitação nativa PostgreSQL16/suite332/restauro; cabeçalho/subtítulo comuns da secção e navegação continuam C08-025/026. C06/C06-003 não encerradas. Próximo: formulário/banner de impedimentos; permanecem equipamento, painéis de passagem/receção e outras fontes do inventário. Contagens estáticas TASK415 não recalculadas; histórico abaixo conserva o âmbito à data.

## Histórico funcional — TASK437 / resumos de ocorrências

`cw-field-problem-report.js` captura textos PT/EN/FR/ES/DE para rascunho por enviar, ocorrência por confirmar/bloqueada, falha ao guardar e avisos de histórico antigo válido/ilegível, incluindo contexto sem associação. Sete entradas/35 textos. JSON `{kind,text}` português conservado; fotografia adicional imutável e não enumerável. A revisão existente escolhe o idioma sem reler o produtor nem alterar dados. Cache222/runner331; [prova437](evidence/20260929_task437_local.json).

Novo grupo e três regressões aprovados: formulário real/quatro campos, cinco idiomas/320/390/1440, quota com texto não guardado preservado, pedido bloqueado, histórico válido/ilegível, resposta retida, mudança silenciosa, offline/cache, rascunho ilegível, confirmação explícita única e troca de conta. Dados/UUID/payload/hash/nós/foco/hora conservados; nenhuma escrita operacional por mudar idioma. Captura alemã320 revista. Sintaxe, 1 356 unitários e quatro técnicos aprovados. Publicação pendente da privacidade; PGlite não substitui suite331/restauro nativo.

**Âmbito parcial:** formulário e mensagens próprias de estado/recuperação de ocorrências continuam por localizar, sendo o próximo lote. Mantêm-se pendentes formulários/banners de impedimentos/equipamento e painéis de passagem/receção. C06 e C06-003 abertas; chrome/nav C08-025/026. Contagens estáticas TASK415 não recalculadas; histórico abaixo conserva o âmbito à data.

## Histórico funcional — TASK436 / resumos de equipamento

`field-equipment-maintenance.js` fornece textos capturados em PT/EN/FR/ES/DE para rascunhos guardados, revisões por confirmar (incluindo pedidos bloqueados) e revisões recusadas. Os rótulos REGULAR/EXTRA traduzem-se mantendo a identidade do tipo; títulos e mensagens do servidor permanecem literais. Seis entradas/30 textos. O consumidor existente escolhe o idioma sem reler o produtor; o JSON `{kind,text}` conserva o português anterior. Propriedade adicional não enumerável e imutável, sem alterar os registos persistidos. Cache221/runner330; [prova436](evidence/20260929_task436_local.json).

Novo grupo e três regressões de navegador aprovados. Cobertura: cinco idiomas/320/390/1440, formulários reais com notas/tempos/materiais, REGULAR/EXTRA de igual ID, pedido bloqueado403, recusa real EQUIPMENT_STALE, correspondência exata de confirmação/rascunho, texto literal, resposta retida, troca silenciosa de idioma, offline/reload/cache, rascunho ilegível e bloqueio após troca de conta. Mudanças de idioma preservam nós/foco/hora/bytes/UUID/payload/hash/recibo e não fazem pedidos operacionais. Captura alemã320 revista; 1 356 unitários, quatro técnicos e sintaxe aprovados. Publicação pendente da privacidade; ensaios PGlite não equivalem a aceitação PostgreSQL16/suite330/restauro nativo.

**Âmbito parcial:** formulário, fila, controlos de tempo/material e mensagens próprias de equipamento permanecem por localizar; parsing, gravação/envio/sincronização e proteção de sessão estão inalterados. Próxima fonte: resumos de ocorrências (`cw-field-problem-report.js`). Mensagens próprias de impedimentos, painéis de passagem/receção e outras fontes do inventário também continuam pendentes. C06 e C06-003 permanecem abertas. Chrome/nav é C08-025/026. Contagens estáticas TASK415 não recalculadas; as entradas históricas abaixo conservam os limites à data de cada lote.

## Histórico funcional — TASK435 / resumos de impedimentos

`cw-field-incomplete.js` fornece textos capturados em PT/EN/FR/ES/DE para pedidos por confirmar, aviso antigo e rascunhos REGULAR/EXTRA. O consumidor da revisão diária já existente seleciona o idioma sem reler o produtor. O JSON `{kind,text}` conserva o português anterior e os rótulos/mensagens de origem mantêm-se literais. Uma propriedade não enumerável e imutável contém apenas os textos; não altera os registos persistidos. Cache220/runner329; [prova435](evidence/20260929_task435_local.json).

Quatro grupos de navegador aprovados, incluindo formulário real, rascunhos de igual ID/tipos diferentes, pedido pendente, recusa do servidor, legado, resposta retida, troca de conta, offline/reload e bytes ilegíveis preservados. Mudança de idioma mantém nós/foco/hora/UUID/payload/hash/recibo e não faz pedidos operacionais. Captura alemã320 revista. Publicação pendente da privacidade; não se considera aceite nativamente.

**Âmbito parcial:** formulário, banner, seleção, gravação/envio/sincronização e respetivas mensagens próprias dos impedimentos permanecem por localizar. Resumos de equipamento e ocorrências, além dos painéis de passagem/receção, também continuam pendentes. C06 e C06-003 permanecem abertas. As contagens estáticas TASK415 não foram recalculadas.

## Histórico funcional — TASK433 / resumos da revisão

Material (`cw-field-stock-request.js`) e rascunhos de trabalho (`cw-field-visit-drafts.js`) fornecem textos capturados nos cinco idiomas ao consumidor `cw-field-day-review.js`. Alterar idioma conserva a fotografia de dados, a hora, a identidade dos nós e o contrato JSON anterior; não invoca novamente os produtores. Catálogos existentes inalterados. Cache219/runner328; [prova433](evidence/20260929_task433_local.json).

Continuam pendentes os resumos de impedimentos, equipamento e ocorrências e os painéis posteriores de passagem/receção. C06 permanece aberta. O histórico abaixo descreve os limites de cada lote à data; as contagens estáticas TASK415 não foram recalculadas.

## Histórico funcional — TASK432 / C06-003

Mensagens **próprias da revisão diária** de `cw-field-day-review.js`: 42 entradas PT/EN/FR/ES/DE; identidade dos avisos, dados literais e hora da revisão preservados na mudança de idioma. Ensaios de idioma/layout/estado assíncrono/offline locais e gates nativos constam da [prova432](evidence/20260929_task432_local.json). Cache218, runner327. Não reclassifica as contagens estáticas da base TASK415.

Pendente: consumidores de resumos externos capturados (`CWFieldIncomplete`, equipamento, material, ocorrências e rascunhos) e painéis posteriores de passagem/receção do mesmo ficheiro. Estes painéis permanecem byte a byte; C06-003 e C06 não ficam encerrados por esta tradução parcial.

## Contagem de entradas

| Estado estático | Entradas |
|---|---:|
| engine-excluded-review | 1047 |
| global-key-available | 183 |
| module-provider-candidate | 215 |
| no-static-provider | 13611 |
| translation-key-review | 1266 |

`global-key-available`: chave disponível, execução por confirmar. `module-provider-candidate`: texto aparece no PT de um dicionário alcançável, sem prova de ligação ao nó/estado. `engine-excluded-review`: fora do motor genérico; pode estar deliberadamente protegido ou tratado pelo módulo. `no-static-provider`: nenhuma correspondência encontrada; é candidato a revisão, não contagem de erros confirmados. `translation-key-review`: chamada de tradutor; resolver a chave e o estado no módulo. Backend/erros internos e fontes sem entrada observada permanecem candidatos explícitos.

## Páginas e perfis

| Página | Perfis declarados/guarda | C | Lote | Textos HTML/inline | Recursos JS alcançáveis | Motor global |
|---|---|---|---|---:|---:|---|
| /admin-ai | ADMIN | C08 | C08-001 | 51 | 14 | Não encontrado |
| /admin-alerts | ADMIN | C08 | C08-001 | 76 | 20 | Não encontrado |
| /admin-client-settings | ADMIN | C09 | C09-001 | 48 | 15 | Não encontrado |
| /admin-clients | ADMIN | C09 | C09-001 | 60 | 15 | Referenciado |
| /admin-collection | ADMIN | C08 | C08-002 | 43 | 15 | Não encontrado |
| /admin-command-center | ADMIN | C08 | C08-003 | 4 | 1 | Não encontrado |
| /admin-company-closures | ADMIN | C08 | C08-003 | 49 | 12 | Não encontrado |
| /admin-core-flow | ADMIN | C08 | C08-004 | 4 | 1 | Não encontrado |
| /admin-credit-revenue | ADMIN | C08 | C08-004 | 39 | 10 | Não encontrado |
| /admin-crm | ADMIN | C08 | C08-005 | 53 | 17 | Referenciado |
| /admin-dashboard | ADMIN | C07 | C07-001 | 43 | 12 | Não encontrado |
| /admin-email-logs | ADMIN | C08 | C08-006 | 13 | 13 | Não encontrado |
| /admin-email-review | ADMIN | C08 | C08-006 | 31 | 7 | Não encontrado |
| /admin-expenses | ADMIN | C08 | C08-007 | 145 | 28 | Não encontrado |
| /admin-inventory | ADMIN | C08 | C08-008 | 46 | 15 | Não encontrado |
| /admin-keys | ADMIN | C08 | C08-008 | 28 | 11 | Não encontrado |
| /admin-live-map | ADMIN | C08 | C08-009 | 18 | 13 | Não encontrado |
| /admin-login | PUBLIC | C08 | C08-009 | 5 | 11 | Não encontrado |
| /admin-map | ADMIN | C08 | C08-010 | 7 | 13 | Não encontrado |
| /admin-master-control | ADMIN | C08 | C08-011 | 129 | 10 | Não encontrado |
| /admin-menu | ADMIN | C08 | C08-011 | 18 | 12 | Não encontrado |
| /admin-notifications | ADMIN | C08 | C08-012 | 6 | 15 | Não encontrado |
| /admin-onboarding | ADMIN | C08 | C08-012 | 17 | 12 | Não encontrado |
| /admin-operational-flow | ADMIN | C08 | C08-013 | 4 | 1 | Não encontrado |
| /admin-operational-settings | ADMIN | C08 | C08-013 | 165 | 19 | Não encontrado |
| /admin-payment-settings | ADMIN | C08 | C08-014 | 12 | 12 | Não encontrado |
| /admin-payments | ADMIN | C08 | C08-014 | 23 | 15 | Não encontrado |
| /admin-pool-calculator | ADMIN | C08 | C08-015 | 81 | 17 | Não encontrado |
| /admin-pool-technical | ADMIN | C08 | C08-015 | 118 | 17 | Referenciado |
| /admin-pools | ADMIN | C08 | C08-016 | 52 | 15 | Referenciado |
| /admin-priority | ADMIN | C08 | C08-016 | 5 | 15 | Não encontrado |
| /admin-reports | ADMIN | C09 | C09-002 | 28 | 14 | Não encontrado |
| /admin-revenue | ADMIN | C08 | C08-017 | 40 | 10 | Não encontrado |
| /admin-rounds | ADMIN | C06 | C06-001 | 107 | 13 | Não encontrado |
| /admin-security | ADMIN | C08 | C08-017 | 9 | 12 | Não encontrado |
| /admin-service-log | ADMIN | C08 | C08-018 | 22 | 10 | Não encontrado |
| /admin-suppliers | ADMIN | C08 | C08-018 | 10 | 14 | Não encontrado |
| /admin-technicians | ADMIN | C08 | C08-019 | 7 | 13 | Não encontrado |
| /admin-test-center | ADMIN | C08 | C08-019 | 4 | 1 | Não encontrado |
| /admin-today | ADMIN | C08 | C08-020 | 13 | 12 | Não encontrado |
| /admin-ui-settings | ADMIN | C08 | C08-020 | 16 | 11 | Não encontrado |
| /admin-vehicles | ADMIN | C08 | C08-021 | 39 | 21 | Não encontrado |
| /admin-visits-dashboard | ADMIN | C06 | C06-001 | 12 | 13 | Não encontrado |
| /admin-visits | ADMIN | C06 | C06-002 | 19 | 12 | Não encontrado |
| /alerts-financial | ADMIN | C08 | C08-021 | 16 | 12 | Não encontrado |
| /alerts | ADMIN | C08 | C08-022 | 39 | 9 | Não encontrado |
| /billing-center | ADMIN | C08 | C08-022 | 21 | 13 | Não encontrado |
| /billing-extras | ADMIN | C08 | C08-022 | 20 | 11 | Não encontrado |
| /billing-history | ADMIN | C08 | C08-023 | 23 | 15 | Não encontrado |
| /billing | ADMIN | C08 | C08-023 | 25 | 12 | Não encontrado |
| /chat | ADMIN | C08 | C08-024 | 12 | 14 | Não encontrado |
| /client-dashboard | CLIENT | C09 | C09-003 | 20 | 11 | Não encontrado |
| /client-history | CLIENT | C09 | C09-003 | 19 | 12 | Não encontrado |
| /client-login | PUBLIC | C09 | C09-004 | 6 | 10 | Não encontrado |
| /client-menu | CLIENT | C09 | C09-004 | 19 | 13 | Não encontrado |
| /client-notifications | CLIENT | C09 | C09-005 | 12 | 14 | Não encontrado |
| /client-payments | CLIENT | C09 | C09-005 | 21 | 13 | Não encontrado |
| /client-portal | ADMIN, CLIENT | C09 | C09-006 | 121 | 17 | Não encontrado |
| /client-wow | CLIENT | C09 | C09-006 | 4 | 1 | Não encontrado |
| /client | CLIENT | C09 | C09-007 | 12 | 12 | Não encontrado |
| /client_chat | ADMIN, CLIENT | C09 | C09-007 | 6 | 14 | Não encontrado |
| /client_tech | CLIENT | C09 | C09-008 | 19 | 12 | Não encontrado |
| /communications | ADMIN | C08 | C08-024 | 13 | 12 | Não encontrado |
| /config-notifications | ADMIN, CLIENT, TEAM_LEADER, TECHNICIAN | C08 | C08-025 | 3 | 0 | Não encontrado |
| /crystal-os-v2-route-index | ADMIN | C06 | C06-002 | 18 | 12 | Não encontrado |
| /dashboard | ADMIN | C07 | C07-001 | 34 | 12 | Não encontrado |
| /equipment-history-review | ADMIN | C08 | C08-056 | 26 | 13 | Não encontrado |
| /equipment-material-review | ADMIN | C08 | C08-056 | 28 | 13 | Não encontrado |
| /equipment-time-review | ADMIN | C08 | C08-057 | 27 | 14 | Não encontrado |
| /help-center | ADMIN, CLIENT, TEAM_LEADER, TECHNICIAN | C08 | C08-057 | 4 | 12 | Não encontrado |
| /incident-center | ADMIN | C07 | C07-002 | 14 | 12 | Não encontrado |
| /invoice-document | PUBLIC | C09 | C09-013 | 9 | 4 | Não encontrado |
| /invoices | ADMIN | C09 | C09-014 | 30 | 14 | Não encontrado |
| /labor-cost-bases | ADMIN | C08 | C08-058 | 48 | 15 | Não encontrado |
| /login | PUBLIC | C08 | C08-059 | 19 | 8 | Não encontrado |
| /map | ADMIN | C08 | C08-059 | 11 | 13 | Não encontrado |
| /metrics | ADMIN | C08 | C08-060 | 6 | 13 | Não encontrado |
| /multi-map | ADMIN | C08 | C08-060 | 11 | 13 | Não encontrado |
| /notifications | ADMIN | C08 | C08-061 | 5 | 14 | Não encontrado |
| /operational-dashboard | ADMIN | C07 | C07-004 | 20 | 12 | Não encontrado |
| /operational-risk-rules | ADMIN | C08 | C08-062 | 10 | 5 | Não encontrado |
| /profit-map | ADMIN | C08 | C08-062 | 11 | 13 | Não encontrado |
| /ranking | ADMIN | C08 | C08-062 | 5 | 11 | Não encontrado |
| /reminder-materials | ADMIN | C08 | C08-063 | 24 | 14 | Não encontrado |
| /reminder-resources | ADMIN | C08 | C08-063 | 37 | 15 | Não encontrado |
| /reminder-visits | ADMIN | C06 | C06-010 | 37 | 14 | Não encontrado |
| /repair-execution | ADMIN | C08 | C08-064 | 19 | 9 | Não encontrado |
| /repair-work | Sem indício explícito | C08 | C08-064 | 25 | 9 | Não encontrado |
| /report-center | ADMIN | C09 | C09-014 | 14 | 13 | Não encontrado |
| /report-settings | ADMIN | C09 | C09-015 | 58 | 13 | Não encontrado |
| /route-map | ADMIN | C06 | C06-011 | 9 | 13 | Não encontrado |
| /settings | ADMIN, CLIENT, TEAM_LEADER, TECHNICIAN | C08 | C08-065 | 8 | 12 | Não encontrado |
| /splash | ADMIN | C08 | C08-066 | 4 | 1 | Não encontrado |
| /technician-chat | ADMIN | C06 | C06-011 | 15 | 5 | Referenciado |
| /technician-field-mode | TEAM_LEADER, TECHNICIAN | C06 | C06-012 | 225 | 37 | Referenciado |
| /technician-gps | TEAM_LEADER, TECHNICIAN | C06 | C06-012 | 13 | 13 | Não encontrado |
| /technician-guide | TEAM_LEADER, TECHNICIAN | C06 | C06-013 | 8 | 16 | Não encontrado |
| /technician-history | TEAM_LEADER, TECHNICIAN | C06 | C06-013 | 5 | 5 | Não encontrado |
| /technician-login | PUBLIC | C06 | C06-014 | 5 | 10 | Não encontrado |
| /technician-map | TEAM_LEADER, TECHNICIAN | C06 | C06-014 | 12 | 12 | Não encontrado |
| /technician-new-client | TEAM_LEADER, TECHNICIAN | C09 | C09-015 | 37 | 12 | Não encontrado |
| /technician-profile | TEAM_LEADER, TECHNICIAN | C06 | C06-015 | 5 | 5 | Não encontrado |
| /technician-profit-dashboard | ADMIN | C08 | C08-066 | 15 | 12 | Não encontrado |
| /technician-profit | ADMIN | C08 | C08-067 | 15 | 12 | Não encontrado |
| /technician-route | TEAM_LEADER, TECHNICIAN | C06 | C06-015 | 10 | 12 | Não encontrado |
| /technician-visit | TEAM_LEADER, TECHNICIAN | C06 | C06-016 | 50 | 12 | Não encontrado |
| /technician | TEAM_LEADER, TECHNICIAN | C06 | C06-016 | 18 | 33 | Não encontrado |
| /tests/test_extra.html | Sem indício explícito | C08 | C08-067 | 5 | 0 | Não encontrado |
| /to-issue | ADMIN | C08 | C08-067 | 16 | 13 | Não encontrado |
| /transport-guide-create | ADMIN | C08 | C08-068 | 9 | 5 | Não encontrado |
| /transport-guide-documents | ADMIN | C09 | C09-016 | 9 | 9 | Não encontrado |
| /transport-guide-items | ADMIN | C08 | C08-068 | 9 | 6 | Não encontrado |
| /transport-guide-manage | ADMIN | C08 | C08-068 | 9 | 9 | Não encontrado |
| /ui/views/demo.html | Sem indício explícito | C08 | C08-070 | 5 | 5 | Não encontrado |
| /v26/admin-prototype.html | Sem indício explícito | C08 | C08-071 | 18 | 0 | Não encontrado |
| /v26/client-prototype.html | Sem indício explícito | C09 | C09-016 | 15 | 0 | Não encontrado |
| /v26/index.html | Sem indício explícito | C08 | C08-071 | 6 | 0 | Não encontrado |
| /v26/technician-prototype.html | Sem indício explícito | C06 | C06-017 | 17 | 0 | Não encontrado |
| /v26/technician/index.html | Sem indício explícito | C08 | C08-071 | 12 | 0 | Não encontrado |
| /vehicle-assignment | ADMIN | C08 | C08-071 | 10 | 5 | Não encontrado |
| /vehicle-consumption | ADMIN, TEAM_LEADER, TECHNICIAN | C08 | C08-072 | 10 | 3 | Não encontrado |
| /vehicle-maintenance | Sem indício explícito | C08 | C08-072 | 10 | 6 | Não encontrado |
| /vehicle-stock-preset | ADMIN | C08 | C08-072 | 10 | 5 | Não encontrado |
| /visit-report-review | ADMIN | C09 | C09-016 | 32 | 12 | Não encontrado |
| /work-guide-close | Sem indício explícito | C08 | C08-072 | 10 | 5 | Não encontrado |
| /work-guide-start | Sem indício explícito | C08 | C08-073 | 10 | 5 | Não encontrado |

Perfis vêm do catálogo e guardas existentes; não alargam autorização. Recursos incluem declarações HTML e expressões literais de carregamento de código transitivas, sem considerar listas de cache como scripts executados; carregamentos construídos dinamicamente podem exigir revisão. HTML auxiliar/protótipo está identificado no JSON e não é presumido percurso de produção. Fontes sem página alcançável estão listadas com `no-page-reference`, nunca como ecrãs usados.

## Fila finita C06–C09

| Lote | Responsável | Fontes a rever |
|---|---|---|
| C06-001 | C06 | `frontend/admin-rounds.html`, `frontend/admin-rounds.js`, `frontend/admin-visits-dashboard.html`, `frontend/admin-visits-dashboard.js` |
| C06-002 | C06 | `frontend/admin-visits.html`, `frontend/admin-visits.js`, `frontend/crystal-os-v2-route-index.html`, `frontend/cw-extra-visit-correction.js` |
| C06-003 | C06 | `frontend/cw-field-alert-journal.js`, `frontend/cw-field-day-review.js`, `frontend/cw-field-guide-projection.js`, `frontend/cw-field-incomplete.js` |
| C06-004 | C06 | `frontend/cw-field-intake-review.js`, `frontend/cw-field-internal-alert.js`, `frontend/cw-field-materials.js`, `frontend/cw-field-offline.js` |
| C06-005 | C06 | `frontend/cw-field-photos.js`, `frontend/cw-field-recovery.js`, `frontend/cw-field-reminders.js`, `frontend/cw-field-route-cache.js` |
| C06-006 | C06 | `frontend/cw-field-route-preview.js`, `frontend/cw-field-stock-request.js`, `frontend/cw-field-visit-drafts.js`, `frontend/cw-field-write-store.js` |
| C06-007 | C06 | `frontend/cw-legacy-route-cache.js`, `frontend/cw-legacy-visit-drafts.js`, `frontend/cw-legacy-visit-products.js`, `frontend/cw-reminder-visit-cost-rules.js` |
| C06-008 | C06 | `frontend/cw-reminder-visit-resource-rules.js`, `frontend/cw-reminder-visit-rules.js`, `frontend/cw-technician-guide-copy.js`, `frontend/cw-technician-guide-read-rules.js` |
| C06-009 | C06 | `frontend/cw-visit-product-identity.js`, `frontend/field-equipment-maintenance.js`, `frontend/gps.js`, `frontend/js/offline/offline-gps.js` |
| C06-010 | C06 | `frontend/js/offline/offline-photos.js`, `frontend/js/offline/offline-queue.js`, `frontend/reminder-visits.html`, `frontend/reminder-visits.js` |
| C06-011 | C06 | `frontend/route-map.html`, `frontend/route-map.js`, `frontend/technician-auth-guard.js`, `frontend/technician-chat.html` |
| C06-012 | C06 | `frontend/technician-chat.js`, `frontend/technician-field-mode.html`, `frontend/technician-field-mode.js`, `frontend/technician-gps.html` |
| C06-013 | C06 | `frontend/technician-gps.js`, `frontend/technician-guide.html`, `frontend/technician-guide.js`, `frontend/technician-history.html` |
| C06-014 | C06 | `frontend/technician-history.js`, `frontend/technician-login.html`, `frontend/technician-login.js`, `frontend/technician-map.html` |
| C06-015 | C06 | `frontend/technician-map.js`, `frontend/technician-profile.html`, `frontend/technician-profile.js`, `frontend/technician-route.html` |
| C06-016 | C06 | `frontend/technician-route.js`, `frontend/technician-visit.html`, `frontend/technician-visit.js`, `frontend/technician.html` |
| C06-017 | C06 | `frontend/technician.js`, `frontend/v26/technician-prototype.html`, `src/business/admin/DashboardVisitBusiness.js`, `src/business/admin/RoundAssignmentBusiness.js` |
| C06-018 | C06 | `src/business/admin/VisitCoverageBusiness.js`, `src/business/pool/PoolVisitBusiness.js`, `src/business/real/RealTechnicianService.js`, `src/business/real/RealVisitService.js` |
| C06-019 | C06 | `src/business/technician/IncompleteVisitBusiness.js`, `src/business/technician/LegacyVisitSyncBusiness.js`, `src/business/technician/TechnicianAuthBusiness.js`, `src/business/technician/TechnicianBriefingBusiness.js` |
| C06-020 | C06 | `src/business/technician/TechnicianDashboardBusiness.js`, `src/business/technician/TechnicianGpsBusiness.js`, `src/business/technician/TechnicianPortalBusiness.js`, `src/business/technician/TechnicianRouteBusiness.js` |
| C06-021 | C06 | `src/business/technician/TechnicianStatsBusiness.js`, `src/business/technician/TechnicianVisitBusiness.js`, `src/business/technician/TechnicianWorkdayBusiness.js`, `src/business/technicians/TechnicianEntity.js` |
| C06-022 | C06 | `src/business/technicians/TechnicianRepository.js`, `src/business/technicians/TechnicianService.js`, `src/business/tests/realTechnicianTest.js`, `src/business/tests/realVisitTest.js` |
| C06-023 | C06 | `src/business/tests/technicianTest.js`, `src/business/tests/visitTest.js`, `src/business/visits/VisitEntity.js`, `src/business/visits/VisitRepository.js` |
| C06-024 | C06 | `src/business/visits/VisitService.js`, `src/controllers/adminRoundsController.js`, `src/controllers/extraVisitController.js`, `src/controllers/gpsController.js` |
| C06-025 | C06 | `src/controllers/roundController.js`, `src/controllers/technicianAuthController.js`, `src/controllers/technicianController.js`, `src/controllers/technicianManagementController.js` |
| C06-026 | C06 | `src/controllers/technicianPortalController.js`, `src/controllers/technicianStatsController.js`, `src/controllers/visitController.js`, `src/core/missions/technicianMissionEngine.js` |
| C06-027 | C06 | `src/dal/ServiceVisitRepository.js`, `src/dal/TechnicianRepository.js`, `src/routes/adminRoundsRoutes.js`, `src/routes/extraVisitExecutionRoutes.js` |
| C06-028 | C06 | `src/routes/extraVisitRoutes.js`, `src/routes/gpsRoutes.js`, `src/routes/roundRoutes.js`, `src/routes/syncRoutes.js` |
| C06-029 | C06 | `src/routes/technicianAuthRoutes.js`, `src/routes/technicianCrudRoutes.js`, `src/routes/technicianIntakeRoutes.js`, `src/routes/technicianPortalRoutes.js` |
| C06-030 | C06 | `src/routes/technicianRoutes.js`, `src/routes/technicianStatsRoutes.js`, `src/routes/technicianWorkDayRoutes.js`, `src/routes/visitRoutes.js` |
| C06-031 | C06 | `src/services/ai/agents/technicianAgent.js`, `src/services/ai/context/technicianContext.js`, `src/services/ai/context/visitContext.js`, `src/services/autoVisitAlertService.js` |
| C06-032 | C06 | `src/services/extraVisitBillingService.js`, `src/services/extraVisitCorrectionService.js`, `src/services/extraVisitExecutionService.js`, `src/services/incompleteVisitLifecycle.js` |
| C06-033 | C06 | `src/services/reminderVisitCostSource.js`, `src/services/reminderVisitJournal.js`, `src/services/reminderVisitResourceJournal.js`, `src/services/reminderVisitResourceService.js` |
| C06-034 | C06 | `src/services/reminderVisitService.js`, `src/services/roundScheduleService.js`, `src/services/serviceVisitCompletionService.js`, `src/services/technicianManagementService.js` |
| C06-035 | C06 | `src/services/technicianPinService.js`, `src/services/technicianResponseSanitizer.js`, `src/services/visitCorrectionStockService.js`, `src/services/visitPhotoStorageService.js` |
| C06-036 | C06 | `src/services/visitProductStockReconciliation.js`, `src/services/visitReceiptService.js`, `src/utils/serviceVisitFilters.js` |
| C07-001 | C07 | `frontend/admin-dashboard.html`, `frontend/admin-dashboard.js`, `frontend/dashboard-feed.js`, `frontend/dashboard.html` |
| C07-002 | C07 | `frontend/dashboard.js`, `frontend/incident-center.html`, `frontend/incident-center.js`, `frontend/js/dashboard-feed.js` |
| C07-003 | C07 | `frontend/js/dashboard/dashboard-ai.js`, `frontend/js/dashboard/dashboard-alerts.js`, `frontend/js/dashboard/dashboard-core.js`, `frontend/js/dashboard/dashboard-map.js` |
| C07-004 | C07 | `frontend/operational-dashboard.html`, `frontend/operational-dashboard.js` |
| C08-001 | C08 | `frontend/account-notification-settings.js`, `frontend/admin-ai.html`, `frontend/admin-ai.js`, `frontend/admin-alerts.html` |
| C08-002 | C08 | `frontend/admin-alerts.js`, `frontend/admin-auth-guard.js`, `frontend/admin-collection.html`, `frontend/admin-collection.js` |
| C08-003 | C08 | `frontend/admin-command-center.html`, `frontend/admin-command-center.js`, `frontend/admin-commercial-quotes.js`, `frontend/admin-company-closures.html` |
| C08-004 | C08 | `frontend/admin-company-closures.js`, `frontend/admin-core-flow.html`, `frontend/admin-core-flow.js`, `frontend/admin-credit-revenue.html` |
| C08-005 | C08 | `frontend/admin-credit-revenue.js`, `frontend/admin-crm.html`, `frontend/admin-crm.js`, `frontend/admin-data-protection.js` |
| C08-006 | C08 | `frontend/admin-email-logs.html`, `frontend/admin-email-logs.js`, `frontend/admin-email-review.html`, `frontend/admin-email-review.js` |
| C08-007 | C08 | `frontend/admin-equipment-maintenance.js`, `frontend/admin-equipment-reminders.js`, `frontend/admin-expenses.html`, `frontend/admin-expenses.js` |
| C08-008 | C08 | `frontend/admin-inventory-count.js`, `frontend/admin-inventory.html`, `frontend/admin-inventory.js`, `frontend/admin-keys.html` |
| C08-009 | C08 | `frontend/admin-keys.js`, `frontend/admin-live-map.html`, `frontend/admin-live-map.js`, `frontend/admin-login.html` |
| C08-010 | C08 | `frontend/admin-login.js`, `frontend/admin-logout.js`, `frontend/admin-maintenance-billing.js`, `frontend/admin-map.html` |
| C08-011 | C08 | `frontend/admin-map.js`, `frontend/admin-master-control.html`, `frontend/admin-master-control.js`, `frontend/admin-menu.html` |
| C08-012 | C08 | `frontend/admin-menu.js`, `frontend/admin-notifications.html`, `frontend/admin-notifications.js`, `frontend/admin-onboarding.html` |
| C08-013 | C08 | `frontend/admin-onboarding.js`, `frontend/admin-operational-flow.html`, `frontend/admin-operational-flow.js`, `frontend/admin-operational-settings.html` |
| C08-014 | C08 | `frontend/admin-operational-settings.js`, `frontend/admin-payment-settings.html`, `frontend/admin-payment-settings.js`, `frontend/admin-payments.html` |
| C08-015 | C08 | `frontend/admin-payments.js`, `frontend/admin-pool-calculator.html`, `frontend/admin-pool-calculator.js`, `frontend/admin-pool-technical.html` |
| C08-016 | C08 | `frontend/admin-pool-technical.js`, `frontend/admin-pools.html`, `frontend/admin-pools.js`, `frontend/admin-priority.html` |
| C08-017 | C08 | `frontend/admin-priority.js`, `frontend/admin-revenue.html`, `frontend/admin-revenue.js`, `frontend/admin-security.html` |
| C08-018 | C08 | `frontend/admin-security.js`, `frontend/admin-service-log.html`, `frontend/admin-service-log.js`, `frontend/admin-suppliers.html` |
| C08-019 | C08 | `frontend/admin-suppliers.js`, `frontend/admin-technicians.html`, `frontend/admin-technicians.js`, `frontend/admin-test-center.html` |
| C08-020 | C08 | `frontend/admin-test-center.js`, `frontend/admin-today.html`, `frontend/admin-today.js`, `frontend/admin-ui-settings.html` |
| C08-021 | C08 | `frontend/admin-ui-settings.js`, `frontend/admin-vehicles.html`, `frontend/admin-vehicles.js`, `frontend/alerts-financial.html` |
| C08-022 | C08 | `frontend/alerts.html`, `frontend/billing-center.html`, `frontend/billing-center.js`, `frontend/billing-extras.html` |
| C08-023 | C08 | `frontend/billing-history.html`, `frontend/billing-history.js`, `frontend/billing.html`, `frontend/billing.js` |
| C08-024 | C08 | `frontend/chat.html`, `frontend/chat.js`, `frontend/communications.html`, `frontend/communications.js` |
| C08-025 | C08 | `frontend/config-notifications.html`, `frontend/cristal-assist.js`, `frontend/cristal-help-data.js`, `frontend/crystal-os-v2-nav.js` |
| C08-026 | C08 | `frontend/crystal-os-v2-shell.js`, `frontend/cw-admin-catalogue-copy.js`, `frontend/cw-admin-catalogue.js`, `frontend/cw-admin-day-copy.js` |
| C08-027 | C08 | `frontend/cw-admin-day-rules.js`, `frontend/cw-admin-incomplete.js`, `frontend/cw-admin-legacy-entry.js`, `frontend/cw-admin-map.js` |
| C08-028 | C08 | `frontend/cw-admin-premium-controls.js`, `frontend/cw-admin-read.js`, `frontend/cw-admin-shortcuts.js`, `frontend/cw-appearance-copy.js` |
| C08-029 | C08 | `frontend/cw-auth-download.js`, `frontend/cw-auth.js`, `frontend/cw-block2-shell.js`, `frontend/cw-browser-push.js` |
| C08-030 | C08 | `frontend/cw-collection-summary-copy.js`, `frontend/cw-collection-summary-rules.js`, `frontend/cw-company-closure-rules.js`, `frontend/cw-component-system.js` |
| C08-031 | C08 | `frontend/cw-contract-activation.js`, `frontend/cw-email-history-copy.js`, `frontend/cw-email-history-rules.js`, `frontend/cw-enterprise-sidebar.js` |
| C08-032 | C08 | `frontend/cw-equipment-history-rules.js`, `frontend/cw-equipment-material-review-rules.js`, `frontend/cw-equipment-time-review-rules.js`, `frontend/cw-execution-values.js` |
| C08-033 | C08 | `frontend/cw-expense-cost-period.js`, `frontend/cw-expense-costs.js`, `frontend/cw-expense-labor-distribution.js`, `frontend/cw-expense-maintenance-labor.js` |
| C08-034 | C08 | `frontend/cw-expense-maintenance-material.js`, `frontend/cw-expense-maintenance.js`, `frontend/cw-expense-valuation.js`, `frontend/cw-extra-correction-products.js` |
| C08-035 | C08 | `frontend/cw-extra-history-copy.js`, `frontend/cw-extra-history-rules.js`, `frontend/cw-fleet-history-copy.js`, `frontend/cw-fleet-history-rules.js` |
| C08-036 | C08 | `frontend/cw-fleet-history.js`, `frontend/cw-fleet-management-copy.js`, `frontend/cw-fleet-management-rules.js`, `frontend/cw-fleet-management.js` |
| C08-037 | C08 | `frontend/cw-flow-shell.js`, `frontend/cw-i18n.js`, `frontend/cw-incomplete-workflow.js`, `frontend/cw-inventory-pending.js` |
| C08-038 | C08 | `frontend/cw-labor-composition-proof.js`, `frontend/cw-legacy-product-rules.js`, `frontend/cw-legacy-workday.js`, `frontend/cw-live-map-copy.js` |
| C08-039 | C08 | `frontend/cw-live-map-rules.js`, `frontend/cw-maintenance-material-rules.js`, `frontend/cw-monthly-email.js`, `frontend/cw-navigation-preferences.js` |
| C08-040 | C08 | `frontend/cw-notification-read.js`, `frontend/cw-notification-sound.js`, `frontend/cw-onboarding-copy.js`, `frontend/cw-onboarding-rules.js` |
| C08-041 | C08 | `frontend/cw-operational-risk-rules-copy.js`, `frontend/cw-operational-risk-rules-page.js`, `frontend/cw-operational-risk-rules.js`, `frontend/cw-operational-risk.js` |
| C08-042 | C08 | `frontend/cw-os-admin-shell.js`, `frontend/cw-payment-ledger-copy.js`, `frontend/cw-payment-ledger-rules.js`, `frontend/cw-payment-policy-copy.js` |
| C08-043 | C08 | `frontend/cw-payment-policy-rules.js`, `frontend/cw-pool-calculator-copy.js`, `frontend/cw-pool-calculator-drafts.js`, `frontend/cw-pool-calculator-rules.js` |
| C08-044 | C08 | `frontend/cw-pool-calculator-store.js`, `frontend/cw-pool-edit.js`, `frontend/cw-product-catalogue.js`, `frontend/cw-proposal-application.js` |
| C08-045 | C08 | `frontend/cw-proposal-editor.js`, `frontend/cw-proposal-requests.js`, `frontend/cw-pump-reminders.js`, `frontend/cw-push-session.js` |
| C08-046 | C08 | `frontend/cw-reminder-create.js`, `frontend/cw-reminder-delete.js`, `frontend/cw-reminder-labor-rules.js`, `frontend/cw-reminder-material-rules.js` |
| C08-047 | C08 | `frontend/cw-reminder-resource-rules.js`, `frontend/cw-repair-labor.js`, `frontend/cw-security-copy.js`, `frontend/cw-security-rules.js` |
| C08-048 | C08 | `frontend/cw-supplier-copy.js`, `frontend/cw-supplier-rules.js`, `frontend/cw-technical-sheet-edit.js`, `frontend/cw-technician-management-copy.js` |
| C08-049 | C08 | `frontend/cw-technician-management-rules.js`, `frontend/cw-transport-guide-copy.js`, `frontend/cw-transport-guide-create.js`, `frontend/cw-transport-guide-items.js` |
| C08-050 | C08 | `frontend/cw-transport-guide-manage.js`, `frontend/cw-transport-guide-rules.js`, `frontend/cw-transport-items-copy.js`, `frontend/cw-transport-items-rules.js` |
| C08-051 | C08 | `frontend/cw-transport-manage-copy.js`, `frontend/cw-transport-manage-rules.js`, `frontend/cw-ui-feedback.js`, `frontend/cw-vehicle-assignment-copy.js` |
| C08-052 | C08 | `frontend/cw-vehicle-assignment-rules.js`, `frontend/cw-vehicle-assignment.js`, `frontend/cw-vehicle-consumption-copy.js`, `frontend/cw-vehicle-consumption-rules.js` |
| C08-053 | C08 | `frontend/cw-vehicle-consumption.js`, `frontend/cw-vehicle-maintenance-copy.js`, `frontend/cw-vehicle-maintenance-rules.js`, `frontend/cw-vehicle-maintenance.js` |
| C08-054 | C08 | `frontend/cw-vehicle-stock-preset-copy.js`, `frontend/cw-vehicle-stock-preset-rules.js`, `frontend/cw-vehicle-stock-preset.js`, `frontend/cw-work-guide-close-copy.js` |
| C08-055 | C08 | `frontend/cw-work-guide-close-rules.js`, `frontend/cw-work-guide-close.js`, `frontend/cw-work-guide-start-copy.js`, `frontend/cw-work-guide-start-rules.js` |
| C08-056 | C08 | `frontend/cw-work-guide-start.js`, `frontend/equipment-history-review.html`, `frontend/equipment-material-review.html`, `frontend/equipment-material-review.js` |
| C08-057 | C08 | `frontend/equipment-time-review.html`, `frontend/help-center.html`, `frontend/help-center.js`, `frontend/js/push/push-init.js` |
| C08-058 | C08 | `frontend/js/push/push-realtime.js`, `frontend/js/pwa/install-prompt.js`, `frontend/js/theme.js`, `frontend/labor-cost-bases.html` |
| C08-059 | C08 | `frontend/labor-cost-bases.js`, `frontend/login.html`, `frontend/login.js`, `frontend/map.html` |
| C08-060 | C08 | `frontend/map.js`, `frontend/metrics.html`, `frontend/metrics.js`, `frontend/multi-map.html` |
| C08-061 | C08 | `frontend/multi-map.js`, `frontend/nav.js`, `frontend/notifications.html`, `frontend/notifications.js` |
| C08-062 | C08 | `frontend/operational-risk-rules.html`, `frontend/profit-map.html`, `frontend/profit-map.js`, `frontend/ranking.html` |
| C08-063 | C08 | `frontend/ranking.js`, `frontend/reminder-materials.html`, `frontend/reminder-materials.js`, `frontend/reminder-resources.html` |
| C08-064 | C08 | `frontend/reminder-resources.js`, `frontend/repair-execution.html`, `frontend/repair-execution.js`, `frontend/repair-work.html` |
| C08-065 | C08 | `frontend/repair-work.js`, `frontend/service-worker.js`, `frontend/settings.html`, `frontend/socketServer.js` |
| C08-066 | C08 | `frontend/splash.html`, `frontend/staff-chat-i18n.js`, `frontend/sw.js`, `frontend/technician-profit-dashboard.html` |
| C08-067 | C08 | `frontend/technician-profit.html`, `frontend/tests/test_extra.html`, `frontend/to-issue.html`, `frontend/to-issue.js` |
| C08-068 | C08 | `frontend/transport-guide-create.html`, `frontend/transport-guide-items.html`, `frontend/transport-guide-manage.html`, `frontend/ui/components/button.js` |
| C08-069 | C08 | `frontend/ui/components/card.js`, `frontend/ui/components/navbar.js`, `frontend/ui/components/status.js`, `frontend/ui/core/navigation-context.js` |
| C08-070 | C08 | `frontend/ui/core/ui-engine.js`, `frontend/ui/design-system.js`, `frontend/ui/state-adapter-v2.js`, `frontend/ui/views/demo.html` |
| C08-071 | C08 | `frontend/v26/admin-prototype.html`, `frontend/v26/index.html`, `frontend/v26/technician/index.html`, `frontend/vehicle-assignment.html` |
| C08-072 | C08 | `frontend/vehicle-consumption.html`, `frontend/vehicle-maintenance.html`, `frontend/vehicle-stock-preset.html`, `frontend/work-guide-close.html` |
| C08-073 | C08 | `frontend/work-guide-start.html`, `src/business/admin/AdminWeeklyPlanningBusiness.js`, `src/business/admin/AdministrationBusiness.js`, `src/business/admin/AlertBillingBusiness.js` |
| C08-074 | C08 | `src/business/admin/AlertListBusiness.js`, `src/business/admin/AlertResolutionBusiness.js`, `src/business/admin/DashboardMetricsBusiness.js`, `src/business/admin/DashboardSnapshotBusiness.js` |
| C08-075 | C08 | `src/business/admin/ReminderCompletionBusiness.js`, `src/business/admin/ReminderCreationBusiness.js`, `src/business/admin/ReminderDeletionBusiness.js`, `src/business/admin/ReminderListBusiness.js` |
| C08-076 | C08 | `src/business/api/businessApiRouter.js`, `src/business/api/realBusinessApiRouter.js`, `src/business/billing/BillingEntity.js`, `src/business/billing/BillingRepository.js` |
| C08-077 | C08 | `src/business/billing/BillingService.js`, `src/business/chat/InternalChatBusiness.js`, `src/business/chat/ResourceChatBusiness.js`, `src/business/client/ContractActivationBusiness.js` |
| C08-078 | C08 | `src/business/construction/ConstructionBusiness.js`, `src/business/core/BusinessBrainService.js`, `src/business/core/BusinessConfig.js`, `src/business/core/BusinessEngine.js` |
| C08-079 | C08 | `src/business/core/BusinessRegistry.js`, `src/business/database/BusinessDatabase.js`, `src/business/equipment/EquipmentMaintenanceBusiness.js`, `src/business/equipment/EquipmentMaintenanceReminderBusiness.js` |
| C08-080 | C08 | `src/business/equipment/MaintenanceBillingBusiness.js`, `src/business/finance/BillingCreditBusiness.js`, `src/business/finance/FinanceOsBusiness.js`, `src/business/finance/MonthlyAutomationBusiness.js` |
| C08-081 | C08 | `src/business/finance/MonthlyBillingBusiness.js`, `src/business/index.js`, `src/business/installation/InstallationBusiness.js`, `src/business/inventory/InventoryCatalogueBusiness.js` |
| C08-082 | C08 | `src/business/operations/EquipmentStockOsBusiness.js`, `src/business/operations/InventoryCountBusiness.js`, `src/business/operations/InventoryWriteBusiness.js`, `src/business/pool/PoolBusiness.js` |
| C08-083 | C08 | `src/business/pool/PoolCalculationBusiness.js`, `src/business/pool/PoolChatBusiness.js`, `src/business/pool/PoolChemistryBusiness.js`, `src/business/pool/PoolDashboardBusiness.js` |
| C08-084 | C08 | `src/business/pool/PoolEditBusiness.js`, `src/business/pool/PoolEquipmentBusiness.js`, `src/business/pool/PoolHistoryBusiness.js`, `src/business/pool/PoolMaintenanceBusiness.js` |
| C08-085 | C08 | `src/business/pool/PoolTechnicalSheetBusiness.js`, `src/business/pool/TechnicalProposalBusiness.js`, `src/business/pool/TechnicalProposalContract.js`, `src/business/pool/TechnicalProposalRequests.js` |
| C08-086 | C08 | `src/business/pools/PoolEntity.js`, `src/business/pools/PoolRepository.js`, `src/business/pools/PoolService.js`, `src/business/prisma/BusinessPrisma.js` |
| C08-087 | C08 | `src/business/prisma/PrismaModelInspector.js`, `src/business/real/RealPoolService.js`, `src/business/repair/CommercialQuoteBusiness.js`, `src/business/repair/QuotePortalBusiness.js` |
| C08-088 | C08 | `src/business/repair/RepairBusiness.js`, `src/business/storage/BusinessStorage.js`, `src/business/system/DataRetentionBusiness.js`, `src/business/technician/ChemicalDeliveryBusiness.js` |
| C08-089 | C08 | `src/business/tests/billingTest.js`, `src/business/tests/businessApiSmokeTest.js`, `src/business/tests/businessEngineTest.js`, `src/business/tests/businessFullTest.js` |
| C08-090 | C08 | `src/business/tests/databaseTest.js`, `src/business/tests/poolTest.js`, `src/business/tests/prismaHealthTest.js`, `src/business/tests/prismaModelInspectorTest.js` |
| C08-091 | C08 | `src/business/tests/realPoolTest.js`, `src/config/externalIntegrations.js`, `src/config/uploadPath.js`, `src/controllers/accessController.js` |
| C08-092 | C08 | `src/controllers/adminAiController.js`, `src/controllers/adminAuthController.js`, `src/controllers/adminEmailLogController.js`, `src/controllers/adminEmailRetryController.js` |
| C08-093 | C08 | `src/controllers/adminOnboardingController.js`, `src/controllers/adminPaymentController.js`, `src/controllers/administrationController.js`, `src/controllers/aiAdminController.js` |
| C08-094 | C08 | `src/controllers/aiController.js`, `src/controllers/aiOpsController.js`, `src/controllers/alertController.js`, `src/controllers/authController.js` |
| C08-095 | C08 | `src/controllers/billingController.js`, `src/controllers/chatController.js`, `src/controllers/communicationController.js`, `src/controllers/comunicationController.js` |
| C08-096 | C08 | `src/controllers/constructionController.js`, `src/controllers/dashboardController.js`, `src/controllers/dataRetentionController.js`, `src/controllers/emailController.js` |
| C08-097 | C08 | `src/controllers/enterpriseCrmController.js`, `src/controllers/equipmentMaintenanceController.js`, `src/controllers/equipmentStockOsController.js`, `src/controllers/financeOsController.js` |
| C08-098 | C08 | `src/controllers/fleetHistoryController.js`, `src/controllers/fleetManagementController.js`, `src/controllers/guideController.js`, `src/controllers/historyController.js` |
| C08-099 | C08 | `src/controllers/installationController.js`, `src/controllers/internalChatController.js`, `src/controllers/inventoryController.js`, `src/controllers/locationLogController.js` |
| C08-100 | C08 | `src/controllers/notificationController.js`, `src/controllers/notificationRuleController.js`, `src/controllers/operationalRiskRulesReviewController.js`, `src/controllers/paymentController.js` |
| C08-101 | C08 | `src/controllers/poolCalculationController.js`, `src/controllers/poolChatController.js`, `src/controllers/poolController.js`, `src/controllers/poolEquipmentController.js` |
| C08-102 | C08 | `src/controllers/quotePortalController.js`, `src/controllers/reminderController.js`, `src/controllers/repairController.js`, `src/controllers/repairExecutionController.js` |
| C08-103 | C08 | `src/controllers/repairWorkController.js`, `src/controllers/routeController.js`, `src/controllers/routeService.js`, `src/controllers/securityController.js` |
| C08-104 | C08 | `src/controllers/securityReviewController.js`, `src/controllers/serviceChatController.js`, `src/controllers/serviceController.js`, `src/controllers/statsController.js` |
| C08-105 | C08 | `src/controllers/supplierHubController.js`, `src/controllers/taskController.js`, `src/controllers/technicalHistoryController.js`, `src/controllers/todayController.js` |
| C08-106 | C08 | `src/controllers/transportGuideCreationController.js`, `src/controllers/transportGuideItemsController.js`, `src/controllers/transportGuideManageController.js`, `src/controllers/userController.js` |
| C08-107 | C08 | `src/controllers/vehicleAssignmentReviewController.js`, `src/controllers/vehicleConsumptionController.js`, `src/controllers/vehicleMaintenanceReviewController.js`, `src/controllers/vehicleStockPresetReviewController.js` |
| C08-108 | C08 | `src/controllers/whatsappController.js`, `src/controllers/workGuideCloseController.js`, `src/controllers/workGuideStartController.js`, `src/core/Kernel.js` |
| C08-109 | C08 | `src/core/audit/AuditTrail.js`, `src/core/config/KernelConfig.js`, `src/core/container/ServiceContainer.js`, `src/core/context/RequestContext.js` |
| C08-110 | C08 | `src/core/crystal/brain/CrystalBrainBase.js`, `src/core/crystal/context/CrystalContext.js`, `src/core/crystal/events/EventEngine.js`, `src/core/crystal/flow/CrystalFlow.js` |
| C08-111 | C08 | `src/core/crystal/index.js`, `src/core/crystal/permissions/PermissionGuardian.js`, `src/core/decision/decisionEngine.js`, `src/core/di/DependencyContainer.js` |
| C08-112 | C08 | `src/core/doctor/CrystalDoctor.js`, `src/core/entities/entityResolver.js`, `src/core/entity/Entity.js`, `src/core/errors/CrystalError.js` |
| C08-113 | C08 | `src/core/event/DomainEvent.js`, `src/core/event/EventBus.js`, `src/core/events/eventEngine.js`, `src/core/eventstore/EventStore.js` |
| C08-114 | C08 | `src/core/lifecycle/LifecycleManager.js`, `src/core/metrics/Metrics.js`, `src/core/monitor/RuntimeMonitor.js`, `src/core/permissions/PermissionEngine.js` |
| C08-115 | C08 | `src/core/queue/QueueEngine.js`, `src/core/registry/ModuleRegistry.js`, `src/core/repository/InMemoryRepository.js`, `src/core/runtime/KernelRuntime.js` |
| C08-116 | C08 | `src/core/runtime/RuntimeScheduler.js`, `src/core/scheduler/Scheduler.js`, `src/core/state/StateMachine.js`, `src/core/tests/eventBusProTest.js` |
| C08-117 | C08 | `src/core/tests/kernelRuntimeTest.js`, `src/core/tests/kernelSmokeTest.js`, `src/core/timeclock/timeClockEngine.js`, `src/core/usecases/openPoolCase.js` |
| C08-118 | C08 | `src/core/validation/Validator.js`, `src/core/worker/WorkerEngine.js`, `src/core/worker/WorkerPool.js`, `src/core/workflows/workflowEngine.js` |
| C08-119 | C08 | `src/dal/AdministrationRepository.js`, `src/dal/BaseRepository.js`, `src/dal/ConstructionRepository.js`, `src/dal/EquipmentStockRepository.js` |
| C08-120 | C08 | `src/dal/FinanceOsRepository.js`, `src/dal/InstallationRepository.js`, `src/dal/InventoryProductRepository.js`, `src/dal/PaymentRepository.js` |
| C08-121 | C08 | `src/dal/PoolRepository.js`, `src/dal/RepairRepository.js`, `src/dal/index.js`, `src/dal/test.js` |
| C08-122 | C08 | `src/db/connection.js`, `src/loadEnv.js`, `src/middleware/adminAuth.js`, `src/middleware/authz.js` |
| C08-123 | C08 | `src/middleware/currentUser.js`, `src/middlewares/adminAuth.js`, `src/middlewares/aiAdminAuth.js`, `src/middlewares/auditMiddleware.js` |
| C08-124 | C08 | `src/middlewares/authJwt.js`, `src/middlewares/authMiddleware.js`, `src/middlewares/errorHandlerMiddleware.js`, `src/middlewares/fieldGuideReads.js` |
| C08-125 | C08 | `src/middlewares/fieldVehicleScope.js`, `src/middlewares/legacyAdministrationAccess.js`, `src/platform/api/platformStatusRouter.js`, `src/platform/bootstrap.js` |
| C08-126 | C08 | `src/platform/cli/crystal.js`, `src/routes/accessRoutes.js`, `src/routes/adminAiRoutes.js`, `src/routes/adminAuthRoutes.js` |
| C08-127 | C08 | `src/routes/adminEmailLogRoutes.js`, `src/routes/adminEmailRetryRoutes.js`, `src/routes/adminPaymentRoutes.js`, `src/routes/administrationRoutes.js` |
| C08-128 | C08 | `src/routes/aiAdminRoutes.js`, `src/routes/aiOpsRoutes.js`, `src/routes/aiRoutes.js`, `src/routes/alertRoutes.js` |
| C08-129 | C08 | `src/routes/auth/auth.routes.js`, `src/routes/authRoutes.js`, `src/routes/billingRoutes.js`, `src/routes/browserPushRoutes.js` |
| C08-130 | C08 | `src/routes/chatRoutes.js`, `src/routes/communicationRoutes.js`, `src/routes/companyClosureRoutes.js`, `src/routes/companyExpenseRoutes.js` |
| C08-131 | C08 | `src/routes/comunicationRoutes.js`, `src/routes/constructionRoutes.js`, `src/routes/coreFlowRoutes.js`, `src/routes/creditRevenueRoutes.js` |
| C08-132 | C08 | `src/routes/dashboardRoutes.js`, `src/routes/emailRoutes.js`, `src/routes/enterpriseCrmRoutes.js`, `src/routes/equipmentMaintenanceRoutes.js` |
| C08-133 | C08 | `src/routes/equipmentStockOsRoutes.js`, `src/routes/extraRoutes.js`, `src/routes/financeOsRoutes.js`, `src/routes/fleetHistoryRoutes.js` |
| C08-134 | C08 | `src/routes/fleetManagementRoutes.js`, `src/routes/guideRoutes.js`, `src/routes/health/health.routes.js`, `src/routes/history.routes.js` |
| C08-135 | C08 | `src/routes/historyRoutes.js`, `src/routes/incidentRoutes.js`, `src/routes/installationRoutes.js`, `src/routes/internalChatRoutes.js` |
| C08-136 | C08 | `src/routes/inventoryRoutes.js`, `src/routes/keyRoutes.js`, `src/routes/laborCostCompositionRoutes.js`, `src/routes/locationLogRoutes.js` |
| C08-137 | C08 | `src/routes/map.html`, `src/routes/metricsRoutes.js`, `src/routes/monthlyRevenueRoutes.js`, `src/routes/notificationRoutes.js` |
| C08-138 | C08 | `src/routes/notificationRuleRoutes.js`, `src/routes/operationalFlowRoutes.js`, `src/routes/operationalRiskRoutes.js`, `src/routes/operationalRiskRulesReviewRoutes.js` |
| C08-139 | C08 | `src/routes/operationalStateRoutes.js`, `src/routes/paymentRoutes.js`, `src/routes/poolCalculationRoutes.js`, `src/routes/poolChatRoutes.js` |
| C08-140 | C08 | `src/routes/poolEquipmentRoutes.js`, `src/routes/poolRoutes.js`, `src/routes/refreshTokenRoutes.js`, `src/routes/reminderRoutes.js` |
| C08-141 | C08 | `src/routes/repairRoutes.js`, `src/routes/routeRoutes.js`, `src/routes/routeService.js`, `src/routes/routesRoutes.js` |
| C08-142 | C08 | `src/routes/searchRoutes.js`, `src/routes/securityRoutes.js`, `src/routes/serviceChatRoutes.js`, `src/routes/serviceRoutes.js` |
| C08-143 | C08 | `src/routes/settingsRoutes.js`, `src/routes/statsRoutes.js`, `src/routes/supplierHubRoutes.js`, `src/routes/systemRoutes.js` |
| C08-144 | C08 | `src/routes/taskRoutes.js`, `src/routes/technicalHistoryRoutes.js`, `src/routes/todayRoutes.js`, `src/routes/transportGuideCreationRoutes.js` |
| C08-145 | C08 | `src/routes/transportGuideItemsRoutes.js`, `src/routes/transportGuideManageRoutes.js`, `src/routes/userRoutes.js`, `src/routes/vehicleAssignmentReviewRoutes.js` |
| C08-146 | C08 | `src/routes/vehicleConsumptionRoutes.js`, `src/routes/vehicleMaintenanceReviewRoutes.js`, `src/routes/vehicleStockPresetReviewRoutes.js`, `src/routes/whatsappRoutes.js` |
| C08-147 | C08 | `src/routes/workGuideCloseRoutes.js`, `src/routes/workGuideStartRoutes.js`, `src/routes/zoneRoutes.js`, `src/scripts/seedCoordinates.js` |
| C08-148 | C08 | `src/server.js`, `src/services/accessControlPolicyService.js`, `src/services/adminAiService.js`, `src/services/adminAuthService.js` |
| C08-149 | C08 | `src/services/adminDayService.js`, `src/services/adminMonthlySummaryService.js`, `src/services/adminOnboardingService.js`, `src/services/adminPaymentLedgerService.js` |
| C08-150 | C08 | `src/services/administrationEventService.js`, `src/services/ai/agentRouter.js`, `src/services/ai/agents/adminAgent.js`, `src/services/ai/agents/chemistryAgent.js` |
| C08-151 | C08 | `src/services/ai/agents/financeAgent.js`, `src/services/ai/agents/routeAgent.js`, `src/services/ai/agents/stockAgent.js`, `src/services/ai/aiOrchestrator.js` |
| C08-152 | C08 | `src/services/ai/aiProvider.js`, `src/services/ai/context/businessContextService.js`, `src/services/ai/context/contextBuilder.js`, `src/services/ai/context/contextResolver.js` |
| C08-153 | C08 | `src/services/ai/context/historyContext.js`, `src/services/ai/context/liveBusinessContext.js`, `src/services/ai/context/poolContext.js`, `src/services/ai/context/poolContextService.js` |
| C08-154 | C08 | `src/services/ai/data/poolData.js`, `src/services/ai/followup/followupRules.js`, `src/services/ai/memory/memoryEngine.js`, `src/services/ai/memory/memoryManager.js` |
| C08-155 | C08 | `src/services/ai/memory/memoryService.js`, `src/services/ai/orchestratorRules.js`, `src/services/ai/providers/mockProvider.js`, `src/services/aiAdminActionService.js` |
| C08-156 | C08 | `src/services/aiAdminContextService.js`, `src/services/aiAdminLlmService.js`, `src/services/aiFinancialContextService.js`, `src/services/aiOperationalService.js` |
| C08-157 | C08 | `src/services/aiOpsService.js`, `src/services/aiOrchestrator.js`, `src/services/aiPredictiveService.js`, `src/services/aiProvider.js` |
| C08-158 | C08 | `src/services/alertPresentationService.js`, `src/services/alertResolutionStateService.js`, `src/services/alertService.js`, `src/services/assignmentEngine.js` |
| C08-159 | C08 | `src/services/autoActionService.js`, `src/services/autoBillingService.js`, `src/services/backupHealthService.js`, `src/services/browserPushService.js` |
| C08-160 | C08 | `src/services/chemicalAdviceService.js`, `src/services/collectionSummaryService.js`, `src/services/communicationService.js`, `src/services/companyClosureService.js` |
| C08-161 | C08 | `src/services/constructionEventService.js`, `src/services/credentialVaultService.js`, `src/services/creditNoteRevenueSourceService.js`, `src/services/creditRevenueData.js` |
| C08-162 | C08 | `src/services/creditRevenueService.js`, `src/services/cronService.js`, `src/services/currentNotificationScope.js`, `src/services/dailyServiceLogService.js` |
| C08-163 | C08 | `src/services/dashboardCacheService.js`, `src/services/dashboardService.js`, `src/services/databaseBackupService.js`, `src/services/databaseHealthService.js` |
| C08-164 | C08 | `src/services/dispatchAiService.js`, `src/services/dispatchEngineService.js`, `src/services/emailHistoryService.js`, `src/services/emailLogService.js` |
| C08-165 | C08 | `src/services/emailRetryService.js`, `src/services/emailService.js`, `src/services/equipmentHistoricalResourceSource.js`, `src/services/equipmentHistoryMaterialSource.js` |
| C08-166 | C08 | `src/services/equipmentHistoryService.js`, `src/services/equipmentMaintenanceCalendar.js`, `src/services/equipmentMaterialReviewJournal.js`, `src/services/equipmentMaterialReviewService.js` |
| C08-167 | C08 | `src/services/equipmentMaterialsService.js`, `src/services/equipmentStockEventService.js`, `src/services/equipmentTimeReviewService.js`, `src/services/equipmentWorkTimeService.js` |
| C08-168 | C08 | `src/services/expenseCostAllocationService.js`, `src/services/expenseCostPeriodService.js`, `src/services/expenseCostTargets.js`, `src/services/expenseLaborDistributionService.js` |
| C08-169 | C08 | `src/services/expenseLedgerRules.js`, `src/services/expenseLedgerService.js`, `src/services/expenseMaintenanceTargets.js`, `src/services/expenseRepairTargets.js` |
| C08-170 | C08 | `src/services/expenseSourceService.js`, `src/services/expenseValuationService.js`, `src/services/expenseValuationSources.js`, `src/services/extraHistoryService.js` |
| C08-171 | C08 | `src/services/fieldGuideReadService.js`, `src/services/fieldInternalAlertService.js`, `src/services/fieldPhotoRequestService.js`, `src/services/fieldStockRequestService.js` |
| C08-172 | C08 | `src/services/fieldWriteRequestService.js`, `src/services/financeOsEventService.js`, `src/services/financialCostCoverageService.js`, `src/services/financialMaintenanceRevenueService.js` |
| C08-173 | C08 | `src/services/financialRevenueCoverageService.js`, `src/services/fleetHistoryService.js`, `src/services/fleetManagementService.js`, `src/services/incidentEngine.js` |
| C08-174 | C08 | `src/services/incidentService.js`, `src/services/installationEventService.js`, `src/services/laborCostComponentService.js`, `src/services/laborCostCompositionIntegrity.js` |
| C08-175 | C08 | `src/services/laborCostCompositionService.js`, `src/services/languagePreferenceService.js`, `src/services/liveMapService.js`, `src/services/loggerService.js` |
| C08-176 | C08 | `src/services/maintenanceCostShareService.js`, `src/services/maintenanceLaborShareService.js`, `src/services/maintenanceMaterialShareService.js`, `src/services/monthlyEmailRetryService.js` |
| C08-177 | C08 | `src/services/monthlyEmailReviewService.js`, `src/services/monthlyFinancialProjection.js`, `src/services/monthlyRevenueData.js`, `src/services/monthlyRevenueService.js` |
| C08-178 | C08 | `src/services/notificationScopeService.js`, `src/services/notificationService.js`, `src/services/operationalRiskRulesReviewService.js`, `src/services/operationalRiskSummaryService.js` |
| C08-179 | C08 | `src/services/operationalStateEngine.js`, `src/services/paymentPolicyReviewService.js`, `src/services/paymentReminderService.js`, `src/services/paymentService.js` |
| C08-180 | C08 | `src/services/poolCalculationService.js`, `src/services/poolCalculatorWriteService.js`, `src/services/pushService.js`, `src/services/realtimeAccessService.js` |
| C08-181 | C08 | `src/services/recordedWorkTimeService.js`, `src/services/refreshTokenCleanupService.js`, `src/services/reminderLaborSourceService.js`, `src/services/reminderMaterialService.js` |
| C08-182 | C08 | `src/services/reminderRepeatService.js`, `src/services/reminderResourceService.js`, `src/services/reminderScopeService.js`, `src/services/repairEventService.js` |
| C08-183 | C08 | `src/services/repairExecutionCommandService.js`, `src/services/repairExecutionService.js`, `src/services/repairRevenueSourceService.js`, `src/services/repairWorkService.js` |
| C08-184 | C08 | `src/services/routeOptimizationEngine.js`, `src/services/routeOsEventService.js`, `src/services/routeService.js`, `src/services/scheduledBackupService.js` |
| C08-185 | C08 | `src/services/securityReviewService.js`, `src/services/serviceExecutionValuesService.js`, `src/services/stockPreparationService.js`, `src/services/supplierHubService.js` |
| C08-186 | C08 | `src/services/systemSettingService.js`, `src/services/transportGuideCreationService.js`, `src/services/transportGuideItemsService.js`, `src/services/transportGuideManageService.js` |
| C08-187 | C08 | `src/services/upgradePackageService.js`, `src/services/vehicleAssignmentReviewService.js`, `src/services/vehicleConsumptionService.js`, `src/services/vehicleMaintenanceReviewService.js` |
| C08-188 | C08 | `src/services/vehicleStockPresetReviewService.js`, `src/services/waterReminderService.js`, `src/services/whatsappService.js`, `src/services/workGuideCloseService.js` |
| C08-189 | C08 | `src/services/workGuideOpeningService.js`, `src/services/workGuideStartService.js`, `src/socket/socketServer.js`, `src/system/agents/AgentRegistry.js` |
| C08-190 | C08 | `src/system/agents/ArchitectAgent.js`, `src/system/agents/ChemistryAgent.js`, `src/system/agents/ConstructionAgent.js`, `src/system/agents/FinanceAgent.js` |
| C08-191 | C08 | `src/system/agents/PlanningAgent.js`, `src/system/agents/QAAgent.js`, `src/system/agents/SecurityAgent.js`, `src/system/api/brainApiRouter.js` |
| C08-192 | C08 | `src/system/architecture/BrainArchitecture.js`, `src/system/brain/CrystalBrain.js`, `src/system/cli/brainAsk.js`, `src/system/cli/brainStatus.js` |
| C08-193 | C08 | `src/system/config/brainConfig.js`, `src/system/health/BrainHealth.js`, `src/system/knowledge/BrainKnowledge.js`, `src/system/manager/AIManager.js` |
| C08-194 | C08 | `src/system/memory/BrainMemory.js`, `src/system/providers/GeminiProvider.js`, `src/system/providers/MockProvider.js`, `src/system/providers/OllamaProvider.js` |
| C08-195 | C08 | `src/system/providers/OpenAIProvider.js`, `src/system/providers/OpenRouterProvider.js`, `src/system/providers/ProviderRegistry.js`, `src/system/quality/BrainQuality.js` |
| C08-196 | C08 | `src/system/router/BrainRouter.js`, `src/system/security/BrainSecurity.js`, `src/system/tests/brainFullTest.js`, `src/tools/analyzer/crystalAnalyzer.js` |
| C08-197 | C08 | `src/tools/analyzer/crystalAnalyzerPro.js`, `src/utils/adminIdentity.js`, `src/utils/dailyRoutePagination.js`, `src/utils/jwtPrincipalGuard.js` |
| C08-198 | C08 | `src/utils/jwtSecret.js`, `src/utils/poolReadiness.js`, `src/utils/roles.js`, `src/utils/stockNormalizer.js` |
| C09-001 | C09 | `frontend/admin-client-rates.js`, `frontend/admin-client-services.js`, `frontend/admin-client-settings.html`, `frontend/admin-clients.html` |
| C09-002 | C09 | `frontend/admin-clients.js`, `frontend/admin-reports.html`, `frontend/admin-reports.js`, `frontend/client-auth-guard.js` |
| C09-003 | C09 | `frontend/client-dashboard.html`, `frontend/client-dashboard.js`, `frontend/client-history.html`, `frontend/client-history.js` |
| C09-004 | C09 | `frontend/client-login.html`, `frontend/client-login.js`, `frontend/client-logout.js`, `frontend/client-menu.html` |
| C09-005 | C09 | `frontend/client-notifications.html`, `frontend/client-notifications.js`, `frontend/client-payments.html`, `frontend/client-payments.js` |
| C09-006 | C09 | `frontend/client-portal.html`, `frontend/client-portal.js`, `frontend/client-quotes.js`, `frontend/client-wow.html` |
| C09-007 | C09 | `frontend/client-wow.js`, `frontend/client.html`, `frontend/client.js`, `frontend/client_chat.html` |
| C09-008 | C09 | `frontend/client_chat.js`, `frontend/client_tech.html`, `frontend/cw-client-chat-send.js`, `frontend/cw-client-closures.js` |
| C09-009 | C09 | `frontend/cw-client-documents.js`, `frontend/cw-client-edit.js`, `frontend/cw-client-monthly-reports.js`, `frontend/cw-client-portal-request.js` |
| C09-010 | C09 | `frontend/cw-client-receipt.js`, `frontend/cw-client-service-pricing.js`, `frontend/cw-client-technical-copy.js`, `frontend/cw-client-technical-rules.js` |
| C09-011 | C09 | `frontend/cw-field-document-copy.js`, `frontend/cw-field-documents.js`, `frontend/cw-field-problem-report.js`, `frontend/cw-report-download.js` |
| C09-012 | C09 | `frontend/cw-transport-documents-copy.js`, `frontend/cw-transport-documents-rules.js`, `frontend/cw-transport-guide-documents.js`, `frontend/cw-value-report.js` |
| C09-013 | C09 | `frontend/cw-visit-report-origin-rules.js`, `frontend/invoice-document.html`, `frontend/invoice-document.js`, `frontend/invoice-draft-classification.js` |
| C09-014 | C09 | `frontend/invoices.html`, `frontend/invoices.js`, `frontend/report-center.html`, `frontend/report-center.js` |
| C09-015 | C09 | `frontend/report-settings.html`, `frontend/report-settings.js`, `frontend/technician-new-client.html`, `frontend/technician-new-client.js` |
| C09-016 | C09 | `frontend/transport-guide-documents.html`, `frontend/v26/client-prototype.html`, `frontend/visit-report-review.html`, `frontend/visit-report-review.js` |
| C09-017 | C09 | `src/business/chat/ClientMessageBusiness.js`, `src/business/chat/LegacyClientChatBusiness.js`, `src/business/client/ClientBusiness.js`, `src/business/client/ClientEditBusiness.js` |
| C09-018 | C09 | `src/business/client/ClientMonthlyReportBusiness.js`, `src/business/clients/ClientEntity.js`, `src/business/clients/ClientRepository.js`, `src/business/clients/ClientService.js` |
| C09-019 | C09 | `src/business/engine/ClientBusinessEngine.js`, `src/business/finance/ClientRateBusiness.js`, `src/business/finance/ClientReceiptBusiness.js`, `src/business/finance/CoreInvoicePaymentBusiness.js` |
| C09-020 | C09 | `src/business/finance/InvoiceChatDeliveryBusiness.js`, `src/business/finance/InvoiceCreditNoteBusiness.js`, `src/business/finance/InvoiceDocumentAccessBusiness.js`, `src/business/finance/InvoiceGenerationBusiness.js` |
| C09-021 | C09 | `src/business/finance/InvoiceOutboundDeliveryBusiness.js`, `src/business/finance/InvoicePageGenerationBusiness.js`, `src/business/finance/ManualInvoiceReminderBusiness.js`, `src/business/portal/ClientDocumentBusiness.js` |
| C09-022 | C09 | `src/business/portal/ClientPortalRequestBusiness.js`, `src/business/prisma/ClientPrismaService.js`, `src/business/real/RealClientService.js`, `src/business/tests/clientBusinessEngineTest.js` |
| C09-023 | C09 | `src/business/tests/clientPrismaTest.js`, `src/business/tests/clientTest.js`, `src/business/tests/realClientTest.js`, `src/controllers/adminReportController.js` |
| C09-024 | C09 | `src/controllers/adminReportEmailController.js`, `src/controllers/adminReportsController.js`, `src/controllers/clientAuthController.js`, `src/controllers/clientChatController.js` |
| C09-025 | C09 | `src/controllers/clientController.js`, `src/controllers/clientMessageWriteController.js`, `src/controllers/clientPortalController.js`, `src/controllers/clientProfileController.js` |
| C09-026 | C09 | `src/controllers/clientRateController.js`, `src/controllers/clientReportController.js`, `src/controllers/clientReportPDFController.js`, `src/controllers/clientServiceController.js` |
| C09-027 | C09 | `src/controllers/invoiceController.js`, `src/controllers/invoiceGenerationController.js`, `src/controllers/invoicePageGenerationController.js`, `src/controllers/invoicePdfController.js` |
| C09-028 | C09 | `src/controllers/reportController.js`, `src/controllers/reportSettingController.js`, `src/controllers/reportVisitController.js`, `src/controllers/transportGuideDocumentController.js` |
| C09-029 | C09 | `src/dal/ClientRepository.js`, `src/dal/InvoiceRepository.js`, `src/prismaClient.js`, `src/routes/adminReportEmailRoutes.js` |
| C09-030 | C09 | `src/routes/adminReportRoutes.js`, `src/routes/adminReportsRoutes.js`, `src/routes/clientAuthRoutes.js`, `src/routes/clientChatRoutes.js` |
| C09-031 | C09 | `src/routes/clientMessageRoutes.js`, `src/routes/clientPortalRoutes.js`, `src/routes/clientProfileRoutes.js`, `src/routes/clientReportPDFRoutes.js` |
| C09-032 | C09 | `src/routes/clientReportRoutes.js`, `src/routes/clientRoutes.js`, `src/routes/customerRoutes.js`, `src/routes/documentRoutes.js` |
| C09-033 | C09 | `src/routes/invoicePdfRoutes.js`, `src/routes/invoiceRoutes.js`, `src/routes/reportRoutes.js`, `src/routes/reportSettingRoutes.js` |
| C09-034 | C09 | `src/routes/reportVisitRoutes.js`, `src/routes/transportGuideDocumentRoutes.js`, `src/scripts/hash-client-pins.js`, `src/services/ai/context/clientContextService.js` |
| C09-035 | C09 | `src/services/ai/data/clientData.js`, `src/services/cashReceiptReportService.js`, `src/services/clientChatAttachmentService.js`, `src/services/clientChatHistoryService.js` |
| C09-036 | C09 | `src/services/clientClosureService.js`, `src/services/clientCreditService.js`, `src/services/clientMonthlyReportDataService.js`, `src/services/clientReportSettingsDefaults.js` |
| C09-037 | C09 | `src/services/clientReportSettingsService.js`, `src/services/clientServicePlan.js`, `src/services/clientServicePricing.js`, `src/services/clientServiceScheduleService.js` |
| C09-038 | C09 | `src/services/clientTechnicalHistoryService.js`, `src/services/customerPortalService.js`, `src/services/documentPdfService.js`, `src/services/extraVisitReportProjection.js` |
| C09-039 | C09 | `src/services/fieldClientIntakeService.js`, `src/services/fieldProblemReportService.js`, `src/services/financialDocumentPdfService.js`, `src/services/guidePdfService.js` |
| C09-040 | C09 | `src/services/invoicePaymentRequestService.js`, `src/services/invoiceReminderPolicy.js`, `src/services/invoiceViewService.js`, `src/services/monthlyPrintableReportService.js` |
| C09-041 | C09 | `src/services/monthlyReportDeliveryService.js`, `src/services/monthlyReportEmailService.js`, `src/services/monthlyReportLanguage.js`, `src/services/monthlyReportMonth.js` |
| C09-042 | C09 | `src/services/operationalValueReportService.js`, `src/services/pdfReportService.js`, `src/services/repairInvoiceSourceService.js`, `src/services/reportEmailService.js` |
| C09-043 | C09 | `src/services/reportService.js`, `src/services/transportGuideDocumentFiles.js`, `src/services/transportGuideDocumentService.js`, `src/services/visitReportLanguage.js` |
| C09-044 | C09 | `src/services/visitReportOriginService.js`, `src/services/visitReportPdfFonts.js`, `src/services/visitReportPhotoService.js`, `src/services/visitReportService.js` |
| C09-045 | C09 | `src/system/agents/CustomerAgent.js`, `src/system/agents/DocumentationAgent.js`, `src/utils/clientPaymentReference.js`, `src/utils/clientReadScope.js` |

Prioridade: C06 página técnica antiga e fila de sincronização; C07 quatro dashboards/incidentes; C08 percursos ADMIN e componentes comuns; C09 cliente e relatórios, começando pelo DE recusado. O responsável de uma fonte partilhada coordena regressões dos restantes perfis. Não traduzir enums, UUIDs, recibos, notas, nomes ou valores de negócio para resolver uma linha do inventário.

## Como reproduzir e aceitar

Executar `node scripts/audit-language-inventory.js --check` para validar hashes/atribuições da fotografia publicada; `--write` volta a analisar as fontes e substitui os dois ficheiros. Chromium é necessário para DOMParser inerte; `CW_CHROMIUM_PATH` pode apontar para o executável instalado. Parser ESTree `rolldown/utils` vem do lockfile existente. Nenhum script da aplicação é executado no browser e todas as redes são abortadas.

O JSON conserva entrada/chave, origem/linha, tipo, estado, idiomas disponíveis, responsável e lote; dicionários e mapeamentos de formatação ficam separados. Linhas HTML são a primeira correspondência literal ou início do fragmento (identificado), não localização exata de nó. Textos concatenados, chaves calculadas, CSS generated content, emails externos e caminhos raros exigem inspeção de execução; não são alegados como totalmente descobertos. Mensagens do servidor são candidatos de fonte, incluindo erros internos; uma cadeia de execução deve provar quais chegam ao utilizador.

Cada lote executará apenas os estados aplicáveis: carregamento, dados, vazio, erro, acesso, offline, envio, conflito e recuperação; PT/EN/FR/ES/DE, preservação dos dados, reload/troca de identidade e 320/390/1440 quando houver UI. PDFs exigem fixtures e renderização. Referências literais em testes não contam como cobertura. C05 fecha o mapa e atribuições; C06–C09 só fecham após evidência dos percursos e resolução dos candidatos.
