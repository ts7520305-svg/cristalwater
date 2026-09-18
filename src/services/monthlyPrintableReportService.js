'use strict';
const { prisma } = require('../prismaClient');
const { period, documentMonthWhere } = require('./operationalValueReportService');
const projection = require('./monthlyFinancialProjection');
const { isCashPayment } = require('./cashReceiptReportService');

const { presentation, language } = require('./monthlyReportLanguage');

const clientSelect = { id:true, name:true, phone:true, email:true, address:true, pools:{select:{id:true,name:true,zone:true},orderBy:{id:'asc'}} };
async function read(monthRef, onlyRequiresInvoice, rawLanguage) {
  const lang = language(rawLanguage);
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
      monthRef, onlyRequiresInvoice, language: lang, start, end, generatedAt:new Date(), summary:financial.summary,
      clientCount:new Set(invoices.map(invoice => invoice.clientId)).size,
      documents:invoices.map((invoice, index) => ({ ...invoice, values:financial.rows[index] })),
      payments:payments.map(payment => ({ ...payment, amountCents:projection.cents(payment.amount) }))
    };
  }, {isolationLevel:'RepeatableRead',maxWait:15000,timeout:30000});
}

const text = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
function reference(invoice, t) {
  if (invoice.monthRef) return invoice.monthRef;
  if (/^\d{4}-\d{2}$/.test(invoice.month || '')) return invoice.month;
  if (Number.isInteger(invoice.year) && /^(0?[1-9]|1[0-2])$/.test(invoice.month || '')) return invoice.year + '-' + invoice.month.padStart(2, '0');
  return t('notGivenF');
}
function documentCard(invoice, display) {
  const { t, money } = display, label = key => text(t(key));
  const { values, client } = invoice;
  const excluded = values.classification === 'EXCLUDED';
  const classification = excluded ? (values.reason === 'CREDIT_DEPOSIT' ? t('creditExcluded') : t('statusExcluded')) : values.classification === 'UNKNOWN_STATUS' ? t('statusReview') : values.classification === 'INVALID_AMOUNT' ? t('amountReview') : t('included');
  const amount = key => excluded ? t('notIncluded') : money(values[key]);
  return `<article class="document" data-document-id="${invoice.id}" data-classification="${values.classification}">
    <h2>${text(client.name || t('clientPrefix') + client.id)}</h2>
    <p class="identity">${label('documentPrefix')}${invoice.id}${invoice.invoiceNumber ? ' | ' + label('registeredNumber') + ' ' + text(invoice.invoiceNumber) : ''} | ${label('monthReference')} ${text(reference(invoice, t))}</p>
    <p>${label('recordedStatus')} <strong data-field="status">${text(invoice.status || t('notGiven'))}</strong> | ${label('requiresInvoice')} ${invoice.requiresInvoice ? t('yes') : t('no')}</p>
    <p class="classification ${values.classification === 'RECEIVABLE' ? 'included' : excluded ? 'excluded' : 'review'}">${text(classification)}</p>
    <dl class="amounts"><div><dt>${label('documentAmount')}</dt><dd data-field="amount">${text(amount('amountCents'))}</dd></div><div><dt>${label('paidAmount')}</dt><dd data-field="paid">${text(amount('paidAmountCents'))}</dd></div><div><dt>${label('openAmount')}</dt><dd data-field="open">${text(amount('openAmountCents'))}</dd></div></dl>
    <p class="muted">${label('balanceNotice')}</p>
    <div class="registry"><h3>${label('currentClient')}${client.id}</h3>
      <p>${label('phone')} ${text(client.phone || t('notGiven'))} | ${label('email')} ${text(client.email || t('notGiven'))}<br>${label('address')} ${text(client.address || t('notGivenF'))}</p>
      <h3>${label('currentPools')}</h3>
      ${client.pools.length ? `<table class="pools"><thead><tr><th>${label('pool')}</th><th>${label('zone')}</th></tr></thead><tbody>${client.pools.map(pool => `<tr><td>${text(pool.name || t('poolPrefix') + pool.id)}</td><td>${text(pool.zone || t('notGivenF'))}</td></tr>`).join('')}</tbody></table>` : `<p class="muted">${label('noPools')}</p>`}
      <p class="muted">${label('registryNotice')}</p>
    </div>
  </article>`;
}

function html(report) {
  const display = presentation(report.language), { lang, t, money, date } = display;
  const label = (key, params) => text(t(key, params));
  const { summary, monthRef } = report, documents = summary.documents, cash = summary.cash;
  const metric = (id, label, value) => `<div class="metric"><dt>${text(t(label))}</dt><dd id="${id}">${text(value)}</dd></div>`;
  const unavailableDocuments = documents.amountCents === null || documents.openAmountCents === null;
  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${label('title')} - ${text(monthRef)}</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f0f5f7;color:#16313c;font:16px/1.5 Arial,sans-serif}main{max-width:1120px;margin:28px auto;padding:0 20px 32px}h1,h2,h3,p{overflow-wrap:anywhere}h1{font-size:30px;line-height:1.2;margin:8px 0}h2{font-size:21px;margin:0 0 8px}h3{font-size:16px;margin:14px 0 6px}p{margin:8px 0}.brand{color:#126a82;font-weight:bold;letter-spacing:.08em;font-size:12px}.muted,.identity{color:#506571;font-size:13px}.report-head{border-bottom:3px solid #147a92;padding-bottom:18px}.toolbar{display:flex;justify-content:flex-end;margin-bottom:14px}button{min-height:44px;max-width:100%;white-space:normal;background:#126a82;color:white;border:0;border-radius:8px;padding:11px 18px;font:700 16px Arial;cursor:pointer}button:focus-visible,.table-scroll:focus-visible{outline:3px solid #a76c00;outline-offset:3px}
.summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:22px 0 12px}.metric,.document,.cash-section,.basis{min-width:0;background:#fff;border:1px solid #c9d8df;border-radius:8px;padding:16px}.metric dt{font-size:13px;color:#506571}.metric dd{margin:6px 0 0;font-size:25px;font-weight:bold;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}.basis{font-size:14px;margin:14px 0 22px}.basis h2{font-size:16px}.document{margin:16px 0;break-inside:avoid-page}.amounts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:14px 0}.amounts dt{font-size:13px;color:#506571}.amounts dd{font-weight:bold;margin:3px 0;overflow-wrap:anywhere}.classification{padding:7px 10px;border-left:4px solid #126a82;font-size:14px;background:#edf6f8}.classification.review,.warning{border-color:#986516;background:#fff6de;color:#62430f}.classification.excluded{border-color:#77858b;background:#f0f3f4;color:#445862}.warning{border-left:4px solid #986516;padding:10px 12px;overflow-wrap:anywhere}.registry{margin-top:16px}.cash-section{margin:24px 0 0}.table-scroll{max-width:100%;overflow-x:auto}table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:13px}th,td{text-align:left;vertical-align:top;border-bottom:1px solid #d7e1e6;padding:9px 7px;overflow-wrap:anywhere}th{background:#edf4f7;color:#274753}thead{display:table-header-group}.cash-table{min-width:720px}.cash-table .number{text-align:right;font-variant-numeric:tabular-nums}.notes{white-space:pre-wrap;max-width:min(70ch,calc(100vw - 90px))}.receipt-notes td{padding-top:4px;padding-bottom:14px}.empty{border:1px dashed #adbdc5;border-radius:8px;padding:18px;background:#fff}.closing{font-size:12px;color:#506571;margin-top:20px}p{orphans:3;widows:3}h2,h3{break-after:avoid-page}
@media(max-width:640px){main{padding:0 14px 24px;margin:18px auto}h1{font-size:26px}.summary{grid-template-columns:repeat(2,minmax(0,1fr))}.amounts{grid-template-columns:1fr}.metric dd{font-size:22px}}
@media(max-width:380px){.summary{grid-template-columns:1fr}.toolbar{justify-content:stretch}.toolbar button{width:100%}}
@page{size:A4;margin:14mm;@bottom-left{content:"Cristal Water | ${text(monthRef)}";font:8pt Arial;color:#506571}@bottom-right{content:counter(page) " / " counter(pages);font:8pt Arial;color:#506571}}
@media print{body{background:#fff;font-size:10pt;line-height:1.4}main{max-width:none;margin:0;padding:0}.toolbar{display:none}h1{font-size:22pt}h2{font-size:15pt}h3{font-size:11pt}.summary{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:14px}.metric,.document,.cash-section,.basis{border-radius:0;padding:10px}.metric dd{font-size:17pt}.metric dt,.muted,.identity,.amounts dt,.closing{font-size:9pt}.basis,.classification{font-size:9pt}.amounts{grid-template-columns:repeat(3,minmax(0,1fr))}.table-scroll{overflow:visible}.cash-table{min-width:0}table{font-size:8.5pt}th,td{padding:6px 5px}.cash-section{break-inside:auto}.cash-section>p{break-after:avoid-page}.cash-section tr,.cash-table tbody{break-inside:auto}.cash-table tr:not(.receipt-notes){break-after:avoid-page}.notes{max-width:none}a{color:inherit;text-decoration:none}}
</style></head><body><main data-report-version="2">
<div class="toolbar"><button type="button" onclick="window.print()">${label('print')}</button></div>
<header class="report-head"><div class="brand">CRISTAL WATER</div><h1>${label('title')} - ${text(monthRef)}</h1><p>${label(report.onlyRequiresInvoice ? 'filterRequired' : 'filterAll')}</p><p class="muted">${label('generated', { date: date(report.generatedAt) })}</p></header>
<dl class="summary">
${metric('metric-client-count','clientCount',report.clientCount)}${metric('metric-document-count','documentCount',documents.total)}${metric('metric-document-amount','receivableAmount',money(documents.amountCents))}${metric('metric-current-open','currentOpen',money(documents.openAmountCents))}${metric('metric-cash-amount','cashAmount',money(cash.amountCents))}${metric('metric-payment-count','paymentCount',cash.paymentCount)}
</dl>
<div class="basis"><h2>${label('basisHeading')}</h2><p>${label('documentBasis', { receivable: documents.receivableCount, excluded: documents.excludedCount, unknown: documents.unknownStatusCount, invalid: documents.invalidAmountCount })}</p><p>${label('currentBasis')}</p><p>${label('cashBasis', { start: report.start.toISOString(), end: report.end.toISOString() })}</p><p>${label('filterBasis')}</p></div>
${unavailableDocuments ? `<p class="warning" role="status" id="document-review">${label('documentWarning')}</p>` : ''}
${cash.amountCents === null ? `<p class="warning" role="status" id="cash-review">${label('cashWarning')}</p>` : ''}
<section aria-label="${label('documentCount')}">${report.documents.length ? report.documents.map(invoice => documentCard(invoice, display)).join('') : `<p class="empty" id="empty-documents">${label('emptyDocuments')}</p>`}</section>
<section class="cash-section" aria-labelledby="cash-heading"><h2 id="cash-heading">${label('cashHeading')}</h2><p class="muted">${label('cashNotice')}</p>
${report.payments.length ? `<div class="table-scroll" role="region" aria-label="${label('cashTable')}" tabindex="0"><table class="cash-table"><colgroup><col style="width:16%"><col style="width:30%"><col style="width:18%"><col style="width:18%"><col style="width:18%"></colgroup><thead><tr><th>${label('date')}</th><th>${label('currentClientLabel')}</th><th>${label('document')}</th><th>${label('method')}</th><th class="number">${label('amount')}</th></tr></thead>${report.payments.map(payment => `<tbody data-payment-id="${payment.id}"><tr><td>${text(date(payment.paidAt))}</td><td>${text(payment.invoice.client.name || t('clientPrefix') + payment.invoice.client.id)}</td><td>#${payment.invoice.id}<br>${text(reference(payment.invoice, t))}</td><td>${text(payment.method || t('notGiven'))}</td><td class="number" data-field="amount">${text(money(payment.amountCents))}</td></tr>${payment.notes ? `<tr class="receipt-notes"><td colspan="5"><strong>${label('paymentNotes')}${payment.id}</strong><div class="notes">${text(payment.notes)}</div></td></tr>` : ''}</tbody>`).join('')}</table></div>` : `<p class="empty" id="empty-payments">${label('emptyPayments')}</p>`}
</section><p class="closing">${label('closing')}</p>
</main></body></html>`;
}
module.exports = { read, html };
