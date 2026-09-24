# TASK317 — custos próprios dos lembretes associados

## Resultado

Na despesa, a administração abre a repartição de materiais ou trabalho da visita e escolhe Revisão de equipamento ou Lembrete associado à visita. Os lembretes usam a declaração própria confirmada da TASK316. A prévia mostra o serviço, a origem histórica, o documento, a atribuição original, a quantidade ou duração, o custo escolhido e o remanescente da visita. A confirmação exige motivo e consentimento explícito.

A repartição usa apenas uma atribuição MATERIAL/LABOR já confirmada da visita REGULAR/EXTRA. O lembrete e a visita pertencem ao mesmo cliente, piscina e mês UTC. O comprovativo original completo dos recursos, incluindo a associação, acompanha a parcela. O custo comercial cobrado ao cliente não intervém neste cálculo.

## Conservação e histórico

- A atribuição original continua a reservar o consumo, o documento ou a base paga. As parcelas são projeções secundárias no histórico de despesas: não criam stock, compra, pagamento ou outra atribuição independente.
- Equipamentos e lembretes usam o mesmo saldo de cada atribuição. Os materiais do mesmo serviço usam também um limite conjunto entre compras. Quantidades com seis casas decimais são calculadas com inteiros; os cêntimos e o remanescente final são conservados.
- O destino inclui o tipo. Um lembrete e uma revisão com o mesmo ID numérico continuam distintos na prévia, no histórico, no saldo e no rascunho. Pedidos mistos, com os dois tipos de identificador, são recusados.
- O trabalho usa a duração própria confirmada dentro da visita. Cada documento/componente do custo original é repartido expressamente; a duração integral da visita não é copiada para cada serviço.
- A consulta por execução, por cliente e do contexto financeiro usa a projeção comum existente. A soma do remanescente e das parcelas conserva o valor original. Uma origem alterada ou um histórico incoerente obriga a revisão e impede que valores por confirmar sejam apresentados como totais conhecidos.
- Anular os recursos mostra as parcelas financeiras afetadas. Os comprovativos e as reservas financeiras ficam conservados até à anulação expressa de cada parcela na despesa. A associação à visita não pode ser removida enquanto restarem parcelas financeiras ativas.
- A atribuição original e as bases compostas continuam protegidas pelo bloqueio comum de parcelas ativas. Anular uma parcela válida conserva integralmente o original, incluindo quando a origem atual exige revisão.

A escrita de despesas reutiliza a transação e o controlo de versão existentes. A declaração de recursos e a repartição de materiais usam o mesmo bloqueio da visita tipada. As repartições dos lembretes adquirem também os bloqueios dos recursos, da origem e do técnico antes da confirmação. Uma falha ao guardar o recibo reverte o incremento de versão e a operação.

Os comprovativos novos de repartição são versão 2. A verificação dos comprovativos anteriores de equipamento, versão 1, mantém a forma e os hashes originais. A identificação do destino, a prova dos recursos, as contas e os hashes são conferidos no servidor e no navegador.

## Navegação e contratos

Os seletores e rotas existentes são reutilizados, com parâmetros explícitos:

| Percurso | Seleção de lembrete |
|---|---|
| `maintenance-material-candidates` / `maintenance-labor-candidates` | `targetType=MAINTENANCE_REMINDER` |
| `maintenance-material-preview` / `maintenance-labor-preview` | `reminderId`, sem `completionId` |
| `SHARE_MAINTENANCE_MATERIAL` / `SHARE_MAINTENANCE_LABOR` | `reminderId`, quantidade quando aplicável, hash, motivo e confirmação |
| Anulação e recuperação | Mesmos comandos e consulta do pedido original de despesa |

O formulário conserva rascunhos separados por conta, despesa, atribuição e tipo de destino. Recarregar não recupera consentimento. Uma resposta perdida conserva o pedido original e permite consultar a confirmação sem duplicar a escrita. O resumo pendente identifica o lembrete. Mudar de conta esconde os dados e bloqueia a operação. Foi corrigido o contraste dos botões secundários das duas caixas de repartição em modo escuro. Cache v132; nenhuma dependência, tabela ou migração nova.

## Validação

Base `740f1378a3d4b97f750bf3284515364e8618fb87`, fecho documental da TASK316. O código da TASK316 foi aprovado separadamente no CI 36001740454 e no restauro, com 219 grupos. Esse resultado não aprova automaticamente a TASK317.

- 489 testes unitários em 72 ficheiros, incluindo cinco casos novos de prova e cálculo partilhados Node/navegador; quatro testes técnicos.
- Sintaxe: 616 JS backend, 215 frontend e 62 scripts inline.
- Grupo novo `scripts/test-field-reminder-visit-costs.js`: duas instâncias HTTP, identidades de equipamento/lembrete com o mesmo ID, limites entre compras, concorrência, arredondamento e remanescente final, originais e pagamentos conservados, projeção por execução, comprovativo corrompido, origem alterada, custos afetados ao anular recursos, bloqueio de desassociação, recuperação e rollback do recibo/versão.
- Navegador real: seleção de destino, materiais e trabalho, rascunho após recarregar, duplo clique, resposta perdida, recuperação por consulta sem novo POST, anulação, conta trocada e capturas 320/390/1440 e modo escuro em `reports/field-visual/reminder-visit-costs/`.
- Oito regressões dirigidas aprovadas: repartição de materiais e trabalho de equipamento; correção de materiais; recursos associados; associações; recursos, materiais e trabalho independentes de lembretes.
- Runner com 220 grupos distintos. O código `46025c4cf9c025abd1fe48f1a441270564100ec6`, árvore `4cdcc99df4beb197f687bce29bb9680f87ac5a48`, foi publicado. O [CI inicial 36006695285](https://github.com/ts7520305-svg/cristalwater/actions/runs/36006695285) terminou com 219 grupos aprovados e uma falha de preparação no grupo novo: `GeneralReminder.id=138` já existia na base partilhada dos testes (`P2002`). O restauro foi omitido por essa falha. Evidência: [evidence/20260924_task317_ci_initial_failure.json](evidence/20260924_task317_ci_initial_failure.json).
- Correção do ensaio: conservar o lembrete anterior e preparar a sequência de equipamento da base QA acima dos IDs ocupados. O teste continua a criar equipamento/lembrete com o mesmo ID, sem apagar ou alterar registos de outros grupos. Inclui agora um lembrete sentinela que reproduz a colisão e verifica a sua conservação. A correção não altera código de produção. O novo CI completo e o restauro foram aprovados em conjunto com a TASK318, conforme evidência abaixo.

Código integrado publicado `f2057605c48529349bdb249d3b4e6bb668f3678a`, árvore `611f4ef5bd0fb56d8157d3b18e88788aa74de351`, igual à validada localmente. [CI 36011196233](https://github.com/ts7520305-svg/cristalwater/actions/runs/36011196233), job `107672038955`, aprovado entre 2026-09-24T14:13:14Z e 2026-09-24T14:46:11Z (32m57s): 17 etapas, 221/221 grupos previstos distintos, sem falhas, faltas, entradas inesperadas ou duplicações; 494 unitários/72 ficheiros, quatro testes técnicos, gate geral de navegador, sintaxe 616/215/62 e 38 migrações. Restauro PostgreSQL 16 de 127 tabelas/46 ficheiros, com linhas e hashes iguais. Evidência [evidence/20260924_task317_task318_ci.json](evidence/20260924_task317_task318_ci.json). Cache v133, sem novas migrações/tabelas/dependências. O fecho posterior altera apenas documentação; a aprovação refere-se ao código e árvore acima.

O lote inicial altera 20 ficheiros: dois documentos, nove ficheiros frontend, seis serviços e três ficheiros de testes/runner. Os ensaios usam bases descartáveis e fornecedores externos desligados.

## Continuação e limites

A TASK318 acrescentou a declaração e valorização de múltiplos intervalos próprios dos lembretes associados, com aprovação conjunta no CI/restauro. Os percursos independentes e de equipamento continuam com intervalo único. Repartições entre meses, registos antigos sem comprovativo verificável, restantes despesas/receitas, volume e operação prolongada, páginas/PDFs/idiomas, integrações, VPS e piloto físico continuam abertos. Os custos e receitas completos e o lucro continuam por apurar.

A publicação permanece em `work/field-readiness-20260915-simulation`. A principal, o deploy no VPS, os contactos reais e a emissão fiscal permanecem fora deste lote autorizado. A TASK317 não significa conclusão do sistema.
