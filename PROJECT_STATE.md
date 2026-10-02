# Cristal Water — estado oficial de desenvolvimento

Atualizado: 2026-10-02 23:35 (Europe/Lisbon). Este ficheiro é o checkpoint operacional oficial. O GitHub é a fonte oficial do código. Ler este ficheiro antes das entradas históricas de `docs/product/CURRENT_WORK_CHECKPOINT.md`.

## Versão e referências

- Repositório: `ts7520305-svg/cristalwater`.
- Branch de desenvolvimento: `work/field-readiness-20260915-simulation`.
- Último commit de código validado localmente e publicado: `b73a04ce31c986cdd769cf4feb4c1eae4a08bb02` (TASK542), árvore `47f766a49b2a2fa7bf1c06156512e2ec759934cb`; checkout/árvore do GitHub conferidos após push. Aceitação integrada ainda pendente.
- HEAD auditado no início: `88a13d86fd7cee245eeade32053d017d378ed29f` (TASK538).
- Último commit com CI integrado concluído consultado: `c8c6a6f39624ffbfef2cc3bb3045e5bd28d7f378` (TASK539), run `37065691326`, success. TASK537 (`1c1a034`, run `37058999793`) e TASK538 (`88a13d8`, run `37063108313`) também concluíram com success nesta consulta.
- TASK540 (`6cf781f`, run `37066186782`), TASK541 (`31a6e54`, run `37066631332`) e TASK542 (`b73a04c`, run `37073275970`) continuam `in_progress` na consulta pós-push desta sessão. Não atribuir aceitação total a estes commits.
- `package.json`: 22.6.7. `CHANGELOG.md` histórico: V23.2.5; `frontend/VERSION.txt`: V22.6.5. São rótulos divergentes, não prova da versão instalada. Identificar releases pelo SHA até conciliação explícita.
- Branch padrão: `feature/technicians-v25`; diverge desta branch (3 commits exclusivos na padrão, 740 exclusivos na branch de trabalho no início). Não fazer merge automático; conferir os três commits antes da integração final.

## Funcionalidades existentes e evidência

O inventário de código inclui backend Express/Prisma, Admin, Técnico e Cliente; clientes/piscinas, visitas, rotas, equipamento, inventário, finanças, orçamentos, obras/instalações, documentos, notificações, relatórios e Crystal Kernel/Brain. Existência de módulos não equivale a aceitação em produção.

O plano de conclusão existente (`docs/product/COMPLETION_PLAN_20260928.md`) regista C01–C05 concluídas: validação operacional anterior, probes de volume/consistência e inventário de idiomas. C06 está em execução; C07–C32 permanecem abertas. Preservar as evidências por commit. TASK535–538 tratam mapa, estados da rota, idioma da ficha e isolamento da ficha ativa após troca de conta. A recuperação após reload não ficou resolvida pela TASK538.

## Alterações publicadas / tarefa em curso

- Checkpoint/documentação: commit `404e7145f19d68fa8b5331c4532814aed4825734`.
- TASK539 publicada: `c8c6a6f39624ffbfef2cc3bb3045e5bd28d7f378`, árvore `b85d91258935fbc4e518176a33fc61b35d4d8748`; run `37065691326` em execução. Memória da ficha usa principal validado pelo guard e ID da visita, só restaura após leitura autorizada. Não adota snapshots sem dono; preserva bytes inválidos num arquivo antes de guardar novo trabalho. Ficheiros/credenciais excluídos, refresh mantém edição. Cache v304 e quatro expectativas atualizadas; 10 ficheiros. 1 409 unitários/142 ficheiros, quatro técnicos, sintaxe e diff-check passaram.
- TASK540 publicada: `6cf781fd296091fb06fa755b1902e472e1b2818c`, árvore `08ff3a41627257e229870223c5380f7d1276caed`, run `37066186782` em execução. ensaio reproduzível com HTML real, `cw-auth`, guard, ficha e script de navegação; GETs/identidades são fixtures QA explícitas. Incluído no preflight browser existente (22 scripts em vez de 21). Não modifica backend/schema nem runner de 387 grupos.

- TASK541 publicada: `31a6e548cdabfb236f95d7a8656d3becb73d48a2`, árvore `6b0b77b045535f09732e79a605bd16c485bf304e`, [CI37066631332](https://github.com/ts7520305-svg/cristalwater/actions/runs/37066631332) em execução. `technician-new-client.html` agora declara o formulário gerido pelo seu rascunho existente. Antes, nav genérico atrasado substituía `clientName` por `Wrong previous account` na fase pageshow, embora o produtor próprio pudesse repintar depois. Ensaio real do HTML/auth/write-store/intake/navigation reproduziu a falha; o atributo resolve-a, conserva os 11 campos e bytes do rascunho, e edição normal altera apenas a nota. Cache v305 / quatro expectativas atualizados. Nenhuma alteração do fluxo de envio ou API.

- TASK542 publicada: `b73a04ce31c986cdd769cf4feb4c1eae4a08bb02`, árvore `47f766a49b2a2fa7bf1c06156512e2ec759934cb`, [CI37073275970](https://github.com/ts7520305-svg/cristalwater/actions/runs/37073275970) em execução. `technician-new-client` ganhou cópia própria PT/EN/FR/ES/DE para permissões, rascunho, envio, política, GPS, campos, placeholders e opções visíveis. O contrato de dados do write-store foi preservado: `poolType` continua a enviar/validar `Privada`, `Condomínio`, `Hotel`, `Jacuzzi`; payload, UUID/requestId, recibos, endpoints e schema não mudaram. O seletor global de idioma passa a ter destino local no cabeçalho da página.

## Testes realizados nesta sessão

- Checkout real, oito branches, commits recentes, duas PRs abertas e Actions consultados; estrutura, entrypoint, scripts, documentação e fontes da pendência revistos. Esta revisão não certifica cada funcionalidade ou todos os ficheiros individualmente.
- Baseline: 1 395/1 396 testes passaram; um timeout de 5 s ao `git show` de fonte histórica num clone com blobs sob demanda. Repetição do ficheiro: 26/26, sem alterar prazo/asserts.
- Após correção local: 1 409 testes / 142 ficheiros passaram; 13 regressões novas de recuperação, conta, visita, corrupção, ficheiros/credenciais, refresh e compatibilidade genérica.
- Técnico: 4/4. Sintaxe: 695 JS backend, 308 JS frontend, 45 scripts inline. `git diff --check` aprovado.
- Chromium 153, componente inicial com o script real de navegação: reload, prontidão atrasada, duas contas, duas visitas, checkbox, refresh e bytes antigos passaram. A prontidão/identidade do componente é uma fixture; não alegar aceitação SQL/API deste ensaio.
- TASK540/541: HTML/formulário e scripts reais de auth/guard/ficha/navegação com GETs QA assinados; reload retido, PIN/USER com mesmo ID, duas visitas, refresh, GET403, ficheiro excluído, snapshots antigos da visita intactos e zero escritas passaram. A extensão541 confirma também rascunho nativo de intake e captura o estado após memória genérica antes de nova pintura. Fonte antiga da navegação faz o ensaio falhar na recuperação prematura. A preparação inicial apontou para porta3002; configurada a origem de API QA sem alterar produto.
- Download do Chromium do Playwright devolveu ZIP truncado; utilizado Chromium já instalado em `/tmp/chromium`. PostgreSQL local e integração completa ainda não preparados nesta sessão.

- Gates finais TASK541 no código publicado: 1 409/1 409 testes em 142 ficheiros; 4/4 técnicos; sintaxe695/308/45; componente Chromium com duas superfícies aprovado; `git diff --check` aprovado. O negativo do intake falha no nome da conta anterior e o positivo passa, mantendo bytes do rascunho próprio.
- Gates locais TASK542: `npm run check:syntax` aprovado (695 backend JS, 308 frontend JS, 45 inline scripts); `npm run test:technician` aprovado (4/4); `node scripts/test-visit-navigation-memory-browser.js` aprovado com Microsoft Edge instalado, cobrindo PT/EN/FR/ES/DE, larguras 320/390/1440, rascunho próprio, valores preservados e zero escritas operacionais; `git diff --check` aprovado.
- Preparação local TASK542: `npm ci` inicial ficou inconsistente por TLS (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`); repetido com `npm ci --strict-ssl=false` e integridade do lockfile, seguido de `npm run prisma:generate` com TLS relaxado só nessa execução por necessidade de descarregar o engine Prisma. `npm ci` reportou 3 vulnerabilidades high existentes; não foi executado `npm audit fix`.
- `npm test` após `prisma:generate`: 140/142 ficheiros e 1 403/1 409 testes passaram. Restam 4 falhas ambientais Windows em testes de backup: duas por `EPERM` ao criar symlink e duas por modo de ficheiro esperado `0600` mas recebido `0666` (`438`). Não há falhas do intake/idioma nesta suite.

## Erros conhecidos e limites

- Memória sem titular na ficha: TASK539 publicada e CI concluído com success; manter a evidência por SHA e não extrapolar para isolamento global.
- Outras páginas ainda usam memória genérica por pathname; não declarar isolamento global por uma correção desta ficha.
- CI540–542 pendentes; verificar estado final e diagnosticar qualquer falha antes de aceitar. CI537–539 concluíram com success nesta consulta.
- Inventário C06–C10 e C14 ainda aberto, incluindo idiomas/PDF, política de datas e acesso a anexos legados.
- Dados reais, fornecedores externos, IA no equipamento alvo, backup externo, VPS e pilotos dependem das condições C15–C32; CI não substitui essas provas.

## Decisões importantes

- Continuar o código existente; não duplicar módulos, não reiniciar o projeto e não marcar concluído apenas pela presença de código.
- A instrução atual do utilizador autoriza testes, commits e continuação automática; prevalece sobre as pausas de aprovação por TASK das regras antigas. Manter lotes pequenos e compatibilidade dos perfis.
- Trabalhar na branch existente; sem merge ou deploy neste lote. Não enviar mensagens a clientes.
- Contrato jurídico anual continua adiado. A app marca faturação externa/número/checklist; não emite faturas fiscais por iniciativa desta correção.
- Repositório público durante desenvolvimento; conversão a privado antes da aceitação final conforme plano existente.

## PRÓXIMA TAREFA EXATA

TASK542 publicada e validada localmente. Na retoma seguinte, obter resultado e logs finais de CI540–542, priorizar qualquer falha real e não herdar aceitação de um commit anterior. Sem falhas, continuar C06 pelas próximas páginas técnicas/rascunhos/idiomas restantes do inventário, verificando primeiro se outro commit já tratou a lacuna. Não declarar C06 concluída pela correção de `technician-new-client`.

Outras páginas ainda usam memória genérica; o intake usa rascunho próprio e a ficha usa memória isolada. Não alegar isolamento global. O runner integrado conserva 387 grupos; preflight browser tem 22 scripts.

Integração futura: os três commits exclusivos da branch padrão alteram apenas `docs/product/BILLING_AUTOMATION_SPEC.md` (477 linhas), uma especificação marcada como não implementada. Ler a versão completa antes de conciliar requisitos de cobranças, IA preditiva e integridade de medidas/relatórios; não assumir que estão implementados nem apagar os commits.

## Ponto exato de paragem desta sessão

Quatro TASKs de implementação/regressão publicadas sequencialmente (539,540,541,542), além dos checkpoints documentais. Não há alterações de código por publicar. Runs537–539 estão concluídos com success; runs540–542 continuam em execução na consulta das23:35; não há resultado final nem restauro destas versões aceite nesta sessão. A próxima ação é a leitura dessas Actions, seguida da próxima lacuna C06 do inventário. Este commit documental não altera código e usa `[skip ci]` para não repetir uma suite longa apenas por atualizar o checkpoint.
