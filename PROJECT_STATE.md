# Cristal Water — estado oficial de desenvolvimento

Atualizado: 2026-10-03 00:47 (Europe/Lisbon). Este ficheiro é o checkpoint operacional oficial. O GitHub é a fonte oficial do código. Ler este ficheiro antes das entradas históricas de `docs/product/CURRENT_WORK_CHECKPOINT.md`.

## Versão e referências

- Repositório: `ts7520305-svg/cristalwater`.
- Branch de desenvolvimento: `work/field-readiness-20260915-simulation`.
- Último commit de código validado localmente e publicado: `e3497a65789d8e962004f4f8633e603136030cde` (TASK546), árvore `2241293b6e37db93b5cea44b9feabef9f3ca0489`; SHA/árvore do GitHub conferidos após push. Aceitação integrada ainda pendente.
- HEAD auditado no início: `88a13d86fd7cee245eeade32053d017d378ed29f` (TASK538).
- Último commit com CI integrado concluído e log conferido: `31a6e548cdabfb236f95d7a8656d3becb73d48a2` (TASK541), run `37066631332`, job `111035975340`, success. TASK540 (`6cf781f`, run `37066186782`, job `111034430127`) também success: cada log confirma SHA, 387 grupos distintos/code0 e restauro de 128 tabelas/51 ficheiros com linhas e hashes iguais. TASK537–539 continuam aceites nos runs registados anteriormente.
- TASK542 (`b73a04c`, run `37073275970`), TASK543 (`bfe82be`, run `37074953256`, job `111062639350`), TASK544 (`e5b2075`, run `37075670653`, job `111064906269`) e TASK545 (`3e56fe3`, run `37076553416`, job `111067649288`) continuam `in_progress`; migrações, sintaxe e unitários/técnicos/browser passaram, suites integradas e restauros pendentes. TASK546 (`e3497a6`, run `37077034871`, job `111069139406`) está na preparação Prisma na consulta das00:20; nenhuma falha reportada, sem atribuir sucesso a etapas pendentes. Não transferir aceitação541 para542–546.
- `package.json`: 22.6.7. `CHANGELOG.md` histórico: V23.2.5; `frontend/VERSION.txt`: V22.6.5. São rótulos divergentes, não prova da versão instalada. Identificar releases pelo SHA até conciliação explícita.
- Branch padrão: `feature/technicians-v25`; diverge desta branch (3 commits exclusivos na padrão, 740 exclusivos na branch de trabalho no início). Não fazer merge automático; conferir os três commits antes da integração final.

## Funcionalidades existentes e evidência

O inventário de código inclui backend Express/Prisma, Admin, Técnico e Cliente; clientes/piscinas, visitas, rotas, equipamento, inventário, finanças, orçamentos, obras/instalações, documentos, notificações, relatórios e Crystal Kernel/Brain. Existência de módulos não equivale a aceitação em produção.

O plano de conclusão existente (`docs/product/COMPLETION_PLAN_20260928.md`) regista C01–C05 concluídas: validação operacional anterior, probes de volume/consistência e inventário de idiomas. C06 está em execução; C07–C32 permanecem abertas. Preservar as evidências por commit. TASK535–538 tratam mapa, estados da rota, idioma da ficha e isolamento da ficha ativa após troca de conta. A recuperação após reload não ficou resolvida pela TASK538.

## Alterações publicadas / tarefa em curso

Publicações desta retoma, todas na branch autorizada:

| TASK | Commit | Árvore | Action |
|---|---|---|---|
| 543 | `bfe82be5c6cb5d339ebb986e75ff9f2853b0315a` | `3aba14d16f1b2b53c2408c026a58b9c89b0fc98a` | `37074953256` |
| 544 | `e5b2075c7e0cbec01e459ad856158d54df318b7c` | `c8a5ee72a45b44d9bd8caa14aa8b27771555e37a` | `37075670653` |
| 545 | `3e56fe32b97b92a1742f965deda3a32e7cab851a` | `e79b8eff6558da1d40cb76ae7c93e96c1619e872` | `37076553416` |
| 546 | `e3497a65789d8e962004f4f8633e603136030cde` | `2241293b6e37db93b5cea44b9feabef9f3ca0489` | `37077034871` |

As entradas abaixo conservam o estado histórico no momento da publicação; o estado corrente de CI é o da secção Versão e referências.

- Checkpoint/documentação: commit `404e7145f19d68fa8b5331c4532814aed4825734`.
- TASK539 publicada: `c8c6a6f39624ffbfef2cc3bb3045e5bd28d7f378`, árvore `b85d91258935fbc4e518176a33fc61b35d4d8748`; run `37065691326` em execução. Memória da ficha usa principal validado pelo guard e ID da visita, só restaura após leitura autorizada. Não adota snapshots sem dono; preserva bytes inválidos num arquivo antes de guardar novo trabalho. Ficheiros/credenciais excluídos, refresh mantém edição. Cache v304 e quatro expectativas atualizadas; 10 ficheiros. 1 409 unitários/142 ficheiros, quatro técnicos, sintaxe e diff-check passaram.
- TASK540 publicada: `6cf781fd296091fb06fa755b1902e472e1b2818c`, árvore `08ff3a41627257e229870223c5380f7d1276caed`, run `37066186782` em execução. ensaio reproduzível com HTML real, `cw-auth`, guard, ficha e script de navegação; GETs/identidades são fixtures QA explícitas. Incluído no preflight browser existente (22 scripts em vez de 21). Não modifica backend/schema nem runner de 387 grupos.

- TASK541 publicada: `31a6e548cdabfb236f95d7a8656d3becb73d48a2`, árvore `6b0b77b045535f09732e79a605bd16c485bf304e`, [CI37066631332](https://github.com/ts7520305-svg/cristalwater/actions/runs/37066631332) em execução. `technician-new-client.html` agora declara o formulário gerido pelo seu rascunho existente. Antes, nav genérico atrasado substituía `clientName` por `Wrong previous account` na fase pageshow, embora o produtor próprio pudesse repintar depois. Ensaio real do HTML/auth/write-store/intake/navigation reproduziu a falha; o atributo resolve-a, conserva os 11 campos e bytes do rascunho, e edição normal altera apenas a nota. Cache v305 / quatro expectativas atualizados. Nenhuma alteração do fluxo de envio ou API.

- TASK542 publicada: `b73a04ce31c986cdd769cf4feb4c1eae4a08bb02`, árvore `47f766a49b2a2fa7bf1c06156512e2ec759934cb`, [CI37073275970](https://github.com/ts7520305-svg/cristalwater/actions/runs/37073275970) em execução. `technician-new-client` ganhou cópia própria PT/EN/FR/ES/DE para permissões, rascunho, envio, política, GPS, campos, placeholders e opções visíveis. O contrato de dados do write-store foi preservado: `poolType` continua a enviar/validar `Privada`, `Condomínio`, `Hotel`, `Jacuzzi`; payload, UUID/requestId, recibos, endpoints e schema não mudaram. O seletor global de idioma passa a ter destino local no cabeçalho da página.

## Testes realizados nesta sessão

- TASK547 / C06-011: ausência de tradução reproduzida com HTML/API/PostgreSQL reais (título ainda PT ao escolher EN). Página/modo route agora têm 35 entradas próprias PT/EN/FR/ES/DE; repintam textos, opções e erros por identidade nos mesmos nós. Nomes persistidos ficam literais, dia/técnico/ordem/destinos e endpoints são preservados. A comparação de sessão deste modo ignora somente `user.language`, porque o motor global guarda essa preferência na mesma conta; tokens/restantes propriedades continuam a invalidar. Outros modos não recebem o produtor de idioma.
- Gates547 até agora: 43 migrações aditivas existentes passaram na nova instância PostgreSQL16.11 local, apenas127.0.0.1:5547; nenhuma base/serviço existente alterado. Base `cristalwater_qa`, uploads `uploads/qa/local-20261003`, integrações externas/schedulers desativados. Configuração `.env.test` e dados/evidências em reports ignorados pelo Git; nenhum segredo de produção utilizado.
- Mapas Admin nativos passaram: lista sem fornecedor, coordenadas zero/inválidas/ausentes, nomes literais, seleção/âmbito/GPS tardio/conta e contrato Leaflet controlado; rota em cinco idiomas/três larguras, erro GPS e503 repintado, sem novas consultas por idioma nem escritas operacionais, snapshots SQL iguais. A única escrita permitida pela mudança de idioma é a preferência existente PUT/settings/language/me, com apenas `language`. Screenshot DE320 conferido. Mapa multi-técnico passou API/305 linhas/identidades/conta/timeout/Leaflet; API de agrupamento de zonas passou147 visitas/44 alertas, dados intactos.
- Seis fluxos SQL/API existentes aprovados: Visit OS, Route OS, Customer OS, Administration OS, Finance OS e Equipment/Stock OS. Evidência local `reports/qa/focused-20261003/results.json`; não substitui os387 grupos nem restauro integrado.
- Sintaxe completa695/308/45, oito JS alterados/diff-check, técnicos4/4 e preflight23/23 aprovados. Unitários1403/2 skipped/4 falhas Windows de backup idênticas, sem enfraquecer testes. Cache310/quatro expectativas atualizados; runner387/workflow/API/schema intactos.
- Preparações547: primeira extensão do teste selecionava o técnico sem coordenadas ausentes; corrigida para o técnicoA antes da reprodução válida. A primeira ligação do motor global invalidava a sessão pela propriedade language; corrigida apenas nesse modo e validada. Preferências PUT inicialmente entravam no contador de escritas operacionais; agora são registadas separadamente com payload validado. Ensaio SQL/browser de chat nativo falhou no `page.goto`/load8s, devido à fonte Google importada pelo CSS; continua por validar localmente, sem atribuir sucesso. Próxima548: tornar esse ensaio independente do fornecedor opcional e repetir os fluxos browser nativos.

- TASK546 / C06-006: reprodução com intake543–545 e store nativo dá prefixoEN/causaPT após mudança de idioma. A fixture concede o lock do formulário mas recusa o lock interno do store; o erro lockBusy é produzido pelo store real, antes de criar pedido/UUID ou enviar. Intake passa a conservar `error.copy` de fieldWriteError e a usar `CWFieldWriteStore.message(code, language)` existente na pintura, incluindo erros de refresh; nenhum novo dicionário nem alteração do store/persistência.
- Gates546: componente ficha/intake aprovado, incluindo causa nativa em cinco idiomas, erro literal preservado, rascunho/requestId intactos, fila vazia e zero escritas operacionais. Motor de idioma/browser offline/técnicos4/4 aprovados; sintaxe dos sete JS/diff-check aprovados. Unitários1403/2 skipped/4 falhas Windows idênticas. Preflight23/23 completo permanece evidência545; não foi repetido todo em546. Cache309 e quatro expectativas; runner387/workflow/backend/schema intactos.

- TASK545 / C06-011/012: observação do chat no código544 falhou ao exigir ocultação síncrona no evento de sessão. Ligado `cw:session-change` à rotina `sync` existente; sem novo mecanismo de sessão, idiomas, rascunhos ou chat. Regressão com HTML/auth/scripts reais e HTTP QA confirma Técnico/Chefe/Admin, mesmo principal, troca de conta, mensagens/notificações/campo/fila limpos, duas leituras nativas abortadas e os bytes dos dois rascunhos/pedidos preservados. Reload com a nova conta lê apenas o seu rascunho/pedido. Zero escritas operacionais.
- Preparação545: primeira verificação de abortos passou Técnico/Chefe mas observou cedo o Admin; passou a aguardar os dois eventos nativos requestfailed antes de libertar HTTP, com prazo10s. Não alterou assertions de privacidade nem comportamento do produto. Componente final passa nos três perfis.
- Gates545: preflight browser completo23/23 aprovado com Edge, incluindo os22 componentes anteriores em ordem; técnicos4/4; sintaxe dos sete JS e JSON/package/diff-check aprovados; unitários1403/2 skipped/4 falhas Windows de backup idênticas. Cache307→20261003-v308/quatro expectativas; runner integrado387/workflow intactos. Não foi preparado PostgreSQL local nem executado o grupo SQL existente de chat nesta máquina; a prova de componente não o substitui.

- TASK544: o componente no código543 falhou na asserção síncrona de campos vazios após `cw:session-change`. Intake agora reage a esse evento e processa invalidação antes do guard de busy; aumenta as gerações de leitura/GPS. Os dois rascunhos ficam intactos e só a conta original recupera os seus campos. Cache306→307; APIs, schema, payload/UUID/recibos e store inalterados.
- Gates544: componente Edge passou limpeza síncrona idle/busy, eventos sessão/storage e callback GPS retido após sair/regressar; mantém cinco idiomas e zero escritas operacionais. Primeira extensão GPS usou IDs inexistentes e deu timeout; corrigida para os names nativos sem alterar assertions/prazo. Browser offline, entrada/Admin/Técnico/Cliente e componente de sessão passaram; técnicos4/4; `node --check` dos sete JS/diff-check passaram. `npm test`:1403 aprovados/2 skipped/4 falhas ambientais Windows idênticas. Sintaxe completa695/308/45 permanece evidência543; não foi repetida em544, que não altera backend.

- Retoma TASK543: pasta/remote/branch/HEAD local e remoto `f2831da` conferidos, sem alterações preexistentes. CI540/541 concluídos e logs nativos lidos pelo conector GitHub; API pública de download de logs respondeu403, sem impedir a leitura autenticada pelo conector.
- TASK543: reprodução browser no código542 confirma erro de envio ainda PT depois de selecionar EN. Primeira preparação usou uma expectativa PT incorreta e deu timeout; ajustada ao texto existente antes da reprodução válida. Correção conserva descritores dos erros próprios e prefixos até à pintura; erros externos continuam literais. Cache305→306 e quatro expectativas existentes atualizadas, sem mudar runner/387 grupos/22 preflights, contratos ou dados guardados.
- Gates TASK543: componente real de ficha/intake com Edge passou (cinco idiomas, 320/390/1440, rascunhos, erro próprio, erro literal e zero escritas operacionais); `test-field-browser.js` e `test-language-browser.js` passaram; técnicos4/4; `npm test`1403 aprovados/2 skipped/4 falhas Windows já conhecidas de backup (symlink/mode), em142 ficheiros. Sintaxe completa695/308/45 e `node --check` dos sete JS alterados passaram; diff-check aprovado.

- Checkout real, oito branches, commits recentes, duas PRs abertas e Actions consultados; estrutura, entrypoint, scripts, documentação e fontes da pendência revistos. Esta revisão não certifica cada funcionalidade ou todos os ficheiros individualmente.
- Baseline: 1 395/1 396 testes passaram; um timeout de 5 s ao `git show` de fonte histórica num clone com blobs sob demanda. Repetição do ficheiro: 26/26, sem alterar prazo/asserts.
- Após correção local: 1 409 testes / 142 ficheiros passaram; 13 regressões novas de recuperação, conta, visita, corrupção, ficheiros/credenciais, refresh e compatibilidade genérica.
- Técnico: 4/4. Sintaxe: 695 JS backend, 308 JS frontend, 45 scripts inline. `git diff --check` aprovado.
- Chromium 153, componente inicial com o script real de navegação: reload, prontidão atrasada, duas contas, duas visitas, checkbox, refresh e bytes antigos passaram. A prontidão/identidade do componente é uma fixture; não alegar aceitação SQL/API deste ensaio.
- TASK540/541: HTML/formulário e scripts reais de auth/guard/ficha/navegação com GETs QA assinados; reload retido, PIN/USER com mesmo ID, duas visitas, refresh, GET403, ficheiro excluído, snapshots antigos da visita intactos e zero escritas passaram. A extensão541 confirma também rascunho nativo de intake e captura o estado após memória genérica antes de nova pintura. Fonte antiga da navegação faz o ensaio falhar na recuperação prematura. A preparação inicial apontou para porta3002; configurada a origem de API QA sem alterar produto.
- Download do Chromium do Playwright devolveu ZIP truncado na sessão anterior; utilizado Chromium já instalado em `/tmp/chromium`. Na retoma Windows usa-se Edge instalado; PostgreSQL local isolado preparado na TASK547. Suite387 completa/restauro local ainda não executados.

- Gates finais TASK541 no código publicado: 1 409/1 409 testes em 142 ficheiros; 4/4 técnicos; sintaxe695/308/45; componente Chromium com duas superfícies aprovado; `git diff --check` aprovado. O negativo do intake falha no nome da conta anterior e o positivo passa, mantendo bytes do rascunho próprio.
- Gates locais TASK542: `npm run check:syntax` aprovado (695 backend JS, 308 frontend JS, 45 inline scripts); `npm run test:technician` aprovado (4/4); `node scripts/test-visit-navigation-memory-browser.js` aprovado com Microsoft Edge instalado, cobrindo PT/EN/FR/ES/DE, larguras 320/390/1440, rascunho próprio, valores preservados e zero escritas operacionais; `git diff --check` aprovado.
- Preparação local TASK542: `npm ci` inicial ficou inconsistente por TLS (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`); repetido com `npm ci --strict-ssl=false` e integridade do lockfile, seguido de `npm run prisma:generate` com TLS relaxado só nessa execução por necessidade de descarregar o engine Prisma. `npm ci` reportou 3 vulnerabilidades high existentes; não foi executado `npm audit fix`.
- `npm test` após `prisma:generate`: 140/142 ficheiros e 1 403/1 409 testes passaram. Restam 4 falhas ambientais Windows em testes de backup: duas por `EPERM` ao criar symlink e duas por modo de ficheiro esperado `0600` mas recebido `0666` (`438`). Não há falhas do intake/idioma nesta suite.

## Erros conhecidos e limites

- Memória sem titular na ficha: TASK539 publicada e CI concluído com success; manter a evidência por SHA e não extrapolar para isolamento global.
- Outras páginas ainda usam memória genérica por pathname; não declarar isolamento global por uma correção desta ficha.
- CI540/541 success, com logs e restauro conferidos; CI542–546 pendentes. Exigir resultado/log/restauro do SHA respetivo antes de aceitação integrada.
- Inventário C06–C10 e C14 ainda aberto, incluindo idiomas/PDF, política de datas e acesso a anexos legados.
- Dados reais, fornecedores externos, IA no equipamento alvo, backup externo, VPS e pilotos dependem das condições C15–C32; CI não substitui essas provas.

## Decisões importantes

- Continuar o código existente; não duplicar módulos, não reiniciar o projeto e não marcar concluído apenas pela presença de código.
- A instrução atual do utilizador autoriza testes, commits e continuação automática; prevalece sobre as pausas de aprovação por TASK das regras antigas. Manter lotes pequenos e compatibilidade dos perfis.
- Trabalhar na branch existente; sem merge ou deploy neste lote. Não enviar mensagens a clientes.
- Contrato jurídico anual continua adiado. A app marca faturação externa/número/checklist; não emite faturas fiscais por iniciativa desta correção.
- Repositório público durante desenvolvimento; conversão a privado antes da aceitação final conforme plano existente.

## PRÓXIMA TAREFA EXATA

TASK548: conferir conclusão/logs/restauro de CI542–547 e corrigir falhas reais primeiro. Validar o ensaio SQL/browser de chat existente sem dependência da fonte Google opcional: reproduzir/bloquear só recursos externos no contexto QA, mantendo API/SQL/assertions/prazos originais, depois repetir chat e E2E dos três perfis na instância isolada. Não considerar prova de componente como aceitação SQL. Sem falhas, continuar C06-012/GPS na página existente em cinco idiomas/três larguras, conferindo commits novos antes de editar. C06 permanece aberta.

Outras páginas ainda usam memória genérica; o intake usa rascunho próprio e a ficha usa memória isolada. Não alegar isolamento global. O runner integrado conserva 387 grupos; preflight browser tem 23 scripts.

Integração futura: os três commits exclusivos da branch padrão alteram apenas `docs/product/BILLING_AUTOMATION_SPEC.md` (477 linhas), uma especificação marcada como não implementada. Ler a versão completa antes de conciliar requisitos de cobranças, IA preditiva e integridade de medidas/relatórios; não assumir que estão implementados nem apagar os commits.

## Ponto exato de paragem desta sessão

TASK547 implementada e em validação/publicação; SHA será registado depois do commit/push. CI540/541 e restauros conferidos; CI542–546 pendentes na consulta das00:45. Preflight23 scripts, runner387 grupos intacto. PostgreSQL QA local e backend3002 ativos somente para estes ensaios; não são produção. Próxima548 concreta acima. Sem merge/deploy/mensagens a clientes.
