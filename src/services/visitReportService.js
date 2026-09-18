'use strict';
const { prisma } = require('../prismaClient');
const { normalizeRole } = require('../utils/roles');
const settingsService = require('./clientReportSettingsService');
const fail = (message, statusCode = 400) => { throw Object.assign(Error(message), { statusCode }); };
const id = value => typeof value === 'string' && /^[1-9]\d{0,9}$/.test(value) && Number(value) <= 2147483647 ? Number(value) : fail('Identificador inválido.');
const text = value => value === null || value === undefined || value === '' ? '-' : String(value);
const date = value => value ? new Date(value).toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' }) : '-';
const yesNo = value => value ? 'Sim' : 'Não';
const htmlText = value => text(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

async function read(actor, rawId, query = {}) {
  const visitId = id(rawId), role = normalizeRole(actor?.role);
  if (!['ADMIN', 'CLIENT', 'TECHNICIAN', 'TEAM_LEADER'].includes(role)) fail('Acesso negado.', 403);
  if (Object.keys(query).some(key => !['view', 'role', 'clientId', 'settingsVersion'].includes(key)) ||
      (query.view !== undefined && !['client', 'admin'].includes(query.view)) ||
      (query.role !== undefined && !['CLIENT', 'ADMIN'].includes(query.role)) ||
      (query.view !== undefined && query.role !== undefined) ||
      (query.settingsVersion !== undefined && (typeof query.settingsVersion !== 'string' || !/^report-settings-v1:[a-f0-9]{64}$/.test(query.settingsVersion)))) fail('Opções de relatório inválidas.');
  const expectedClient = query.clientId === undefined ? null : id(query.clientId);
  const view = query.view || query.role?.toLowerCase() || (role === 'ADMIN' ? 'admin' : 'client');
  if (view === 'admin' && role !== 'ADMIN') fail('Acesso negado.', 403);
  return prisma.$transaction(async tx => {
    const visit = await tx.serviceVisit.findUnique({ where: { id: visitId }, include: {
      client: { include: { reportSetting: true } },
      pool: { include: { equipment: true, technicalRoom: true } },
      chemicals: { orderBy: { id: 'asc' } }, photos: { orderBy: { id: 'asc' } },
    } });
    if (!visit) fail('Visita não encontrada.', 404);
    // The current pool owner cannot prove who owned a historical visit.
    const clientId = visit.clientId;
    if (role === 'CLIENT' && (!clientId || Number(actor.clientId || actor.id) !== clientId)) fail('Acesso negado.', 403);
    if (['TECHNICIAN', 'TEAM_LEADER'].includes(role) && (!visit.technicianId || Number(actor.technicianId || actor.id) !== visit.technicianId)) fail('Acesso negado.', 403);
    if (visit.clientId && visit.pool?.clientId && visit.clientId !== visit.pool.clientId) fail('A visita e a instalação têm clientes diferentes. Peça a revisão do registo.', 409);
    const client = visit.client;
    if (!client) fail('A visita não tem um cliente confirmado.', 409);
    if (expectedClient !== null && expectedClient !== client.id) fail('A visita não pertence ao cliente selecionado.', 409);
    const state = settingsService.snapshot(client);
    if (query.settingsVersion !== undefined && query.settingsVersion !== state.version) fail('As configurações mudaram. Carregue novamente antes de abrir o relatório.', 409);
    return { visit, client, view, setting: state.setting, settingsVersion: state.version };
  }, { isolationLevel: 'RepeatableRead', maxWait: 15000, timeout: 15000 });
}

// One projection governs both representations, including the ADMIN client preview.
function sections(report) {
  const { visit: v, client, setting, view } = report, show = key => view === 'admin' || setting[key];
  const result = [], general = [];
  const add = (key, label, value) => { if (show(key)) general.push([label, text(value)]); };
  add('showClientName', 'Cliente', client.name); add('showPoolName', 'Instalação', v.pool?.name);
  add('showZone', 'Zona', v.pool?.zone || client.zone); add('showAddress', 'Morada', v.pool?.address || client.address);
  add('showTechnicianName', 'Técnico', v.technicianName); add('showStatus', 'Estado', v.status);
  add('showPlannedDate', 'Planeada (hora de Portugal)', date(v.plannedDate));
  add('showStartEnd', 'Início (hora de Portugal)', date(v.startAt)); add('showStartEnd', 'Fim (hora de Portugal)', date(v.endAt));
  if (general.length) result.push({ title: 'Dados da visita', rows: general });
  if (show('showWaterParameters')) result.push({ title: 'Parâmetros da água', rows: [['pH', v.ph], ['Cloro', v.chlorine], ['Alcalinidade', v.alkalinity], ['Sal', v.salt], ['Temperatura', v.temperature], ['ORP (mV)', v.orpMv]] });
  if (show('showChecklist')) result.push({ title: 'Trabalhos registados', rows: [['Limpeza geral', yesNo(v.cleaned)], ['Escovagem', yesNo(v.brushed)], ['Aspiração', yesNo(v.vacuumed)], ['Cestos limpos', yesNo(v.basketCleaned)], ['Linha de água limpa', yesNo(v.waterlineClean)], ['Retrolavagem', yesNo(v.backwashDone)]] });
  if (show('showChemicals')) result.push({ title: 'Químicos aplicados', rows: v.chemicals.map((c, i) => [String(i + 1) + '. ' + c.name, text(c.quantity) + (c.unit ? ' ' + c.unit : '')]), empty: 'Nenhum químico registado.' });
  if (show('showEquipment')) { const e = v.pool?.equipment; result.push({ title: 'Equipamento atual da instalação', rows: [['Bomba', e?.pumpType], ['Potência da bomba', e?.pumpPower], ['Filtro', e?.filterType], ['Meio filtrante', e?.filterMedia], ['Sistema de sal', e ? yesNo(e.saltSystem) : null], ['Quantidade de sal', e?.saltQuantity], ['Luzes', e?.lightsCount], ['Luzes avariadas', e?.brokenLightsCount], ['Tipo de luz', e?.lightsType]] }); }
  if (show('showTechnicalRoom')) { const t = v.pool?.technicalRoom; result.push({ title: 'Casa técnica - registo atual', rows: [['Estado', t?.condition], ['Localização', t?.locationNote], ['Ventilação', t?.ventilation], ['Elétrica', t?.electrical], ['Notas', t?.notes]] }); }
  if (show('showNotes')) result.push({ title: 'Observações', body: v.notes || 'Sem observações.' });
  if (view === 'admin') result.push({ title: 'Notas internas', body: v.internalNotes || 'Sem notas internas.' });
  if (show('showPhotos')) result.push({ title: 'Fotografias registadas - referências', rows: v.photos.map((p, i) => [String(i + 1) + '. ' + p.type, p.url]), empty: 'Nenhuma foto registada.' });
  return result;
}

function headers(res, report, type) {
  res.set({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    'X-CW-Report-Type': type, 'X-CW-Visit-Id': String(report.visit.id), 'X-CW-Client-Id': String(report.client.id),
    'X-CW-Report-View': report.view, 'X-CW-Settings-Version': report.settingsVersion });
}
function html(report) {
  const title = report.view === 'admin' ? 'Relatório técnico completo' : 'Relatório de manutenção';
  return `<!doctype html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font:15px/1.5 Arial,sans-serif;margin:32px;color:#1f2937}main{max-width:850px;margin:auto}h1{color:#125e88}section{margin:22px 0}h2{font-size:19px;border-bottom:1px solid #d4dfe7;padding-bottom:6px;break-after:avoid}dl{margin:0}dt{font-weight:bold;break-after:avoid}dd{margin:0 0 12px}p,dd,dt{white-space:pre-wrap;overflow-wrap:anywhere}button{min-height:44px;padding:8px 18px}footer{font-size:12px;color:#526476}@media print{button{display:none}body{margin:0}}</style></head><body><main><button onclick="window.print()">Imprimir / Guardar PDF</button><h1>Cristal Water</h1><p>${title} | Visita #${report.visit.id}</p>${sections(report).map(s => `<section><h2>${htmlText(s.title)}</h2>${s.body ? `<p>${htmlText(s.body)}</p>` : s.rows.length ? `<dl>${s.rows.map(([label, value]) => `<dt>${htmlText(label)}</dt><dd>${htmlText(value)}</dd>`).join('')}</dl>` : `<p>${htmlText(s.empty)}</p>`}</section>`).join('')}<footer>Documento gerado pelo sistema Cristal Water. Os dados da instalação correspondem ao registo atual.</footer></main></body></html>`;
}
module.exports = { read, sections, headers, html, text };
