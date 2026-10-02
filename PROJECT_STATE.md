# Cristal Water — estado oficial de desenvolvimento

Atualizado: 2026-10-02 (Europe/Lisbon). Este ficheiro é o checkpoint operacional oficial. O GitHub é a fonte oficial do código. Ler este ficheiro antes das entradas históricas de `docs/product/CURRENT_WORK_CHECKPOINT.md`.

## Versão e referências

- Repositório: `ts7520305-svg/cristalwater`.
- Branch de desenvolvimento: `work/field-readiness-20260915-simulation`.
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
- TASK540 em validação local: ensaio reproduzível com HTML real, `cw-auth`, guard, ficha e script de navegação; GETs/identidades são fixtures QA explícitas. Incluído no preflight browser existente (22 scripts em vez de 21). Não modifica backend/schema nem runner de 387 grupos.

## Testes realizados nesta sessão

- Checkout real, oito branches, commits recentes, duas PRs abertas e Actions consultados; estrutura, entrypoint, scripts, documentação e fontes da pendência revistos. Esta revisão não certifica cada funcionalidade ou todos os ficheiros individualmente.
- Baseline: 1 395/1 396 testes passaram; um timeout de 5 s ao `git show` de fonte histórica num clone com blobs sob demanda. Repetição do ficheiro: 26/26, sem alterar prazo/asserts.
- Após correção local: 1 409 testes / 142 ficheiros passaram; 13 regressões novas de recuperação, conta, visita, corrupção, ficheiros/credenciais, refresh e compatibilidade genérica.
- Técnico: 4/4. Sintaxe: 695 JS backend, 308 JS frontend, 45 scripts inline. `git diff --check` aprovado.
- Chromium 153, componente inicial com o script real de navegação: reload, prontidão atrasada, duas contas, duas visitas, checkbox, refresh e bytes antigos passaram. A prontidão/identidade do componente é uma fixture; não alegar aceitação SQL/API deste ensaio.
- TASK540: HTML/formulário e scripts reais de auth/guard/ficha/navegação com GETs QA assinados; reload retido, PIN/USER com mesmo ID, duas visitas, refresh, GET403, ficheiro excluído, snapshots antigos intactos e zero escritas passaram. Fonte antiga da navegação faz o ensaio falhar na recuperação prematura. A preparação inicial apontou para porta3002; configurada a origem de API QA sem alterar produto.
- Download do Chromium do Playwright devolveu ZIP truncado; utilizado Chromium já instalado em `/tmp/chromium`. PostgreSQL local e integração completa ainda não preparados nesta sessão.

## Erros conhecidos e limites

- Memória sem titular na ficha: TASK539 publicada, validação integrada pendente.
- Outras páginas ainda usam memória genérica por pathname; não declarar isolamento global por uma correção desta ficha.
- CI537/538 pendentes; verificar estado final e diagnosticar qualquer falha antes de aceitar.
- Inventário C06–C10 e C14 ainda aberto, incluindo idiomas/PDF, política de datas e acesso a anexos legados.
- Dados reais, fornecedores externos, IA no equipamento alvo, backup externo, VPS e pilotos dependem das condições C15–C32; CI não substitui essas provas.

## Decisões importantes

- Continuar o código existente; não duplicar módulos, não reiniciar o projeto e não marcar concluído apenas pela presença de código.
- A instrução atual do utilizador autoriza testes, commits e continuação automática; prevalece sobre as pausas de aprovação por TASK das regras antigas. Manter lotes pequenos e compatibilidade dos perfis.
- Trabalhar na branch existente; sem merge ou deploy neste lote. Não enviar mensagens a clientes.
- Contrato jurídico anual continua adiado. A app marca faturação externa/número/checklist; não emite faturas fiscais por iniciativa desta correção.
- Repositório público durante desenvolvimento; conversão a privado antes da aceitação final conforme plano existente.

## PRÓXIMA TAREFA EXATA

Finalizar/publicar TASK540, conferir SHA/árvore e Actions537–540. Se houver falha, ler o job e corrigir a primeira causa reproduzível. Depois continuar C06 pelo inventário `docs/product/LANGUAGE_INVENTORY_20260928.md` e checkpoint histórico, começando pela memória genérica das outras páginas técnicas que ainda não tem titular; verificar cada produtor/formulário gerido antes de alterar. Não declarar isolamento global por esta ficha.

Integração futura: os três commits exclusivos da branch padrão alteram apenas `docs/product/BILLING_AUTOMATION_SPEC.md` (477 linhas), uma especificação marcada como não implementada. Ler a versão completa antes de conciliar requisitos de cobranças, IA preditiva e integridade de medidas/relatórios; não assumir que estão implementados nem apagar os commits.
