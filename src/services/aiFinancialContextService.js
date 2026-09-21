'use strict';
const { prisma } = require('../prismaClient');
const cash = require('./cashReceiptReportService');
const projection = require('./monthlyFinancialProjection');
const { period, documentMonthWhere } = require('./operationalValueReportService');

const unavailable = ['OPERATING_EXPENSES', 'PROFIT', 'BANK_BALANCE', 'CASHFLOW_FORECAST'];
const euro = cents => cents === null ? 'por confirmar' : new Intl.NumberFormat('pt-PT', { style:'currency', currency:'EUR' }).format(cents / 100);
function month(value) { return period(value === undefined ? {} : { monthRef:value }).monthRef; }

async function snapshot(monthRef) {
  const selected = month(monthRef), range = period({ monthRef:selected });
  const generatedAt = new Date(), day = new Date(generatedAt.toISOString().slice(0,10) + 'T00:00:00Z');
  const base = { version:1, monthRef:selected, currency:'EUR', generatedAt:generatedAt.toISOString(), period:{ start:range.start.toISOString(), end:range.end.toISOString(), timeZone:'UTC' }, unavailable, historicalClosingBalance:false, limitApplied:null };
  try {
    return await prisma.$transaction(async db => {
      const [payments, monthly, invoices, clients, expenses] = await Promise.all([
        cash.payments(selected, db),
        db.invoice.findMany({ where:documentMonthWhere(selected), select:projection.documentSelect }),
        db.invoice.findMany({ select:{ ...projection.documentSelect, id:true, clientId:true, dueDate:true, client:{ select:{ name:true } } } }),
        db.client.findMany({ select:{ creditBalance:true } }),
        require('./expenseLedgerService').summary(db, selected, generatedAt)
      ]);
      const selectedProjection = projection.project(monthly, payments).summary, allProjection = projection.project(invoices, []).summary.documents;
      const groups = new Map(), balances = [], overdue = [];
      let invoiceCount = 0, overdueCount = 0, missingDueDateCount = 0;
      for (const row of invoices) {
        const value = projection.document(row);
        if (value.classification !== 'RECEIVABLE' || value.openAmountCents <= 0) continue;
        balances.push(value.openAmountCents); invoiceCount++;
        const late = row.dueDate && row.dueDate < day;
        if (late) { overdue.push(value.openAmountCents); overdueCount++; }
        if (!row.dueDate) missingDueDateCount++;
        if (!groups.has(row.clientId)) groups.set(row.clientId, { clientId:row.clientId, name:row.client.name, invoiceCount:0, amounts:[], overdue:[] });
        const group = groups.get(row.clientId); group.invoiceCount++; group.amounts.push(value.openAmountCents); if (late) group.overdue.push(value.openAmountCents);
      }
      const known = allProjection.unknownStatusCount === 0 && allProjection.invalidAmountCount === 0 && allProjection.openAmountCents !== null;
      const creditValues = clients.map(row => projection.cents(row.creditBalance)), creditCents = projection.sum(creditValues);
      const topClients = [...groups.values()].map(row => ({ clientId:row.clientId, name:row.name, invoiceCount:row.invoiceCount, amountCents:projection.sum(row.amounts), overdueAmountCents:projection.sum(row.overdue) })).sort((a,b) => (b.amountCents || 0) - (a.amountCents || 0) || a.clientId-b.clientId).slice(0,10);
      const review = !known || creditCents === null || selectedProjection.cash.amountCents === null || selectedProjection.documents.amountCents === null || selectedProjection.documents.openAmountCents === null;
      return { ...base, expenses, state:review || expenses.state === 'REVIEW' || expenses.attribution.state === 'REVIEW' ? 'REVIEW' : 'READY',
        cash:{ ...selectedProjection.cash, basis:'PAYMENT_PAID_AT_UTC', internalCreditIncluded:false },
        monthDocuments:selectedProjection.documents,
        receivables:{ amountCents:known ? projection.sum(balances) : null, overdueAmountCents:known ? projection.sum(overdue) : null, invoiceCount:known ? invoiceCount : null, overdueCount:known ? overdueCount : null, missingDueDateCount, clientCount:groups.size, topClients, topLimit:10, sampleOnly:groups.size>10, basis:'CURRENT_DOCUMENT_BALANCE', asOf:generatedAt.toISOString(), reviewCount:allProjection.unknownStatusCount + allProjection.invalidAmountCount },
        customerCredit:{ amountCents:creditCents, basis:'CURRENT_CUSTOMER_CREDIT_LIABILITY', invalidCount:creditValues.filter(v=>v===null).length },
        sourceUnavailable:false
      };
    }, { isolationLevel:'RepeatableRead', maxWait:15000, timeout:30000 });
  } catch (_) {
    return { ...base, state:'UNAVAILABLE', cash:null, monthDocuments:null, receivables:null, customerCredit:null, expenses:null, sourceUnavailable:true };
  }
}

function recommendations(finance) {
  if (!finance || finance.state === 'UNAVAILABLE') return [{ code:'SOURCE_UNAVAILABLE', title:'Confirmar a ligação aos dados', explanation:'A consulta financeira falhou. Não é possível concluir que os valores são zero.', href:'/admin-reports' }];
  const items = [];
  const attribution = finance.expenses?.attribution;
  if (attribution?.reviewCount > 0) items.push({code:'REVIEW_COST_ATTRIBUTION',title:'Rever atribuições de custos',explanation:`Há ${attribution.reviewCount} atribuições cujo documento ou destinatário mudou. Confirme o cliente, serviço e mês.`,href:'/admin-expenses'});
  if (attribution?.unallocatedExpenseCount > 0) items.push({code:'COMPLETE_COST_ATTRIBUTION',title:'Completar a atribuição das despesas',explanation:`Há ${attribution.unallocatedExpenseCount} despesas com valor ainda por atribuir. Valide a repartição por cliente, serviço ou custos gerais, sem duplicar compras e consumo.`,href:'/admin-expenses'});
  if (finance.expenses?.reviewCount > 0) items.push({code:'REVIEW_EXPENSE_SOURCES',title:'Rever despesas com origens alteradas',explanation:`Há ${finance.expenses.reviewCount} despesas cujas fontes ou valores precisam de revisão. Os totais afetados estão por confirmar.`,href:'/admin-expenses'});
  if (finance.expenses?.overdueAmountCents > 0) items.push({code:'REVIEW_PAYABLES',title:'Rever contas a pagar vencidas',explanation:`As despesas registadas têm ${euro(finance.expenses.overdueAmountCents)} atualmente vencidos. Confirme os pagamentos já efetuados antes de decidir.`,href:'/admin-expenses'});
  if (finance.state === 'REVIEW') items.push({ code:'REVIEW_DATA', title:'Rever os registos por confirmar', explanation:'Existem montantes ou estados que precisam de revisão. Os totais afetados ficam por confirmar.', href:'/admin-reports' });
  if (finance.receivables.overdueCount > 0) items.push({ code:'REVIEW_OVERDUE', title:'Priorizar cobranças vencidas', explanation:`Há ${finance.receivables.overdueCount} documentos vencidos, num total atual de ${euro(finance.receivables.overdueAmountCents)}. Confirme os recebimentos antes de contactar os clientes.`, href:'/admin-collection' });
  if (finance.receivables.missingDueDateCount > 0) items.push({ code:'REVIEW_DUE_DATES', title:'Completar as datas de vencimento', explanation:`Há ${finance.receivables.missingDueDateCount} documentos com saldo identificado sem data de vencimento. Não foram classificados como atrasados.`, href:'/invoices' });
  if (finance.customerCredit.amountCents > 0) items.push({ code:'REVIEW_CUSTOMER_CREDIT', title:'Considerar os créditos dos clientes', explanation:`O saldo de crédito atual é ${euro(finance.customerCredit.amountCents)}. É um compromisso com os clientes e não deve ser contado novamente como dinheiro recebido.`, href:'/admin-collection' });
  items.push({ code:'COMPLETE_COSTS', title:'Completar os custos antes de decidir sobre margens', explanation:'Faltam custos completos e conciliados: químicos, materiais, mão de obra, viaturas e despesas gerais. Não é possível apurar lucro, saldo bancário ou prever tesouraria só com estes recebimentos.', href:'/admin-reports' });
  return items;
}

function localAnswer(message, finance) {
  if (!finance || finance.state === 'UNAVAILABLE') return 'Não consegui consultar os dados financeiros. Não vou apresentar valores zero nem concluir que não há dívidas. Volte a consultar antes de decidir.';
  const text = String(message || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const parts = [`Mês selecionado: ${finance.monthRef} (UTC). Recebimentos registados nesse mês: ${euro(finance.cash.amountCents)}. Os créditos internos não são contados como novas entradas.`,
    `Saldo atualmente por cobrar: ${euro(finance.receivables.amountCents)}; vencido: ${euro(finance.receivables.overdueAmountCents)}. Estes saldos abrangem todos os meses e foram consultados em ${finance.generatedAt}. Não representam o fecho histórico do mês selecionado.`];
  if (/dev|divid|cobran|client|priorid/.test(text) && finance.receivables.topClients.length) {
    parts.push('Clientes com maiores saldos identificados' + (finance.state==='REVIEW' ? ' (lista parcial, há registos por rever)' : '') + ':\n' + finance.receivables.topClients.map(row => `${row.name} (#${row.clientId}): ${euro(row.amountCents)}.`).join('\n') + (finance.receivables.sampleOnly ? '\nA lista mostra apenas os dez maiores saldos; os totais incluem todos os documentos.' : ''));
  }
  if (/lucr|marg|cust|despes|quimic|tesour|caixa|banco|gast|poup|previ|rentab|otimiz|optimiz/.test(text)) parts.push('Ainda não tenho custos completos, despesas conciliadas e saldo bancário. Não posso calcular lucro, margem real, poupança ou uma previsão de tesouraria. Os recebimentos, isoladamente, não medem o lucro.');
  if (finance.expenses && /cust|despes|pag|tesour|caixa|gast|fornec/.test(text)) parts.push(`Despesas registadas com data de documento no mês: ${euro(finance.expenses.documentAmountCents)}. Pagamentos registados nesse mês: ${euro(finance.expenses.paymentsAmountCents)}. Contas atualmente por pagar, de todos os meses: ${euro(finance.expenses.openAmountCents)}; vencidas: ${euro(finance.expenses.overdueAmountCents)}. Estes valores cobrem apenas o registo de despesas, sem conciliação bancária nem apuramento dos custos totais. Comprar stock não é o mesmo que consumi-lo. Anular um registo de pagamento é uma correção e não uma devolução de dinheiro.`);
  if (finance.expenses?.attribution && /client|servi|cust|despes|atribu|rent|marg/.test(text)) { const c = finance.expenses.attribution; parts.push(`Despesas atribuídas no mês: ${euro(c.allocatedAmountCents)}, das quais ${euro(c.clientAmountCents)} a clientes e serviços e ${euro(c.companyAmountCents)} a custos gerais. Valor atualmente por atribuir, de todos os meses: ${euro(c.unallocatedAmountCents)}. A atribuição usa o mês confirmado pela administração; não é uma nova despesa nem um segundo pagamento. Uma compra de stock atribuída não comprova consumo. Estes valores não estabelecem o custo completo ou a rentabilidade por cliente.`); if (c.topClients.length) parts.push('Clientes com atribuições registadas' + (c.sampleOnly ? ' (amostra de dez, sem truncar os totais)' : '') + ':\n' + c.topClients.map(row => `${row.label} (#${row.clientId}): ${euro(row.amountCents)}${row.reviewCount ? ' — por rever' : ''}.`).join('\n')); }
  if (/sistema|software|aplicac|automat/.test(text)) parts.push('Neste contexto consigo identificar melhorias nos registos financeiros. Não tenho medições de desempenho, falhas ou segurança do servidor para diagnosticar o sistema.');
  if (finance.state === 'REVIEW') parts.push('Há dados por rever. Os valores afetados permanecem por confirmar; os saldos identificados não substituem um total completo.');
  return parts.join('\n\n');
}
module.exports = { snapshot, month, recommendations, localAnswer };
