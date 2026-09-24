# TASK337 — PDFs financeiros internos e relatórios mensais guardados

## Resultado

A conta corrente, a lista de extras pendentes, o orçamento de reparação e o relatório mensal do cliente usam o mesmo gerador completo das guias. Conservam caracteres Unicode, texto extenso, referências e cabeçalhos em todas as páginas, paginação exata, cache privada e `nosniff`. A resposta só começa depois de o PDF estar concluído; dados incompletos produzem uma falha explícita sem um PDF parcial com sucesso HTTP.

O documento financeiro e os extras identificam-se como documentos internos não fiscais. A conta corrente conserva os totais, pagamentos, saldo e linhas originais, incluindo valores negativos; não reconcilia nem reescreve o documento. O nome descarregado é `documento-interno-ID.pdf`. A aplicação continua a registar faturas fiscais emitidas externamente.

O orçamento usa a versão comercial guardada, os preços de venda, o desconto, o IVA e as condições. Não inclui custos de compra, margens nem notas internas. Uma estimativa antiga sem valor apresenta «Por rever». O relatório mensal usa exclusivamente o conteúdo guardado: nomes, piscinas, contagens e estado de pagamento históricos. Conserva a distinção entre versões antigas e a versão 2 com data de fecho UTC e visitas por confirmar.

As permissões e seleções dos documentos mantêm-se nos serviços existentes. Não há migrações, novas dependências, alterações de frontend/cache, pagamentos, reservas, stock ou recibos. O inventário finito está em [PDF_INVENTORY_20260924.md](PDF_INVENTORY_20260924.md): oito famílias e dez rotas ativas.

## Verificação

- 592 testes unitários em 81 ficheiros, quatro testes técnicos e sintaxe de 626 ficheiros backend, 220 frontend e 62 scripts inline.
- Oito grupos distintos de API/Chromium integralmente aprovados: documentos financeiros PDF, acesso aos PDFs financeiros, versões comerciais de orçamento, acesso aos relatórios mensais, PDFs de guias, portal mensal, inspeção histórica e execução de visitas extra.
- Quatro PDFs com sete páginas revistas visualmente: conta corrente (2), extras (1), orçamento com condições extensas (2) e mensal com 16 piscinas (2). Texto latino, grego e cirílico; caracteres não suportados assinalados explicitamente; valores originais, cabeçalhos, referências e páginas finais conferidos.
- Recusas sem sessão, por técnico e por outro cliente; orçamento apenas administrativo. Relatório mensal ilegível recusado antes de enviar bytes. Comparação integral dos originais e contagens financeiras/stock/recibos antes e depois da consulta.
- Portal mensal: 14 meses, paginação, PDFs atuais/antigos, respostas falsas, cancelamento, timeout, offline, cinco idiomas e larguras 320/390/1440. ADMIN A–B–A com respostas tardias; troca de conta entre separadores e expiração real da sessão aprovadas.

Ambiente local isolado com PGlite, Chromium e 40 migrações. O teste adicional de geração mensal passou os casos de dados/PDF até ao ensaio de escrita por uma ligação independente durante uma transação. Essa etapa expirou com `P2028` no PGlite; não está aprovada localmente e depende do PostgreSQL nativo no CI. Não se alteraram o teste nem as garantias transacionais para o adaptar ao ambiente.

O primeiro ensaio local de troca de contas encontrou partilha de armazenamento entre contextos causada pela opção Chromium `--single-process` do executor temporário. Um exemplo mínimo confirmou a causa. O ensaio completo passou com o Chromium normal e todas as verificações originais; a correção é apenas do executor local (`/tmp/cw309-runtime/qa336-normal-browser.mjs` e `/tmp/cw336-browser-preload.cjs`).

Após integrar a TASK336 histórica publicada em paralelo, repetiram-se os 592 unitários, os quatro técnicos, a sintaxe e a sequência de documentos financeiros → inspeção histórica → execução de extras; todos aprovados. O restante conjunto de cinco grupos passou na base anterior, sem alterações nesses percursos.

## Falha anterior e isolamento dos dados de teste

O CI TASK334 `36045589129`, código `93fb9aa452017b0391b4116c204c58256711ba1f`, terminou com 229/231 grupos aprovados. O seletor antigo do editor já foi corrigido na TASK335. A outra falha era uma visita histórica ambígua criada pelo teste de inspeção: ficava com a cobrança EXTRA por omissão e bloqueava corretamente a consulta global dos extras no ensaio seguinte. O cenário histórico passa a ser criado explicitamente sem cobrança (`NO_CHARGE`, `isBillable: false`). Conserva a divergência histórica e todas as verificações de privacidade; não flexibiliza a validação comercial. A sequência inspeção histórica → execução de extras passou integralmente em API e navegador. [Evidência inicial](evidence/20260924_task334_initial_failure.json).

O runner passa de 233 para 234 grupos. As provas locais constam de [evidence/20260924_task337_local.json](evidence/20260924_task337_local.json). A aprovação completa e o restauro nativo continuam dependentes do novo CI; não se herda a aprovação de um código anterior.

## Publicação

Base inicial `93695172b5611154046423ef75bc5261fd9e79c1`; integrada depois a confirmação histórica TASK336 de `c807600878f5a87dc5f0e4a366a4bb67dece7765`, conservando todos os ficheiros e testes. Publicação em preparação na branch `work/field-readiness-20260915-simulation`. Sem merge, deploy ou contactos reais.
