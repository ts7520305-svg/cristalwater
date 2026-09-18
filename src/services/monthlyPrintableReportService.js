'use strict';
const { prisma } = require('../prismaClient');
const { period, documentMonthWhere } = require('./operationalValueReportService');
const projection = require('./monthlyFinancialProjection');
const { isCashPayment } = require('./cashReceiptReportService');

const clientSelect = { id:true, name:true, phone:true, email:true, address:true, pools:{select:{id:true,name:true,zone:true},orderBy:{id:'asc'}} };
async function read(monthRef, onlyRequiresInvoice) {
  const { start, end } = period({ monthRef });
  return prisma.$transaction(async db => {
    const [invoices, records] = await Promise.all([
      db.invoice.findMany({
        where:{ ...documentMonthWhere(monthRef), ...(onlyRequiresInvoice ? {requiresInvoice:true} : {}) },
        select:{ ...projection.documentSelect, id:true, clientId:true, monthRef:true, month:true, year:true, invoiceNumber:true, requiresInvoice:true, client:{select:clientSelect} },
        orderBy:{id:'asc'}
      }),
      db.payment.findMany({
        where:{ paidAt:{gte:start,lt:end}, ...(onlyRequiresInvoice ? {invoice:{requiresInvoice:true}} : {}) },
        select:{ id:true, amount:true, method:true, notes:true, paidAt:true, invoice:{select:{id:true,monthRef:true,month:true,year:true,invoiceNumber:true,client:{select:{id:true,name:true}}}} },
        orderBy:[{paidAt:'asc'},{id:'asc'}]
      })
    ]);
    const payments = records.filter(isCashPayment), financial = projection.project(invoices, payments);
    return {
      monthRef, onlyRequiresInvoice, start, end, generatedAt:new Date(), summary:financial.summary,
      clientCount:new Set(invoices.map(invoice => invoice.clientId)).size,
      documents:invoices.map((invoice, index) => ({ ...invoice, values:financial.rows[index] })),
      payments:payments.map(payment => ({ ...payment, amountCents:projection.cents(payment.amount) }))
    };
  }, {isolationLevel:'RepeatableRead',maxWait:15000,timeout:30000});
}

const text = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const money = cents => cents === null ? 'Por rever' : new Intl.NumberFormat('pt-PT', {style:'currency',currency:'EUR'}).format(cents / 100);
const date = value => new Intl.DateTimeFormat('pt-PT', {dateStyle:'short',timeStyle:'medium',timeZone:'UTC'}).format(value);
function reference(invoice) {
  if (invoice.monthRef) return invoice.monthRef;
  if (/^\d{4}-\d{2}$/.test(invoice.month || '')) return invoice.month;
  if (Number.isInteger(invoice.year) && /^(0?[1-9]|1[0-2])$/.test(invoice.month || '')) return invoice.year + '-' + invoice.month.padStart(2, '0');
  return 'Não indicada';
}
function documentCard(invoice) {
  const { values, client } = invoice;
  const excluded = values.classification === 'EXCLUDED';
  const classification = excluded ? (values.reason === 'CREDIT_DEPOSIT' ? 'Depósito de crédito - excluído dos totais documentais' : 'Excluído dos totais documentais pelo estado registado') : values.classification === 'UNKNOWN_STATUS' ? 'Estado por rever - totais documentais indisponíveis' : values.classification === 'INVALID_AMOUNT' ? 'Montantes por rever - totais documentais indisponíveis' : 'Incluído nos totais documentais';
  const amount = key => excluded ? 'Não incluído' : money(values[key]);
  return `<article class="document" data-document-id="${invoice.id}" data-classification="${values.classification}">
    <h2>${text(client.name || 'Cliente #' + client.id)}</h2>
    <p class="identity">Documento #${invoice.id}${invoice.invoiceNumber ? ' | N.º registado: ' + text(invoice.invoiceNumber) : ''} | Referência mensal: ${text(reference(invoice))}</p>
    <p>Estado registado: <strong data-field="status">${text(invoice.status || 'Não indicado')}</strong> | Requer fatura: ${invoice.requiresInvoice ? 'Sim' : 'Não'}</p>
    <p class="classification ${values.classification === 'RECEIVABLE' ? 'included' : excluded ? 'excluded' : 'review'}">${classification}</p>
    <dl class="amounts"><div><dt>Valor do documento</dt><dd data-field="amount">${text(amount('amountCents'))}</dd></div><div><dt>Liquidado registado</dt><dd data-field="paid">${text(amount('paidAmountCents'))}</dd></div><div><dt>Saldo atual</dt><dd data-field="open">${text(amount('openAmountCents'))}</dd></div></dl>
    <p class="muted">O liquidado pode incluir crédito interno e pagamentos de outros meses. O saldo é o valor atual, não o saldo no fim do mês escolhido.</p>
    <div class="registry"><h3>Ficha atual do cliente #${client.id}</h3>
      <p>Telefone: ${text(client.phone || 'Não indicado')} | Email: ${text(client.email || 'Não indicado')}<br>Morada: ${text(client.address || 'Não indicada')}</p>
      <h3>Instalações - registo atual</h3>
      ${client.pools.length ? `<table class="pools"><thead><tr><th>Instalação</th><th>Zona</th></tr></thead><tbody>${client.pools.map(pool => `<tr><td>${text(pool.name || 'Instalação #' + pool.id)}</td><td>${text(pool.zone || 'Não indicada')}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Sem instalações no registo atual.</p>'}
      <p class="muted">O cadastro atual não identifica, por si só, as instalações ou os serviços faturados neste mês.</p>
    </div>
  </article>`;
}

function html(report) {
  const { summary, monthRef } = report, documents = summary.documents, cash = summary.cash;
  const metric = (id, label, value) => `<div class="metric"><dt>${label}</dt><dd id="${id}">${text(value)}</dd></div>`;
  const unavailableDocuments = documents.amountCents === null || documents.openAmountCents === null;
  return `<!doctype html>
<html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relatório mensal - ${text(monthRef)}</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f0f5f7;color:#16313c;font:16px/1.5 Arial,sans-serif}main{max-width:1120px;margin:28px auto;padding:0 20px 32px}h1,h2,h3,p{overflow-wrap:anywhere}h1{font-size:30px;line-height:1.2;margin:8px 0}h2{font-size:21px;margin:0 0 8px}h3{font-size:16px;margin:14px 0 6px}p{margin:8px 0}.brand{color:#126a82;font-weight:bold;letter-spacing:.08em;font-size:12px}.muted,.identity{color:#506571;font-size:13px}.report-head{border-bottom:3px solid #147a92;padding-bottom:18px}.toolbar{display:flex;justify-content:flex-end;margin-bottom:14px}button{min-height:44px;max-width:100%;white-space:normal;background:#126a82;color:white;border:0;border-radius:8px;padding:11px 18px;font:700 16px Arial;cursor:pointer}button:focus-visible,.table-scroll:focus-visible{outline:3px solid #a76c00;outline-offset:3px}
.summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:22px 0 12px}.metric,.document,.cash-section,.basis{min-width:0;background:#fff;border:1px solid #c9d8df;border-radius:8px;padding:16px}.metric dt{font-size:13px;color:#506571}.metric dd{margin:6px 0 0;font-size:25px;font-weight:bold;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}.basis{font-size:14px;margin:14px 0 22px}.basis h2{font-size:16px}.document{margin:16px 0;break-inside:avoid-page}.amounts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:14px 0}.amounts dt{font-size:13px;color:#506571}.amounts dd{font-weight:bold;margin:3px 0;overflow-wrap:anywhere}.classification{padding:7px 10px;border-left:4px solid #126a82;font-size:14px;background:#edf6f8}.classification.review,.warning{border-color:#986516;background:#fff6de;color:#62430f}.classification.excluded{border-color:#77858b;background:#f0f3f4;color:#445862}.warning{border-left:4px solid #986516;padding:10px 12px;overflow-wrap:anywhere}.registry{margin-top:16px}.cash-section{margin:24px 0 0}.table-scroll{max-width:100%;overflow-x:auto}table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:13px}th,td{text-align:left;vertical-align:top;border-bottom:1px solid #d7e1e6;padding:9px 7px;overflow-wrap:anywhere}th{background:#edf4f7;color:#274753}thead{display:table-header-group}.cash-table{min-width:720px}.cash-table .number{text-align:right;font-variant-numeric:tabular-nums}.notes{white-space:pre-wrap;max-width:min(70ch,calc(100vw - 90px))}.receipt-notes td{padding-top:4px;padding-bottom:14px}.empty{border:1px dashed #adbdc5;border-radius:8px;padding:18px;background:#fff}.closing{font-size:12px;color:#506571;margin-top:20px}p{orphans:3;widows:3}h2,h3{break-after:avoid-page}
@media(max-width:640px){main{padding:0 14px 24px;margin:18px auto}h1{font-size:26px}.summary{grid-template-columns:repeat(2,minmax(0,1fr))}.amounts{grid-template-columns:1fr}.metric dd{font-size:22px}}
@media(max-width:380px){.summary{grid-template-columns:1fr}.toolbar{justify-content:stretch}.toolbar button{width:100%}}
@page{size:A4;margin:14mm;@bottom-left{content:"Cristal Water | ${text(monthRef)}";font:8pt Arial;color:#506571}@bottom-right{content:counter(page) " / " counter(pages);font:8pt Arial;color:#506571}}
@media print{body{background:#fff;font-size:10pt;line-height:1.4}main{max-width:none;margin:0;padding:0}.toolbar{display:none}h1{font-size:22pt}h2{font-size:15pt}h3{font-size:11pt}.summary{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:14px}.metric,.document,.cash-section,.basis{border-radius:0;padding:10px}.metric dd{font-size:17pt}.metric dt,.muted,.identity,.amounts dt,.closing{font-size:9pt}.basis,.classification{font-size:9pt}.amounts{grid-template-columns:repeat(3,minmax(0,1fr))}.table-scroll{overflow:visible}.cash-table{min-width:0}table{font-size:8.5pt}th,td{padding:6px 5px}.cash-section{break-inside:auto}.cash-section>p{break-after:avoid-page}.cash-section tr,.cash-table tbody{break-inside:auto}.cash-table tr:not(.receipt-notes){break-after:avoid-page}.notes{max-width:none}a{color:inherit;text-decoration:none}}
</style></head><body><main data-report-version="2">
<div class="toolbar"><button type="button" onclick="window.print()">Imprimir / Guardar PDF</button></div>
<header class="report-head"><div class="brand">CRISTAL WATER</div><h1>Relatório mensal - ${text(monthRef)}</h1><p>${report.onlyRequiresInvoice ? 'Filtro: apenas documentos marcados como «Requer fatura» e recebimentos associados a documentos com essa marca.' : 'Filtro: todos os documentos e recebimentos do período, segundo as fontes abaixo.'}</p><p class="muted">Consulta gerada em ${text(date(report.generatedAt))} UTC. Valores em EUR.</p></header>
<dl class="summary">
${metric('metric-client-count','Clientes nos documentos do mês',report.clientCount)}${metric('metric-document-count','Documentos do mês',documents.total)}${metric('metric-document-amount','Valor dos documentos cobráveis',money(documents.amountCents))}${metric('metric-current-open','Saldo atual desses documentos',money(documents.openAmountCents))}${metric('metric-cash-amount','Recebimentos registados no mês',money(cash.amountCents))}${metric('metric-payment-count','Registos de recebimento',cash.paymentCount)}
</dl>
<div class="basis"><h2>Como ler os valores</h2><p>Documentos: referência mensal guardada, incluindo os formatos históricos. ${documents.receivableCount} com estado de cobrança reconhecido; ${documents.excludedCount} excluídos; ${documents.unknownStatusCount} com estado por rever; ${documents.invalidAmountCount} com montantes por rever.</p><p>O valor documental e o saldo usam os registos atuais. Não representam um fecho histórico. Rascunhos, documentos retirados da cobrança e depósitos de crédito não entram nesses totais.</p><p>Recebimentos: data registada entre ${text(report.start.toISOString())} (incluída) e ${text(report.end.toISOString())} (excluída), em UTC. Incluem recebimentos de documentos de outros meses e depósitos pagos. Aplicações e ajustes de crédito interno ficam excluídos.</p><p>A marca «Requer fatura» é a do documento, não a preferência atual do cliente. No filtro ativo, a mesma marca rege os documentos e os recebimentos; o mês do documento não limita os recebimentos.</p></div>
${unavailableDocuments ? '<p class="warning" role="status" id="document-review">Totais documentais por rever. Existem estados ou montantes que não permitem apresentar um total confirmado, ou a soma excede o limite de cálculo. Os documentos válidos continuam identificados abaixo.</p>' : ''}
${cash.amountCents === null ? '<p class="warning" role="status" id="cash-review">Total de recebimentos por rever. Existem montantes inválidos ou a soma excede o limite de cálculo. Não foi apresentado um total parcial como total do mês.</p>' : ''}
<section aria-label="Documentos do mês">${report.documents.length ? report.documents.map(documentCard).join('') : '<p class="empty" id="empty-documents">Sem documentos para este mês e filtro.</p>'}</section>
<section class="cash-section" aria-labelledby="cash-heading"><h2 id="cash-heading">Recebimentos do mês</h2><p class="muted">Lista independente dos documentos acima, por data de recebimento (UTC). O estado atual de um documento não apaga um recebimento registado.</p>
${report.payments.length ? `<div class="table-scroll" role="region" aria-label="Tabela de recebimentos" tabindex="0"><table class="cash-table"><colgroup><col style="width:16%"><col style="width:30%"><col style="width:18%"><col style="width:18%"><col style="width:18%"></colgroup><thead><tr><th>Data (UTC)</th><th>Cliente atual</th><th>Documento</th><th>Método</th><th class="number">Valor</th></tr></thead>${report.payments.map(payment => `<tbody data-payment-id="${payment.id}"><tr><td>${text(date(payment.paidAt))}</td><td>${text(payment.invoice.client.name || 'Cliente #' + payment.invoice.client.id)}</td><td>#${payment.invoice.id}<br>${text(reference(payment.invoice))}</td><td>${text(payment.method || 'Não indicado')}</td><td class="number" data-field="amount">${text(money(payment.amountCents))}</td></tr>${payment.notes ? `<tr class="receipt-notes"><td colspan="5"><strong>Notas do recebimento #${payment.id}</strong><div class="notes">${text(payment.notes)}</div></td></tr>` : ''}</tbody>`).join('')}</table></div>` : '<p class="empty" id="empty-payments">Sem recebimentos registados para este mês e filtro.</p>'}
</section><p class="closing">Contactos, nomes e instalações refletem a ficha atual do cliente. A leitura do relatório não altera documentos, pagamentos ou configurações.</p>
</main></body></html>`;
}
module.exports = { read, html };
