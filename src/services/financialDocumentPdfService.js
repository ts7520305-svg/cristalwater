'use strict';
const { line, section, paragraph, tableRows } = require('./documentPdfService');
const notice = 'Documento interno (não fiscal). A fatura fiscal, quando aplicável, é emitida externamente.';
function unreadable() { throw Object.assign(Error('O documento contém dados incompletos ou inválidos. Peça revisão ao escritório.'), { status: 409, statusCode: 409 }); }
function cents(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isSafeInteger(Math.round(value * 100))) unreadable();
  return Math.round(value * 100);
}
function money(value) { return `€ ${(cents(value) / 100).toFixed(2)}`; }
function date(value) {
  if (value == null || value === '') return '-';
  const stamp = new Date(value);
  if (!Number.isFinite(+stamp)) unreadable();
  return stamp.toLocaleDateString('pt-PT', { timeZone: 'Europe/Lisbon' });
}
function invoiceBlocks(invoice) {
  if (!Array.isArray(invoice.lines)) unreadable();
  const blocks = [];
  paragraph(blocks, notice);
  line(blocks, 'Documento', '#' + invoice.id);
  line(blocks, 'Cliente', invoice.client?.name);
  line(blocks, 'Mês', invoice.monthRef);
  line(blocks, 'Estado registado', invoice.status);
  section(blocks, 'Serviços');
  tableRows(blocks, invoice.lines.map(item => ({ title: item.description, meta: money(item.total) })), 'Sem linhas de serviço registadas. Os valores do resumo são os do documento guardado.');
  section(blocks, 'Resumo do documento guardado');
  line(blocks, 'Total', money(invoice.total));
  line(blocks, 'Pago', money(invoice.amountPaid));
  line(blocks, 'Em aberto', money(invoice.amountOpen));
  return blocks;
}
function extrasBlocks(extras) {
  if (!Array.isArray(extras) || !extras.length) unreadable();
  const blocks = []; let total = 0;
  paragraph(blocks, notice);
  paragraph(blocks, 'Visitas extra concluídas, com valor a cobrar e ainda sem reserva num documento interno. Esta consulta não confirma faturação nem pagamento.');
  line(blocks, 'Cliente', extras[0].pool?.client?.name);
  section(blocks, 'Serviços extra pendentes');
  tableRows(blocks, extras.map(extra => {
    total += cents(extra.price);
    if (!Number.isSafeInteger(total)) unreadable();
    return { title: `${date(extra.scheduledAt)} — ${extra.pool?.name || '-'}`, meta: `Visita #${extra.id} · ${money(extra.price)}` };
  }), 'Sem extras.');
  section(blocks, 'Total');
  line(blocks, 'Valor dos extras apresentados', money(total / 100));
  return blocks;
}
function repairBlocks(repair, latest) {
  const blocks = [], quote = latest?.snapshot;
  if (latest && (!quote || !Array.isArray(quote.lines) || !quote.lines.length)) unreadable();
  paragraph(blocks, 'Orçamento / estimativa. Documento não fiscal; não comprova execução nem pagamento.');
  section(blocks, 'Dados do cliente');
  line(blocks, 'Cliente', repair.pool?.client?.name);
  line(blocks, 'Telefone', repair.pool?.client?.phone);
  line(blocks, 'Morada', repair.pool?.client?.address);
  line(blocks, 'Piscina', repair.pool?.name);
  line(blocks, 'Local', repair.pool?.location);
  section(blocks, 'Detalhes da reparação');
  line(blocks, 'ID da reparação', repair.id);
  line(blocks, 'Problema', repair.problem);
  line(blocks, 'Quantidade', repair.quantity);
  line(blocks, 'Prioridade', repair.priority);
  line(blocks, 'Estado', repair.status);
  line(blocks, 'Data', date(repair.createdAt));
  section(blocks, 'Valores');
  if (quote) {
    if (!Number.isInteger(latest.version) || latest.version < 1 || typeof quote.taxPercent !== 'number' || !Number.isFinite(quote.taxPercent)) unreadable();
    tableRows(blocks, quote.lines.map(item => {
      if (typeof item.quantity !== 'number' || !Number.isFinite(item.quantity)) unreadable();
      return { title: item.description, meta: `${item.quantity} × ${money(item.unitPrice)} = ${money(item.total)}` };
    }), 'Sem linhas.');
    line(blocks, 'Desconto', money(quote.discount));
    line(blocks, 'Subtotal sem IVA', money(quote.net));
    line(blocks, `IVA (${quote.taxPercent}%)`, money(quote.tax));
    line(blocks, 'Total', money(quote.total));
    line(blocks, 'Versão', latest.version);
    line(blocks, 'Válido até', date(quote.validUntil));
    if (quote.terms) { section(blocks, 'Condições'); paragraph(blocks, quote.terms); }
  } else {
    line(blocks, 'Preço unitário', repair.unitPrice == null ? 'Por rever' : money(repair.unitPrice));
    line(blocks, 'Total sem IVA', repair.totalPrice == null ? 'Por rever' : money(repair.totalPrice));
    paragraph(blocks, 'Estimativa antiga. Rever os valores no editor de orçamento detalhado.');
  }
  // Internal notes, purchase costs and margins are not customer quotation data.
  return blocks;
}
module.exports = { invoiceBlocks, extrasBlocks, repairBlocks };
