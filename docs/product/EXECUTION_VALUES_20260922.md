# TASK295 — valores por mês de execução

## Resultado e âmbito

A Gestão com IA apresenta receitas líquidas documentadas e custos conhecidos pelo mês de execução (UTC). A consulta ADMIN `/api/ai-admin/execution-values` permite pesquisar e percorrer todos os serviços elegíveis, com listas separadas e paginadas das origens de receita e custo. A consulta não altera documentos, notas, pagamentos, despesas, stock ou decisões comerciais. Os mesmos dados integram o resumo financeiro e as respostas locais/contexto do modelo.

O conjunto inclui serviços com origem documental elegível de receita ou despesa atribuída e período de execução confirmável. Não é um inventário de todos os serviços executados. A cobertura de custos existente continua a mostrar visitas com medições ou valorizações em falta. Serviços sem origem elegível, custos gerais e atribuições apenas ao cliente não são distribuídos artificialmente.

Identidade do serviço: tipo, identificador e cliente original. Visitas regulares e extra com o mesmo número permanecem distintas. Manutenções de equipamento, lembretes e reparações usam as suas provas de execução e não herdam os custos de uma visita. Mensalidades usam parcelas explicitamente confirmadas, conforme o contrato e época; não existe divisão automática pelo número de visitas.

## Valores e períodos

- Receitas: fontes atuais de documentos de todos os meses, selecionadas pelo mês de execução comprovado. O mês do documento continua visível. Reparações exigem a declaração de execução existente; a data da fatura não a substitui.
- Líquido por serviço: confirmado apenas quando todas as notas do documento estão válidas e totalmente atribuídas. Zero líquido confirmado é conservado; ausência de receita ou notas ainda por resolver produzem valor por confirmar.
- Totais: bruto = bruto confirmado + bruto pendente; líquido confirmado = bruto confirmado − redução confirmada. O bruto pendente não é tratado como líquido.
- Custos: apenas atribuições existentes de serviços com período verificável. Materiais valorizados, tempo valorizado e outras despesas manuais confirmadas constituem custos parciais conhecidos. Uma atribuição manual de compra de stock fica separada do consumo; atribuído confirmado = custo conhecido + compra atribuída.
- Período divergente: conserva os meses de atribuição e execução, apresenta o montante separadamente e exclui-o dos custos alinhados. Não há mudança automática de mês. Mudança do serviço, cliente, datas ou fotografia da origem bloqueia a confirmação afetada; uma despesa anulada permanece identificada como revisão enquanto tiver atribuições ativas.
- Custos sem período confirmável e revisões de documentos, linhas, execução de reparações, parcelas mensais, notas e custos são contados em todos os meses. A ausência de um custo registado não significa custo zero.

`finance.executionValues` tem versão 1; `revenueCoverage` conserva a versão 7 e o seu mês documental. Os dois relatórios reutilizam as fontes dentro da mesma transação `RepeatableRead`. Cada consulta paginada é uma nova fotografia, datada, com totais completos independentemente da pesquisa ou página. As amostras de dez no contexto da IA são explícitas; a interface permite percorrer a lista completa.

Receita completa, custos completos e margem permanecem por apurar. Esta consulta não representa recebimentos, saldo bancário ou fecho histórico. Não somar novamente estes valores aos documentos, pagamentos ou quadros de atribuição. IVA e faturação fiscal continuam no programa externo.

## Interface, leitura e privacidade

Pesquisa, paginação e abertura de origens verificam período, seleção, identidade tipada, contagens, amostras, estados e equações antes de apresentar valores. Respostas incompletas ou incompatíveis limpam os valores da consulta afetada. Geração da página e revisão da consulta impedem respostas antigas após alterações A–B–A. Mudança de sessão, BFCache e indisponibilidade de rede retiram a nova consulta; o utilizador volta a consultar para a repor. Conteúdo livre é apresentado literalmente.

Foi reproduzida e corrigida uma falha da TASK294: `financeCreditAllocationRows` não fazia parte da limpeza comum da Gestão com IA. Os nomes e valores líquidos antigos podiam permanecer após resposta inválida ou mudança de sessão. O teste existente falhou antes da correção e passou depois, com asserções explícitas para esses dados. Foi também ativada a ligação da recomendação para a página de atribuição das notas.

## Validação local

- Dois novos grupos API/navegador: períodos distintos, origem mensal/manutenção/reparação, identidade e cliente, notas pendentes e líquido zero, custos materiais/trabalho, compras separadas, divergências, alteração de fonte/data e anulação, autorização ADMIN ativa e falhas das fontes sem zeros nem mensagens privadas.
- Totais de 17 serviços no ensaio API, incluindo duas identidades com o mesmo número; 14 origens de custo de um serviço percorridas em duas páginas. Pesquisa e amostras não truncam totais. Provas de leitura sem escrita em documentos, pagamentos, atribuições e eventos.
- Navegador real: 320/390/1440, modo escuro/contraste, conteúdo literal, identidades/seleções/somas adulteradas, pesquisa, páginas, origens, A–B–A do mês e pesquisa, timeout e recuperação, offline, BFCache e mudança transitória de sessão. Apresentação móvel e desktop inspecionada.
- Regressões de atribuição/conciliação de notas, mensalidades, custos medidos, cobertura documental e IA financeira aprovadas. Logs `/tmp/cw295-regressions.log`, `/tmp/cw295-ui.log` e `/tmp/cw295-final.log`. Reprodução inicial da limpeza: `/tmp/cw295-net-clearing-reproduction.log`.
- 401 testes unitários em 64 ficheiros. Sintaxe: 590 backend, 194 frontend, 60 inline. Runner com 189 grupos distintos. Cache v110, sem esquema, migração ou dependência nova; continuam 27 migrações.
- Timeout do job completo aumentado de 25 para 30 minutos: a execução anterior durou 22m39s e foram acrescentados dois grupos. Nenhuma etapa, asserção ou limite de consulta foi removido.

Publicação e execução nativa PostgreSQL 16/restauro serão registadas abaixo após confirmação do CI desta versão. Validação local não equivale a aprovação de produção, dimensionamento ou piloto físico.

## Próximo âmbito

Restantes ajustes/descontos e origens de receita; custos de reparações e restantes gastos, base composta de trabalho e correção explícita das divergências de período. A vista implementada permite inspecionar valores parciais por execução, mas não elimina estas lacunas nem autoriza margens completas. Mantêm-se revisão de históricos/apresentação, volume, VPS/fornecedores e piloto físico como âmbitos separados.
