# Cristal Water — estado oficial de desenvolvimento

Atualizado: 2026-10-02 22:25 (Europe/Lisbon). Este ficheiro é o checkpoint operacional oficial. O GitHub é a fonte oficial do código. Ler este ficheiro antes das entradas históricas de `docs/product/CURRENT_WORK_CHECKPOINT.md`.

## Versão e referências

- Repositório: `ts7520305-svg/cristalwater`.
- Branch de desenvolvimento: `work/field-readiness-20260915-simulation`.
- Último commit de código validado localmente: `31a6e548cdabfb236f95d7a8656d3becb73d48a2` (TASK541), árvore `6b0b77b045535f09732e79a605bd16c485bf304e`; checkout/árvore do GitHub conferidos, sem alterações locais após sincronização. Aceitação integrada ainda pendente.
- HEAD auditado no início: `88a13d86fd7cee245eeade32053d017d378ed29f` (TASK538).
- Último commit com CI integrado concluído consultado: `2e753fc16d48c03b25b4e46100abd02b7ac2aea4` (TASK536), run `37052996265`, success. A prova detalhada anterior consta do checkpoint: 387 grupos e restauro de 128 tabelas/51 ficheiros.
- TASK537 (`1c1a034`) / run `37058999793` e TASK538 / run `37063108313`: suite integrada ainda em execução na consulta desta sessão; etapas anteriores (migrações, sintaxe, unitários, técnico e browser) aprovadas. Não atribuir aceitação total a estes commits.
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

## Testes realizados nesta sessão

- Checkout real, oito branches, commits recentes, duas PRs abertas e Actions consultados; estrutura, entrypoint, scripts, documentação e fontes da pendência revistos. Esta revisão não certifica cada funcionalidade ou todos os ficheiros individualmente.
- Baseline: 1 395/1 396 testes passaram; um timeout de 5 s ao `git show` de fonte histórica num clone com blobs sob demanda. Repetição do ficheiro: 26/26, sem alterar prazo/asserts.
- Após correção local: 1 409 testes / 142 ficheiros passaram; 13 regressões novas de recuperação, conta, visita, corrupção, ficheiros/credenciais, refresh e compatibilidade genérica.
- Técnico: 4/4. Sintaxe: 695 JS backend, 308 JS frontend, 45 scripts inline. `git diff --check` aprovado.
- Chromium 153, componente inicial com o script real de navegação: reload, prontidão atrasada, duas contas, duas visitas, checkbox, refresh e bytes antigos passaram. A prontidão/identidade do componente é uma fixture; não alegar aceitação SQL/API deste ensaio.
- TASK540/541: HTML/formulário e scripts reais de auth/guard/ficha/navegação com GETs QA assinados; reload retido, PIN/USER com mesmo ID, duas visitas, refresh, GET403, ficheiro excluído, snapshots antigos da visita intactos e zero escritas passaram. A extensão541 confirma também rascunho nativo de intake e captura o estado após memória genérica antes de nova pintura. Fonte antiga da navegação faz o ensaio falhar na recuperação prematura. A preparação inicial apontou para porta3002; configurada a origem de API QA sem alterar produto.
- Download do Chromium do Playwright devolveu ZIP truncado; utilizado Chromium já instalado em `/tmp/chromium`. PostgreSQL local e integração completa ainda não preparados nesta sessão.

- Gates finais TASK541 no código publicado: 1 409/1 409 testes em 142 ficheiros; 4/4 técnicos; sintaxe695/308/45; componente Chromium com duas superfícies aprovado; `git diff --check` aprovado. O negativo do intake falha no nome da conta anterior e o positivo passa, mantendo bytes do rascunho próprio.

## Erros conhecidos e limites

- Memória sem titular na ficha: TASK539 publicada, validação integrada pendente.
- Outras páginas ainda usam memória genérica por pathname; não declarar isolamento global por uma correção desta ficha.
- CI537–541 pendentes; verificar estado final e diagnosticar qualquer falha antes de aceitar.
- Inventário C06–C10 e C14 ainda aberto, incluindo idiomas/PDF, política de datas e acesso a anexos legados.
- Dados reais, fornecedores externos, IA no equipamento alvo, backup externo, VPS e pilotos dependem das condições C15–C32; CI não substitui essas provas.

## Decisões importantes

- Continuar o código existente; não duplicar módulos, não reiniciar o projeto e não marcar concluído apenas pela presença de código.
- A instrução atual do utilizador autoriza testes, commits e continuação automática; prevalece sobre as pausas de aprovação por TASK das regras antigas. Manter lotes pequenos e compatibilidade dos perfis.
- Trabalhar na branch existente; sem merge ou deploy neste lote. Não enviar mensagens a clientes.
- Contrato jurídico anual continua adiado. A app marca faturação externa/número/checklist; não emite faturas fiscais por iniciativa desta correção.
- Repositório público durante desenvolvimento; conversão a privado antes da aceitação final conforme plano existente.

## PRÓXIMA TAREFA EXATA

TASK541 publicada, checkout limpo e gates locais finais aprovados. Na retoma seguinte, obter resultado e logs finais de CI537–541, priorizar qualquer falha real e não herdar aceitação de um commit anterior. Sem falhas, TASK542 / C06: observar `technician-new-client` com os cinco idiomas e confrontar os textos próprios de permissões/rascunho/envio/GPS em `technician-new-client.js` com o inventário. Só traduzir lacunas efetivamente presentes, conservando o contrato do write-store, valores, UUID e recibos. Antes de editar, conferir que a própria fonte ainda corresponde a este SHA e se outro commit já tratou a lacuna.

Outras páginas ainda usam memória genérica; o intake usa rascunho próprio e a ficha usa memória isolada. Não alegar isolamento global. O runner integrado conserva 387 grupos; preflight browser tem 22 scripts.

Integração futura: os três commits exclusivos da branch padrão alteram apenas `docs/product/BILLING_AUTOMATION_SPEC.md` (477 linhas), uma especificação marcada como não implementada. Ler a versão completa antes de conciliar requisitos de cobranças, IA preditiva e integridade de medidas/relatórios; não assumir que estão implementados nem apagar os commits.

## Ponto exato de paragem desta sessão

Três TASKs de implementação/regressão publicadas sequencialmente (539,540,541), além do checkpoint inicial. Não há alterações de código por publicar. Runs537–541 continuam em execução na consulta das22:25; não há resultado final nem restauro destas versões aceite nesta sessão. A próxima ação é a leitura dessas Actions, seguida da TASK542 acima. Este commit documental não altera código e usa `[skip ci]` para não repetir uma suite longa apenas por atualizar o checkpoint.
