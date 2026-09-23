'use strict';
const crypto = require('node:crypto');
const categories = ['STOCK', 'MATERIAL', 'FUEL', 'VEHICLE', 'LABOR', 'INSURANCE', 'GENERAL'];
const commands = ['CREATE', 'EDIT', 'CANCEL', 'REOPEN', 'RECORD_PAYMENT', 'REVERSE_PAYMENT', 'ADD_EVIDENCE', 'VOID_EVIDENCE', 'ALLOCATE_COST', 'REVIEW_COST', 'VOID_COST', 'CORRECT_COST_PERIOD', 'SET_LABOR_BASIS', 'SET_LABOR_DISTRIBUTION', 'VOID_LABOR_DISTRIBUTION', 'VALUE_MATERIAL', 'VALUE_LABOR', 'SHARE_MAINTENANCE_LABOR', 'VOID_MAINTENANCE_LABOR_SHARE'];
const maxEvidence = 5 * 1024 * 1024;
function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
function object(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) fail('Campos do pedido inválidos.');
}
function text(value, max = 500, required = false) {
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) fail('Texto inválido.');
  const result = value.trim(); if (required && !result) fail('Preencha os campos obrigatórios.'); return result;
}
function id(value) { if (!Number.isSafeInteger(value) || value <= 0 || value > 2147483647) fail('Identificador inválido.'); return value; }
function queryId(value) { if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) fail('Identificador inválido.'); return id(Number(value)); }
function money(value) { if (!Number.isSafeInteger(value) || value <= 0 || value > 2147483647) fail('Indique um montante positivo em cêntimos, até 21 474 836,47 €.'); return value; }
function date(value, optional = false) {
  if (optional && value === null) return null;
  if (typeof value !== 'string' || !/^(20|21)\d{2}-(0[1-9]|1[0-2])-\d{2}$/.test(value)) fail('Data inválida.');
  const d = new Date(value + 'T00:00:00Z'); if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== value) fail('Data inválida.'); return d;
}
const day = value => value ? new Date(value).toISOString().slice(0, 10) : null;
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const hash = value => crypto.createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(canonical(value))).digest('hex');
const normalized = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f\s]/g, '').toUpperCase();
const documentKey = (supplier, number) => number ? hash(normalized(supplier) + '\n' + normalized(number)) : null;
function envelope(body) {
  object(body, ['requestId', 'command', 'expenseId', 'expectedVersion', 'data']);
  if (typeof body.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId) || !commands.includes(body.command)) fail('Pedido de despesa inválido.');
  if (body.command === 'CREATE') { if (body.expenseId !== null || body.expectedVersion !== null) fail('Contexto de criação inválido.'); }
  else { id(body.expenseId); id(body.expectedVersion); }
  if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data) || Object.entries(body.data).some(([k,v]) => v !== null && !['string', 'number', 'boolean'].includes(typeof v) && !(body.command==='SET_LABOR_DISTRIBUTION'&&k==='parts'&&Array.isArray(v))) || JSON.stringify(body.data).length > 10000) fail('Conteúdo do pedido inválido.');
  return { requestId: body.requestId.toLowerCase(), command: body.command, expenseId: body.expenseId, expectedVersion: body.expectedVersion, data: body.data };
}
function expenseData(d) {
  object(d, ['title', 'supplierId', 'supplierName', 'documentNumber', 'expenseDate', 'dueDate', 'amountCents', 'category', 'notes', 'sourceType', 'sourceId', 'sourceHash', 'confirmed', 'reason']);
  if (d.confirmed !== true || !categories.includes(d.category) || !['MANUAL', 'STOCK_PURCHASE', 'VEHICLE_MAINTENANCE'].includes(d.sourceType)) fail('Confirme a despesa e a categoria.');
  if (d.supplierId !== null) id(d.supplierId);
  if (d.sourceType === 'MANUAL') { if (d.sourceId !== null || d.sourceHash !== null) fail('Origem manual inválida.'); }
  else if (!id(d.sourceId) || typeof d.sourceHash !== 'string' || !/^[a-f0-9]{64}$/.test(d.sourceHash)) fail('Reveja a origem da despesa.');
  return { title: text(d.title, 180, true), supplierId: d.supplierId, supplierName: text(d.supplierName, 180, true), documentNumber: text(d.documentNumber, 100), expenseDate: date(d.expenseDate), dueDate: date(d.dueDate, true), amountCents: money(d.amountCents), category: d.category, notes: text(d.notes, 2000), reason: text(d.reason, 500) };
}
function evidence(file, data) {
  object(data, ['name', 'mime', 'size', 'sha256']);
  if (!file || !Buffer.isBuffer(file.buffer) || !file.buffer.length || file.buffer.length > maxEvidence) fail('Anexe um PDF, PNG ou JPEG até 5 MB.');
  const bytes = file.buffer;
  const mime = bytes.subarray(0, 5).toString() === '%PDF-' ? 'application/pdf' : bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png' : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'image/jpeg' : null;
  const name = text(data.name, 180, true);
  if (!mime || mime !== data.mime || data.size !== bytes.length || data.sha256 !== hash(bytes) || /[\\/\r\n]/.test(name)) fail('O ficheiro não corresponde ao comprovativo revisto.');
  return { name, mime, size: bytes.length, sha256: data.sha256, bytes };
}
module.exports = { categories, commands, maxEvidence, fail, object, text, id, queryId, money, date, day, canonical, hash, normalized, documentKey, envelope, expenseData, evidence };
