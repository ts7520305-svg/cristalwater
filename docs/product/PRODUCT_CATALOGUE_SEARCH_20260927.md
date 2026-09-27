# Pesquisa de produtos nas guias — TASK384

Os formulários `/technician-field-mode` e `/technician` passam a pesquisar os materiais da guia por nome, unidade ou ID. A pesquisa ignora diferenças de maiúsculas e acentos para encontrar resultados; mantém os nomes, unidades e IDs originais na seleção e no pedido. `#123` procura exatamente esse ID. Pontuação é texto literal, sem expressões regulares.

## Listas completas e seleção estável

As opções são apresentadas em páginas de 25, com intervalo, total de resultados e número total de linhas da guia. Anteriores/Seguintes percorrem todos os resultados na ordem recebida. O número da linha refere-se à posição na guia, e o ID também aparece na opção. Linhas com nomes/unidades iguais permanecem separadas; linhas sem unidade continuam visíveis mas não podem ser escolhidas.

Um produto já escolhido mantém uma opção identificada como selecionada fora da página quando o filtro ou a paginação não o incluem. Essa opção não aumenta o total dos resultados. Uma pesquisa sem resultados conserva a escolha e indica zero; nunca escolhe automaticamente o primeiro produto. Se a identidade/nome/unidade deixarem de corresponder à guia, o registo guardado fica para revisão, sem substituição por outra linha.

A pesquisa e a página pertencem à visita, incluindo a distinção normal/extra, e permanecem em memória ao alternar visitas, atualizar a guia ou reconstruir os cartões da rota antiga. A indisponibilidade temporária não apaga a página antes de chegar a resposta. Se a lista confirmada encolher, a paginação ajusta-se ao último intervalo existente. A pesquisa reinicia ao recarregar a página; o produto e o rascunho continuam guardados e são recuperados offline.

Pesquisar, limpar, paginar e traduzir não gravam o rascunho nem alteram os seus produtos. Os editores continuam a respeitar os bloqueios existentes. O formulário moderno conserva o percurso próprio de correção das visitas normais concluídas; as visitas extra e o formulário antigo mantêm os respetivos percursos. Nenhuma alteração de autorização, consumo, saldo, API ou migração.

## Limites e apresentação

O novo componente limita as opções inseridas em cada seletor a 25 resultados, mais a escolha retida quando necessária e a opção inicial/revisão. A consulta da guia continua a receber a lista completa. Não se apresenta esta mudança como paginação no servidor ou limite de memória de toda a página.

Os controlos e as mensagens da pesquisa existem em PT/EN/FR/ES/DE. A nova pesquisa usa os mesmos dados confirmados e cópias privadas já disponíveis em cada formulário; não cria outra cópia persistente nem altera o formato dos rascunhos.

## Verificação

- 1058 testes unitários/121 ficheiros, incluindo 18 novos; modelo com 5001 linhas e opções limitadas. Sintaxe 690 backend/306 frontend/44 inline, com nova verificação dos ficheiros alterados depois do gate completo.
- Cinco grupos locais distintos aprovados: catálogo no navegador, identidade de produtos no navegador, produtos antigos, rascunhos modernos e rascunhos antigos. O grupo de catálogo foi repetido integralmente com a última alteração de conservação da pesquisa.
- 207 materiais percorridos nas duas interfaces, sem omissões/repetições; pesquisa literal/acentos/ID, unidades nulas e literais, seleção fora da página, zero resultados e bytes do rascunho conservados ao filtrar/traduzir. Atualização da guia, reconstrução da rota e alternância normal/extra verificadas.
- Recarregamento offline real, conclusão na linha original e saldo das outras linhas idênticas conservado. Testes existentes confirmam repetição do UUID, resposta perdida, correção extra, conflitos entre janelas, quota, cópias ilegíveis e troca de conta.
- PT/EN/FR/ES/DE, 320/390/1440, altura 1100, 30 capturas da pesquisa. Controlos de pelo menos 44 px e centros desobstruídos após deslocação. Inspeção manual das capturas modernas DE320 e antigas PT1440.

A preparação repôs a base isolada a partir do esquema anterior e das 43 migrações existentes. Chromium 138 não preencheu o motivo obrigatório no teste de correção; com Chromium 153.0.8010.0, o mesmo percurso passou, incluindo uma asserção explícita do valor preenchido. A validação do formulário não foi removida. Também se corrigiu a expectativa inicial do teste sobre visitas normais concluídas, que mantêm o percurso de correção existente. Tentativas iniciais não contam como aprovação.

Base local PGlite 0.5.8/pglite-socket 0.2.11, dados sintéticos, integrações externas desligadas; não substitui PostgreSQL nativo/restauro. [Evidência](evidence/20260927_task384_local.json). Cache v195, documentos v3, runner 299, nenhuma migração nova. Inventário: 126 HTML, 114 com referência literal em QA, zero recursos ausentes e duas referências Git indisponíveis localmente.

TASK383 continua em execução na última consulta: [CI 36354384627](https://github.com/ts7520305-svg/cristalwater/actions/runs/36354384627), job 108719062994. Os 298 grupos e restauro ainda não estão confirmados. A confirmação anterior de TASK381/382 mantém-se registada.

## Publicação

Publicada em 27/09/2026 no commit `ae072e3656632a8db0e56eaa45a4ab75994ac9c8`, árvore `783f3daaedb03737413123772bd6550211b25ec0`, idêntica à preparada e validada localmente, na branch `work/field-readiness-20260915-simulation`. [CI 36356317137](https://github.com/ts7520305-svg/cristalwater/actions/runs/36356317137), job `108724640933`, em execução. A sintaxe, os testes unitários/técnico/navegador e a atualização aditiva do esquema já passaram neste CI. Os 299 grupos PostgreSQL e o restauro desta alteração ainda não estão confirmados.

## Continuação

Confirmar CI/restauro. Rever a adição de produtos no editor de correção de visitas extra: as linhas existentes preservam a identidade, mas «Adicionar produto» ainda usa nome/unidade livres. Confirmar a guia original e oferecer seleção exata sem criar conciliação automática de dados históricos. Tradução integral das páginas antigas, limites dos alertas, cópias/VPS e piloto físico continuam abertos. Sem merge, implantação ou contactos reais; aplicação não declarada completa.
