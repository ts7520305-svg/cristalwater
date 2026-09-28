import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url), source = readFileSync(new URL('../src/business/finance/FinanceOsBusiness.js', import.meta.url), 'utf8');
const date = new Date('2032-01-01T00:00:00Z');
function fixtures() {
  const client = (id, requiresInvoice, fiscal = true) => ({ id, name: 'Client ' + id, requiresInvoice, fiscalName: fiscal ? 'Name' : '', fiscalNif: '999999990', fiscalAddress: 'QA', fiscalEmail: 'qa@example.test', pools: [], invoices: [], notes: 'UNNEEDED '.repeat(1000) });
  const rows = [client(1, true), client(2, false, false), client(3, true, false), client(4, false)];
  const add = (id, c, patch = {}) => { const row = { id, clientId: c.id, status: 'PENDING', requiresInvoice: false, amount: 10, total: 10, totalAmount: 10, externalInvoiceNo: null, invoiceNumber: null, invoiceIssued: false, createdAt: date, updatedAt: date, month: '2032-01', notes: 'UNNEEDED '.repeat(1000), client: { ...c, invoices: undefined }, lines: [{ id, description: 'UNNEEDED '.repeat(1000) }], payments: [], ...patch }; c.invoices.push(row); return row; };
  add(1, rows[0]); add(2, rows[0], { status: 'DRAFT' }); add(3, rows[0], { total: 0, totalAmount: 0, amount: 0 });
  add(4, rows[0], { externalInvoiceNo: ' EXACT ', invoiceNumber: 'INTERNAL' });
  add(5, rows[0], { externalInvoiceNo: 'SAME', invoiceNumber: ' SAME ' });
  add(6, rows[0], { externalInvoiceNo: 'WRONG' }); add(7, rows[0], { externalInvoiceNo: 'DUPLICATE' });
  add(8, rows[0], { externalInvoiceNo: 'bad\nnumber' }); add(9, rows[0]);
  add(10, rows[1], { requiresInvoice: true, total: 1, totalAmount: 2, amount: 9 }); // normalization precedes summary sums
  add(11, rows[1], { status: 'CANCELLED', externalInvoiceNo: 'ARCHIVE' });
  add(12, rows[3], { status: 'DRAFT' });
  const entry = (id, invoice, number, decision = 'CONFIRM_EXTERNAL') => ({ id, entityId: invoice, action: 'EXTERNAL_INVOICE_REFERENCE_REVIEWED', metadata: { kind: 'EXTERNAL_REFERENCE_ONLY', association: 'WHOLE_INTERNAL_DOCUMENT', decision, externalInvoiceNo: number, snapshot: { id: invoice, clientId: 1, lines: [] } } });
  const history = [entry(1, 4, 'EXACT'), entry(2, 6, 'OLD'), entry(3, 9, '', 'INTERNAL_ONLY')];
  const references = rows.flatMap(c => c.invoices.map(i => ({ id: i.id, invoiceNumber: i.invoiceNumber, externalInvoiceNo: i.externalInvoiceNo }))); references.push({ id: 99, invoiceNumber: ' DUPLICATE ', externalInvoiceNo: null });
  return { rows, history, references };
}
function setup({ fail, forbidHashes = false } = {}) {
  const f = fixtures(), calls = [], project = (row, select) => Object.fromEntries(Object.entries(select).map(([key, spec]) => [key, spec === true ? row[key] : Array.isArray(row[key]) ? row[key].map(r => project(r, spec.select)) : project(row[key], spec.select)]));
  const read = (model, value) => async query => { calls.push({ model, query }); if (model === fail) throw Error('PRIVATE_SOURCE_FAILURE'); return query.select ? value.map(r => project(r, query.select)) : value; };
  const tx = { auditTrail: { findMany: read('auditTrail', f.history) }, client: { findMany: read('client', f.rows) }, invoice: { findMany: read('invoice', f.references) } };
  const sandbox = { module: { exports: {} }, require(name) {
    if (name === '../../dal/FinanceOsRepository') return { transaction: fn => fn(tx) };
    if (name === '../../services/clientCreditService') return require('../src/services/clientCreditService');
    if (name === '../../services/invoiceViewService') return require('../src/services/invoiceViewService');
    if (name === 'node:crypto') return forbidHashes ? { createHash() { throw Error('Summary generated an unused review token'); } } : require(name);
    return {};
  } };
  vm.runInNewContext(source, sandbox); return { read: summary => sandbox.module.exports.listExternalInvoices({ status: 'all' }, false, tx, summary), calls, f };
}
describe('external billing summary without document materialization', () => {
  it('matches the full catalogue for eligibility, history precedence, conflicts and normalization', async () => {
    const run = setup(), full = await run.read(false), lean = await run.read(true);
    expect(lean).toEqual({ ok: true, summary: full.summary });
    expect(full.summary).toEqual({ clients: 3, missingFiscalData: 2, pendingInvoices: 3, issuedInvoices: 6, totalInvoices: 9, confirmedReferences: 1, reviewReferences: 5, pendingTotal: 22, issuedTotal: 60 });
  });
  it('does not retrieve complete invoices, lines, payments, pool relations or repeated clients', async () => {
    const run = setup(); await run.read(true); const q = run.calls.find(c => c.model === 'client').query;
    expect(q.include).toBeUndefined(); expect(q.select).toBeDefined(); const invoice = q.select.invoices;
    for (const key of ['client', 'lines', 'payments', 'notes']) expect(invoice.select[key]).toBeUndefined();
    for (const key of ['pools', 'notes', 'email', 'phone']) expect(q.select[key]).toBeUndefined();
    expect(invoice.select.externalInvoiceNo).toBe(true); expect(invoice.select.invoiceNumber).toBe(true);
  });
  it('does not generate review hashes for discarded documents', async () => {
    const run = setup({ forbidHashes: true }); expect((await run.read(true)).ok).toBe(true);
  });
  it.each(['auditTrail', 'client', 'invoice'])('rejects the whole summary if %s is unavailable', async fail => {
    await expect(setup({ fail }).read(true)).rejects.toThrow('PRIVATE_SOURCE_FAILURE');
  });
  it('keeps the normal catalogue and its review tokens intact', async () => {
    const run = setup(), full = await run.read(false); expect(full.clients).toHaveLength(3);
    for (const invoice of full.clients.flatMap(c => c.invoices)) { expect(invoice.externalReviewToken).toMatch(/^[a-f0-9]{64}$/); expect(invoice.externalReferenceReview.token).toMatch(/^[a-f0-9]{64}$/); }
    expect(run.calls.find(c => c.model === 'client').query.include.invoices.include.lines).toEqual({ orderBy: { id: 'asc' } });
  });
});
