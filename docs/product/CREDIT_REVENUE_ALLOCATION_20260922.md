# TASK294 — atribuição das reduções aos serviços

## Resultado

`/admin-credit-revenue` permite atribuir notas internas de crédito já comprovadas a serviços do mesmo documento e cliente. O novo registo conserva nota, destino, identidade tipada do serviço, mês documental e de execução, fontes originais, autor e motivo. A operação regista a parcela e o recibo na mesma transação. Não modifica faturas, pagamentos, crédito do cliente, stock ou custos.

Destinos admitidos: linhas com visitas regulares/extra únicas e concluídas, manutenções com decisão comercial original e execução compatível, reparações com origem documental e declaração autenticada de execução, ou parcelas de mensalidade ainda válidas. Estado administrativo de reparação e texto livre de uma nota não determinam a atribuição. Cliente histórico prevalece sobre o proprietário atual da piscina.

O valor atribuído não pode exceder o saldo da nota nem o valor bruto do destino menos todas as reduções ativas das notas do documento. Valores por rever continuam reservados até anulação explícita. Acrescentar uma nota legítima conserva atribuições anteriores de linhas ordinárias; alterações de fonte, serviço, cliente, período, parcela mensal ou desaparecimento da origem exigem revisão. Reservas históricas impedem a reatribuição por substituição/remoção de linhas.

## Mensalidades e períodos

Uma nota altera a fotografia documental usada na repartição bruta da mensalidade. Parcelas anteriores ficam por rever; a administração anula-as e confirma novamente o valor bruto conforme o contrato original antes de atribuir reduções. Não há divisão automática pelo número de visitas. Anular posteriormente essa parcela deixa a redução associada por rever e não liberta silenciosamente o valor da nota.

A consulta financeira mantém o mês original do documento e os valores atuais; o mês real do serviço é identificado separadamente. Notas podem ser registadas noutro mês. Não são notas fiscais externas nem fecho histórico. IVA continua no programa externo; preço e frequência dependem do cliente/época.

## Consistência e recuperação

- ADMIN ativo, parâmetros exatos, UUID, hash do pedido com âmbito `CREDIT_NOTE_REVENUE` e confirmação explícita.
- Bloqueios do pedido, linha mensal quando aplicável, cliente/documento e fontes de serviço. Confirmação compara o estado de todas as notas/destinos do documento; pedidos concorrentes distintos não gastam o mesmo saldo.
- Mesmo pedido devolve o recibo original; outro conteúdo/conta não pode reutilizar esse recibo. Falha na escrita do evento reverte a parcela/anulação. Históricos sem chaves externas em cascata permanecem legíveis após remoção da origem.
- IndexedDB e Web Locks exclusivos desta função, pedido persistido antes do POST, recuperação após resposta perdida/recarga, consulta, repetição e cancelamento explícitos do mesmo pedido. Recibos de mensalidades não confirmam reduções.
- Mudança de conta, A–B–A, filtros, offline, armazenamento inválido e respostas adulteradas bloqueiam comandos ou limpam dados; texto livre é apresentado literalmente. Sem contactos externos nos ensaios.

## Consulta financeira versão 7

As sete parcelas mantêm valores brutos. `grossDocumentAmountCents - creditNotes.amountCents = reconciledDocumentAmountCents` permanece obrigatório. A soma de reduções atribuídas, por atribuir e por rever é exatamente o total das notas comprovadas do mês documental. Contagens de parcelas ativas/por rever abrangem todos os meses, incluindo origens retiradas.

`creditNotes.attribution.services` identifica destinos elegíveis dos documentos com notas, bruto, redução confirmada, líquido e ambos os períodos. O líquido é nulo enquanto qualquer nota desse documento estiver por repartir ou rever. Quando todas estiverem válidas e totalmente repartidas, líquido = bruto - reduções. Uma revisão bloqueia a confirmação líquida do documento; a redução original continua no total documental, sem dupla subtração.

Listas são amostras identificadas de dez; totais não são truncados. A interface valida somas, contagens, identidades, estados, períodos e equações. A resposta local e o contexto do modelo usam a mesma base. `COMPLETE` aplica-se só à atribuição das notas selecionadas: receita completa e lucro continuam nulos; custos e períodos ainda não permitem margens.

## Validação local

- Novos grupos API e navegador: autorização, recibo exato, reenvio, falha atómica, limites de nota/destino, concorrência entre notas, cliente histórico, meses distintos, líquido parcial/completo/por rever, nova nota, cancelamento e anulação, mensalidades, equipamentos/lembretes/reparações, origem retirada, totais completos, indisponibilidade e leitura sem escrita.
- Navegador real: 320/390/1440, conteúdo literal, seletor paginado, duplo clique, perda de resposta, recarga, repetição/cancelamento, recibo de âmbito diferente, duas janelas, dados alterados, offline, sessão e armazenamento inválido. Mensalidades e Gestão com IA também aprovados; apresentação móvel/desktop inspecionada.
- Regressões aprovadas: conciliação de notas, repartição mensal, cobertura documental, manutenção, origem de reparação, confirmação de execução e IA financeira. Logs locais `/tmp/cw294-focused.log` (API aprovada; primeira preparação do navegador corrigida), `/tmp/cw294-browser.log` e `/tmp/cw294-regressions.log`.
- 401 unitários/64 ficheiros. Sintaxe 589 backend/193 frontend/60 inline. Runner: 187 grupos distintos. Cache v109; sem dependência nova.
- Migração aditiva 27: `CreditRevenueAllocation` e `CreditRevenueEvent`, índices, restrições de valores/tipos/meses/hashes/UUID e consistência da anulação; sem backfill ou alteração de dados anteriores. Aplicação das 27 migrações à estrutura anterior, preservação de dados e restrições aprovadas localmente (`/tmp/cw294-migrations.log`). Restauro PostgreSQL 16 sujeito à validação final publicada.

## Próximo âmbito

Conciliar restantes ajustes/descontos e origens, completar custos (incluindo reparações) e relacionar receita/custos pelo mesmo período de execução antes de margens. Restantes históricos, apresentação/idiomas/volume, VPS, fornecedores e piloto físico continuam pendentes. Não houve merge, deploy ou contactos reais neste lote. A TASK294 não certifica produção ou execução física independente.
