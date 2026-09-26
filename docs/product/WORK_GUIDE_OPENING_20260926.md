# TASK376 — Abertura revista de guias de obra e quilometragem

## Confirmação nativa — registada em TASK378

[CI 36223589014](https://github.com/ts7520305-svg/cristalwater/actions/runs/36223589014), job `108353287692`: **288/288 scripts esperados distintos, todos zero**, 17 etapas aprovadas e restauro de **128 tabelas/47 ficheiros** com linhas e hashes iguais. [Evidência](evidence/20260926_task376_ci.json). As referências anteriores a validação pendente conservam o estado conhecido no momento da publicação original.

## Comportamento

Abertura em `/work-guide-start`, com entradas reais na frota e na página de guias do técnico. ADMIN escolhe a viatura e um técnico atualmente atribuído, ou escolhe explicitamente abrir sem técnico. TECHNICIAN e TEAM_LEADER, por PIN ou conta User ligada, só podem abrir na sua atribuição atual e em seu nome.

A revisão mostra viatura, técnico, origem dos materiais, nomes/tipos/unidades/quantidades, leitura inicial, quilómetros anteriores/finais da viatura, notas exatas e motivo. Sem leitura inicial grava nulo na nova obra e conserva os quilómetros atuais; indicar uma leitura atualiza ambos. Zero não significa ausência. Leitura decimal estrita, até três casas e 999 999 999,999; valores negativos, exponenciais, coerções e retrocessos são recusados.

A origem é determinada no servidor e aparece antes da confirmação:

1. Guia de transporte ativa única, sem obra anteriormente associada.
2. Na ausência de AT ativa, modelo da viatura existente e válido; modelo vazio inicia sem materiais e impede recurso ao histórico.
3. Sem modelo, última guia de transporte por data de criação e ID; a obra é provisória e conserva a referência herdada.
4. Sem guia nem modelo, obra provisória sem materiais.

Modelo inválido é uma recusa explícita. Nomes, unidades, tipos, duplicados, zeros e até seis casas decimais dos materiais são conservados; os novos itens começam com quantidade inicial igual ao saldo e consumo zero. Cada revisão suporta até 100 materiais, no máximo um milhão por quantidade. Não há conversão de unidades, mistura de origens nem movimentos de consumo/carga ou financeiros nesta operação.

Uma obra existente nunca é reiniciada, substituída ou reaberta. A lista assinala obras abertas e permite entrar na revisão da obra existente. Uma AT cuja obra já terminou exige reconciliação própria. Várias AT ativas também bloqueiam a abertura. Os POST antigos `/api/guides/start` e `/api/guides/work/start`, e o serviço interno de compatibilidade, exigem a nova revisão com 409.

## Gravação e recuperação

Prova de cinco minutos vinculada à proposta, à atribuição, à viatura e à origem. Bloqueio comum por viatura e ordem coerente de linhas coordenam abertura, atribuição, modelo, criação/gestão de AT e fecho. Uma alteração concorrente invalida a confirmação.

Obra, itens, quilometragem opcional, auditoria e comprovativo por conta/UUID são atómicos. Sem AT, a pendência `MISSING_TRANSPORT_GUIDE` e a notificação interna administrativa entram na mesma transação. O autor vem da identidade autenticada; cabeçalhos de texto não definem autoria. Notas da nova obra são preservadas exatamente e separadas do motivo. O original completo do modelo, com notas/metadados adicionais, é conservado na auditoria administrativa; a resposta de campo só recebe a projeção operacional.

Perda de resposta, reinício e reenvios concorrentes recuperam o comprovativo original sem repetir obra/aviso. Uma tentativa pode ser encerrada persistentemente. A consulta de um comprovativo próprio continua possível depois de uma reatribuição. Só conta, viatura e UUID ficam no armazenamento do separador; formulário e prova ficam em memória. Respostas parciais, conta alterada, expiração, suspensão, falha de armazenamento e referência corrompida não produzem confirmação indevida.

## Validação

- 935 unitários em 113 ficheiros, incluindo 17 novos; quatro testes técnicos.
- Sintaxe: 684 scripts backend, 294 frontend e 44 inline.
- Dez grupos locais distintos aprovados: abertura API/navegador, atribuição API, modelos API, criação AT API, frota no navegador, fecho API/navegador, navegação/preferências e simulação mensal.
- Sete falhas SQL reais revertem toda a operação: obra, material, quilometragem, pendência, notificação, auditoria e comprovativo. Perda/reinício/repetição entre dois processos, duas revisões concorrentes e disputas reais com atribuição/modelo passaram.
- Origem ativa/modelo/última guia/nenhuma; modelo inválido e vazio; zero/nulo; notas exatas e materiais duplicados; obra aberta/fechada; permissões e reatribuição; prova alterada/expirada/anulada; paginação e falhas reais de leitura verificados.
- Navegador: entradas reais ADMIN/técnico; seleção explícita; texto literal escapado; clique duplicado; offline/repetir/consultar/anular; recarga; armazenamento; respostas parciais e atrasadas; troca de conta durante revisão/confirmação; expiração e suspensão; perfis de campo nas duas identidades.
- Dezoito capturas da nova página, cinco idiomas, larguras 320/390/1440, sem deslocação horizontal e controlos de 44 px. Nome completo do técnico sob o seletor móvel; inspeção visual de formulário móvel e revisão móvel/desktop.
- A primeira regressão da frota procurava o campo removido `workTech`. O teste passou a selecionar a viatura conservada e mantém as verificações de limpeza/bloqueio em troca de conta. Grupo integral repetido com sucesso; log inicial preservado.
- Obras anteriores, documentos oficiais e bytes, fontes de materiais, movimentos, custos e finanças conservados. Simulação mensal manteve cinco clientes, nove equipamentos, 54 visitas, 60 consumos, seis reparações e cinco faturas.

[Evidência local](evidence/20260926_task376_local.json). QA local com PGlite e dados sintéticos não substitui PostgreSQL nativo. Sem nova migração; aplicadas as 43 existentes. Cache v187; runner de 288 grupos. Inventário: 126 HTML, 114 com referência literal em 309 scripts ativos; 12 sem referência literal, zero recursos ausentes e duas referências Git indisponíveis nesta cópia.

## Publicação e validação nativa

Publicada em `8fb9e816311880c22696c1c695e810efa75d3af1`, árvore `c67dca06ed66693ec955bb21959742ffcc8ec22f`, idêntica à preparada e validada localmente, na branch `work/field-readiness-20260915-simulation`. [CI 36223589014](https://github.com/ts7520305-svg/cristalwater/actions/runs/36223589014), job `108353287692`, em execução. O gate PostgreSQL nativo de 288 grupos e restauro permanece por confirmar.

TASK374 confirmada no [CI 36220493972](https://github.com/ts7520305-svg/cristalwater/actions/runs/36220493972), job `108344709185`: 284/284 scripts esperados distintos, todos com código zero, 17 etapas aprovadas e restauro de 128 tabelas e 47 ficheiros com linhas e hashes iguais. [Evidência nativa](evidence/20260926_task374_ci.json). TASK375, [CI 36221808091](https://github.com/ts7520305-svg/cristalwater/actions/runs/36221808091), job `108348349992`, ainda em execução na última consulta; 286 grupos e restauro não declarados aprovados.

## Retoma

Continuar nas leituras e no histórico de guias/obras/movimentos da frota. A página antiga ainda lê listas completas de guias/obras, interpreta propriedades ausentes como listas vazias e mostra apenas os últimos 30 movimentos, sem paginação/total. Rever completude, filtros, dados projetados, estados indisponíveis e conservação da seleção antes de novas operações.

O percurso já revisto de criação de AT mantém a sua abertura/associação própria; este lote não altera a sua semântica de leitura histórica. Estado ACTIVE da AT não constitui validação fiscal da sua data/documento. Conciliação histórica, volume real, limites do motor de alertas, política operacional de arquivo/cópias, VPS e piloto físico continuam abertos. Sem merge/deploy/contactos reais; aplicação não declarada completa.
