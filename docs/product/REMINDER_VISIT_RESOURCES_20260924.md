# TASK316 — parcelas próprias de lembretes associados

## Resultado

Em Associar a uma visita, a administração abre Parcelas de materiais e trabalho. O ecrã de recursos é partilhado com as declarações independentes, mas usa uma opção explícita `associated=1`, contratos e armazenamento próprios. O técnico vem da visita confirmada. O utilizador pode declarar materiais, confirmar que não houve materiais ou conservar os materiais por confirmar enquanto regista um intervalo próprio de trabalho. Não se presume que o lembrete usou todo o tempo ou o consumo da visita.

A conferência usa o consumo líquido da visita REGULAR/EXTRA, incluindo devoluções e identidade do produto. As quantidades são calculadas com seis casas decimais, em inteiros. As declarações de equipamento e os outros lembretes associados partilham o mesmo limite. A prévia apresenta a quantidade escolhida, o consumo líquido, as reservas de outros serviços e o remanescente. O tempo próprio tem precisão de segundos, cabe no intervalo da visita e não pode sobrepor outra parcela, visita, reparação ou declaração independente. Intervalos adjacentes são admitidos.

A operação não cria consumo, compra, despesa, pagamento, receita nem custo. A repartição dos custos confirmados do pai pelos lembretes continua para a TASK317. Os campos por confirmar permanecem desconhecidos.

## Comprovativos e concorrência

`FieldWriteRequest`, âmbito `REMINDER_VISIT_RESOURCES`, conserva o pedido, a associação original completa, a origem tipada, o contexto, as parcelas dos outros serviços, os movimentos conferidos, o cálculo, o autor e o motivo. Cada operação aplicada liga-se ao hash anterior. O UUID pertence à conta e ao conteúdo original; consultar ou reenviar recupera a mesma confirmação.

Anular conserva o comprovativo DECLARE integral. As parcelas têm de ser anuladas antes da associação à visita. Anular continua possível quando a origem operacional foi removida ou alterada, desde que o próprio histórico seja verificável. Uma cadeia incoerente bloqueia novas reservas. A procura de reservas usa tanto os comprovativos de parcelas como as associações originais, para não libertar capacidade apenas porque uma origem posterior mudou.

A escrita serializa pela visita tipada e pelos bloqueios de valorização/recursos do lembrete, depois confere as linhas de origem, revisões, movimentos e técnico. Pedido, história técnica e auditoria usam a mesma transação. Uma falha em qualquer destas escritas reverte a operação completa. As leituras usam um snapshot consistente.

As revisões de equipamento passam a considerar as parcelas dos lembretes no consumo líquido e nos intervalos. As correções administrativas de materiais incluem estas reservas na versão da origem. As parcelas financeiras MATERIAL anteriores podem ficar por rever quando a base de consumo muda: a prévia identifica as despesas afetadas, mas conserva as atribuições, os valores originais e as reservas. Sem parcelas associadas, a forma e os hashes dos comprovativos anteriores mantêm-se.

## Percurso no navegador

O formulário conserva rascunhos por conta e lembrete, com uma base IndexedDB própria para pedidos associados. O consentimento não é recuperado após recarregar. Alterar campos ou motivo invalida a prévia. Offline impede a confirmação; a mudança de conta limpa os dados apresentados. O pedido original fica conservado após perda de resposta, com consulta ou reenvio explícito. Web Locks impedem duas janelas de substituírem o pedido pendente da mesma conta.

As rotas são administrativas:

| Operação | Rota |
|---|---|
| Consulta | `GET /api/equipment-maintenance/reminders/:id/visit-resources` |
| Prévia | `POST /api/equipment-maintenance/reminders/:id/visit-resource-preview` |
| Declaração/anulação | `POST /api/equipment-maintenance/reminders/:id/visit-resources` |
| Recuperação | `GET /api/equipment-maintenance/reminder-visit-resource-requests/:requestId` |

O formulário reutiliza a navegação e o estilo existentes. Foi corrigido o contraste das caixas de produtos e dos botões secundários em modo escuro, que o adaptador visual sobrepunha. A identidade da visita e os recursos continuam visíveis em ecrãs estreitos. Cache v131. Sem nova dependência, tabela ou migração.

## Validação

Base remota `de87855877492ce56699b261007feb0cea8184e0`, fecho da TASK315. A recuperação local conferiu cada ficheiro utilizado com o hash do Git e reconstituiu o commit e a árvore `2d3e5c9e57c14395d14bd9b4b152ba73ce96ca97`. Documentos históricos e alguns binários não necessários aos ensaios ficaram fora do checkout esparso; não são eliminados da árvore publicada.

- 484 testes unitários em 72 ficheiros, incluindo cinco novos casos de contrato partilhado Node/navegador; quatro testes técnicos.
- Sintaxe: 615 JS backend, 214 frontend e 62 scripts inline.
- Grupo novo: `scripts/test-field-reminder-visit-resources.js`. API com duas instâncias, materiais fracionários/devoluções, limites com equipamentos reais, concorrência por quantidade e horário, origem REGULAR/EXTRA com o mesmo ID, revisão de custo existente sem alteração do original, pedido desatualizado, sobreposição externa, corrupção de comprovativo, remoção de origem e rollback de três escritas.
- Navegador: rascunho, técnico fixo, prévia das quantidades, offline, duplo clique, resposta perdida e consulta sem duplicação, anulação e isolamento de sessão. Capturas 320/390/1440 e modo escuro em `reports/field-visual/reminder-visit-resources/`.
- Nove regressões dirigidas aprovadas: associações, recursos, materiais e trabalho dos lembretes; materiais de equipamento, correções, tempos, repartição MATERIAL e repartição LABOR.
- 219/219 grupos aprovados no PostgreSQL 16, incluindo o grupo novo de API/navegador (8,582 s), e restauro completo aprovado.

Os ensaios usam base descartável e fornecedores externos desligados.

Código publicado `c40219b8a5f7572d85ea82352fd9ed2eda27b6e5`, árvore `dba564ada3bc1be52784204e2942cf7ded578d4b`, igual à validada localmente. [CI 36001740454](https://github.com/ts7520305-svg/cristalwater/actions/runs/36001740454), job `107639801788`, aprovado entre 2026-09-24T12:51:27Z e 2026-09-24T13:21:49Z (30m22s): 17 etapas, 219/219 grupos previstos distintos, sem falhas, faltas, entradas inesperadas ou duplicações; 484 unitários/72 ficheiros, quatro testes técnicos, gate geral de navegador, sintaxe 615/214/62 e 38 migrações. Restauro PostgreSQL 16 de 127 tabelas/46 ficheiros, com linhas e hashes iguais. Evidência [evidence/20260924_task316_ci.json](evidence/20260924_task316_ci.json). Cache v131, sem novas migrações/tabelas/dependências. O fecho posterior altera apenas documentação; a aprovação refere-se ao código e árvore acima.

## Continuação

TASK317: repartição explícita de custos confirmados da visita pelas parcelas próprias dos lembretes, com limites financeiros comuns e anulação/revisão recuperáveis. Permanecem abertos múltiplos intervalos, repartições entre meses, históricos sem comprovativo verificável, demais despesas/receitas, volume e operação prolongada, revisão de páginas/PDFs/idiomas, integrações, VPS e piloto físico. A TASK316 não significa conclusão do sistema.

A publicação permanece em `work/field-readiness-20260915-simulation`. A branch principal, o VPS, os contactos reais e a emissão fiscal permanecem fora deste lote autorizado.
