'use strict';
const { prisma } = require('../prismaClient');
const PDFDocument = require('pdfkit');
const prepareFonts = require('./visitReportPdfFonts');
const reportPhotos = require('./visitReportPhotoService');
const { normalizeRole } = require('../utils/roles');
const settingsService = require('./clientReportSettingsService');
const fail = (message, statusCode = 400) => { throw Object.assign(Error(message), { statusCode }); };
const id = value => typeof value === 'string' && /^[1-9]\d{0,9}$/.test(value) && Number(value) <= 2147483647 ? Number(value) : fail('Identificador inválido.');
const text = value => value === null || value === undefined || value === '' ? '-' : String(value);
const date = value => value ? new Date(value).toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' }) : '-';
const yesNo = value => value ? 'Sim' : 'Não';
const htmlText = value => text(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const visitLabel = report => (report.visitType === 'EXTRA' ? 'Visita extra #' : 'Visita #') + report.visit.id;
const extraProjection = require('./extraVisitReportProjection');

async function read(actor, rawId, query = {}) {
  const visitId = id(rawId), role = normalizeRole(actor?.role), visitType = query.visitType ?? 'REGULAR';
  if (!['ADMIN', 'CLIENT', 'TECHNICIAN', 'TEAM_LEADER'].includes(role)) fail('Acesso negado.', 403);
  if (!['REGULAR', 'EXTRA'].includes(visitType)) fail('Tipo de visita inválido.');
  if (Object.keys(query).some(key => !['view', 'role', 'clientId', 'settingsVersion', 'visitType'].includes(key)) ||
      (query.view !== undefined && !['client', 'admin'].includes(query.view)) ||
      (query.role !== undefined && !['CLIENT', 'ADMIN'].includes(query.role)) ||
      (query.view !== undefined && query.role !== undefined) ||
      (query.settingsVersion !== undefined && (typeof query.settingsVersion !== 'string' || !/^report-settings-v1:[a-f0-9]{64}$/.test(query.settingsVersion)))) fail('Opções de relatório inválidas.');
  const expectedClient = query.clientId === undefined ? null : id(query.clientId);
  const view = query.view || query.role?.toLowerCase() || (role === 'ADMIN' ? 'admin' : 'client');
  if (view === 'admin' && role !== 'ADMIN') fail('Acesso negado.', 403);
  const report = await prisma.$transaction(async tx => {
    let visit = await tx[visitType === 'EXTRA' ? 'extraVisit' : 'serviceVisit'].findUnique({ where: { id: visitId }, include: {
      client: { include: { reportSetting: true } },
      pool: { include: { equipment: true, technicalRoom: true } },
      ...(visitType === 'EXTRA' ? { technician: { select: { name: true } } } : { chemicals: { orderBy: { id: 'asc' } } }), photos: { orderBy: { id: 'asc' }, take: 24 }, _count: { select: { photos: true } },
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
    if (visitType === 'EXTRA') visit = extraProjection(visit);
    return { visit, visitType, client, view, setting: state.setting, settingsVersion: state.version };
  }, { isolationLevel: 'RepeatableRead', maxWait: 15000, timeout: 15000 });
  report.photos = await reportPhotos.prepare(report);
  return report;
}

// One projection governs both representations, including the ADMIN client preview.
function sections(report) {
  const { visit: v, client, setting, view } = report, show = key => view === 'admin' || setting[key];
  const result = [], general = [];
  const extra = report.visitType === 'EXTRA', check = key => extra && typeof v[key] !== 'boolean' ? v[key] ?? 'Não registado' : yesNo(v[key]);
  const add = (key, label, value) => { if (show(key)) general.push([label, text(value)]); };
  add('showClientName', 'Cliente', client.name); add('showPoolName', 'Instalação', v.pool?.name);
  add('showZone', 'Zona', v.pool?.zone || client.zone); add('showAddress', 'Morada', v.pool?.address || client.address);
  add('showTechnicianName', extra ? 'Técnico atribuído (registo atual)' : 'Técnico', v.technicianName); add('showStatus', 'Estado', v.status);
  add('showPlannedDate', 'Planeada (hora de Portugal)', date(v.plannedDate));
  add('showStartEnd', 'Início (hora de Portugal)', date(v.startAt)); add('showStartEnd', 'Fim (hora de Portugal)', date(v.endAt));
  if (general.length) result.push({ title: extra ? 'Dados da visita extra' : 'Dados da visita', rows: general });
  if (show('showWaterParameters')) result.push({ title: 'Parâmetros da água', rows: [['pH', v.ph], ['Cloro', v.chlorine], ['Alcalinidade', v.alkalinity], ['Sal', v.salt], ['Temperatura', v.temperature], ['ORP (mV)', v.orpMv]] });
  if (show('showChecklist')) result.push({ title: 'Trabalhos registados', rows: [['Limpeza geral', check('cleaned')], ['Escovagem', check('brushed')], ['Aspiração', check('vacuumed')], ['Cestos limpos', check('basketCleaned')], ['Linha de água limpa', check('waterlineClean')], ['Retrolavagem', check('backwashDone')]] });
  if (show('showChemicals')) result.push({ title: 'Químicos aplicados', rows: v.chemicals.map((c, i) => [String(i + 1) + '. ' + c.name, text(c.quantity) + (c.unit ? ' ' + c.unit : '')]), empty: v.chemicalNotice || 'Nenhum químico registado.' });
  if (show('showEquipment')) { const e = v.pool?.equipment; result.push({ title: 'Equipamento atual da instalação', rows: [['Bomba', e?.pumpType], ['Potência da bomba', e?.pumpPower], ['Filtro', e?.filterType], ['Meio filtrante', e?.filterMedia], ['Sistema de sal', e ? yesNo(e.saltSystem) : null], ['Quantidade de sal', e?.saltQuantity], ['Luzes', e?.lightsCount], ['Luzes avariadas', e?.brokenLightsCount], ['Tipo de luz', e?.lightsType]] }); }
  if (show('showTechnicalRoom')) { const t = v.pool?.technicalRoom; result.push({ title: 'Casa técnica - registo atual', rows: [['Estado', t?.condition], ['Localização', t?.locationNote], ['Ventilação', t?.ventilation], ['Elétrica', t?.electrical], ['Notas', t?.notes]] }); }
  if (show('showNotes')) result.push({ title: 'Observações', body: v.notes || 'Sem observações.' });
  if (extra && view === 'admin') {
    if (v.planningNotes) result.push({ title: 'Indicações de planeamento', body: v.planningNotes });
    if (v.problem) result.push({ title: 'Ocorrência registada', body: v.problem });
  }
  if (view === 'admin') result.push({ title: 'Notas internas', body: v.internalNotes || 'Sem notas internas.' });
  if (show('showPhotos')) result.push({ title: 'Fotografias da visita', photos: report.photos || [], empty: 'Nenhuma foto registada.' });
  return result;
}

function headers(res, report, type) {
  res.set({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    'X-CW-Report-Type': report.visitType === 'EXTRA' ? 'extra-' + type : type, 'X-CW-Visit-Type': report.visitType || 'REGULAR', 'X-CW-Visit-Id': String(report.visit.id), 'X-CW-Client-Id': String(report.client.id),
    'X-CW-Report-View': report.view, 'X-CW-Settings-Version': report.settingsVersion });
}
function html(report) {
  const title = report.view === 'admin' ? 'Relatório técnico completo' : 'Relatório de manutenção';
  return `<!doctype html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font:15px/1.5 Arial,sans-serif;margin:32px;color:#1f2937}main{max-width:850px;margin:auto}h1{color:#125e88}section{margin:22px 0}h2{font-size:19px;border-bottom:1px solid #d4dfe7;padding-bottom:6px;break-after:avoid}dl{margin:0}dt{font-weight:bold;break-after:avoid}dd{margin:0 0 12px}p,dd,dt{white-space:pre-wrap;overflow-wrap:anywhere}figure{margin:16px 0;break-inside:avoid}figure img{display:block;max-width:100%;max-height:360px;width:auto;height:auto;margin:8px auto}figcaption{font-weight:bold;overflow-wrap:anywhere}button{min-height:44px;padding:8px 18px}footer{font-size:12px;color:#526476}@media print{button{display:none}body{margin:0}}</style></head><body><main><button onclick="window.print()">Imprimir / Guardar PDF</button><h1>Cristal Water</h1><p>${title} | ${visitLabel(report)}</p>${sections(report).map(s => `<section><h2>${htmlText(s.title)}</h2>${s.photos ? (s.photos.length ? s.photos.map(p => `<figure><figcaption>${htmlText(p.label)}</figcaption>${p.bytes ? `<img src="data:image/jpeg;base64,${p.bytes.toString('base64')}" alt="${htmlText(p.label)}" width="${p.width}" height="${p.height}">` : `<p>${htmlText(p.message)}</p>`}</figure>`).join('') : `<p>${htmlText(s.empty)}</p>`) : s.body ? `<p>${htmlText(s.body)}</p>` : s.rows.length ? `<dl>${s.rows.map(([label, value]) => `<dt>${htmlText(label)}</dt><dd>${htmlText(value)}</dd>`).join('')}</dl>` : `<p>${htmlText(s.empty)}</p>`}</section>`).join('')}<footer>Documento gerado pelo sistema Cristal Water. Os dados da instalação correspondem ao registo atual.</footer></main></body></html>`;
}
function renderPdf(report) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margins: { top: 98, bottom: 58, left: 48, right: 48 }, bufferPages: true,
      info: { Title: "Cristal Water - " + visitLabel(report), Author: "Cristal Water" } });
    const chunks = [];
    doc.on("data", chunk => chunks.push(chunk)); doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject);
    try {
      const fonts = prepareFonts(doc), safe = value => fonts.format(text(value));
      const content = sections(report).map(section => ({ ...section, title: safe(section.title),
        ...(section.body ? { body: safe(section.body) } : {}),
        ...(section.empty ? { empty: safe(section.empty) } : {}),
        ...(section.rows ? { rows: section.rows.map(([label, value]) => [safe(label), safe(value)]) } : {}),
        ...(section.photos ? { photos: section.photos.map(photo => ({ ...photo, label: safe(photo.label), ...(photo.message ? { message: safe(photo.message) } : {}) })) } : {}),
      }));
      if (fonts.unsupported.size) content.push({ title: 'Caracteres por confirmar', body: 'Alguns caracteres não são suportados por este PDF e aparecem como [U+...]. Consulte o registo original para confirmar o texto.' });
      const width = doc.page.width - 96;
      function header() {
        const font = doc._font?.name || fonts.regular, size = doc._fontSize || 10;
        doc.fillColor("#145f86").font(fonts.bold).fontSize(20).text("Cristal Water", 48, 34, { width, lineBreak: false });
        doc.fillColor("#334155").font(fonts.regular).fontSize(10).text(
          (report.view === "admin" ? "Relatório técnico completo" : "Relatório de manutenção") + " | " + visitLabel(report),
          48, 62, { width, lineBreak: false });
        doc.strokeColor("#d3e2eb").moveTo(48, 83).lineTo(doc.page.width - 48, 83).stroke();
        doc.font(font).fontSize(size).fillColor("#1f2937"); doc.x = 48; doc.y = 98;
      }
      doc.on("pageAdded", header); header();
      function space(height) { if (doc.y + height > doc.page.height - 58) doc.addPage(); }
      function paragraph(value) { doc.font(fonts.regular).fontSize(10).text(text(value), 48, doc.y, { width, lineGap: 3 }); doc.y += 12; }
      for (const section of content) {
        const firstPhoto = section.photos?.[0];
        space(firstPhoto?.bytes ? firstPhoto.height * Math.min(width / firstPhoto.width, 290 / firstPhoto.height, 1) + 80 : section.photos?.length ? 105 : 70);
        const top = doc.y;
        doc.fillColor("#145f86").font(fonts.bold).fontSize(13).text(section.title, 48, top, { width });
        doc.y = Math.max(doc.y + 9, top + 27); doc.fillColor("#1f2937");
        if (section.photos) {
          if (!section.photos.length) paragraph(section.empty);
          for (const photo of section.photos) {
            const scale = photo.bytes ? Math.min(width / photo.width, 290 / photo.height, 1) : 0;
            const height = photo.bytes ? photo.height * scale : 0;
            space(height + (photo.bytes ? 48 : 76));
            doc.font(fonts.bold).fontSize(10).text(photo.label, 48, doc.y, { width }); doc.y += 8;
            if (photo.bytes) {
              const y = doc.y, imageWidth = photo.width * scale;
              doc.image(photo.bytes, 48 + (width - imageWidth) / 2, y, { width: imageWidth, height });
              doc.x = 48; doc.y = y + height + 18;
            } else paragraph(photo.message);
          }
        }
        else if (section.body) paragraph(section.body);
        else if (!section.rows.length) paragraph(section.empty);
        else {
          // Measure every row; long values flow across pages without fixed-height clipping.
          const cellWidth = (width - 20) / 2;
          for (let index = 0; index < section.rows.length;) {
            const cells = section.rows.slice(index, index + 2);
            const heights = cells.map(([label, value]) => {
              doc.font(fonts.bold).fontSize(9); const labelHeight = doc.heightOfString(label, { width: cellWidth });
              doc.font(fonts.regular).fontSize(10); return labelHeight + 5 + doc.heightOfString(text(value), { width: cellWidth, lineGap: 2 });
            });
            if (Math.max(...heights) > 180) {
              const [label, value] = section.rows[index++]; space(55);
              doc.font(fonts.bold).fontSize(10).text(label, 48, doc.y, { width }); doc.y += 4; paragraph(value);
              continue;
            }
            const height = Math.max(...heights) + 14; space(height);
            const y = doc.y;
            cells.forEach(([label, value], column) => {
              const x = 48 + column * (cellWidth + 20);
              doc.font(fonts.bold).fontSize(9).text(label, x, y, { width: cellWidth });
              const valueY = doc.y + 5;
              doc.font(fonts.regular).fontSize(10).text(text(value), x, valueY, { width: cellWidth, lineGap: 2 });
            });
            doc.x = 48; doc.y = y + height; index += cells.length;
          }
        }
        doc.y += 7;
      }
      const range = doc.bufferedPageRange();
      for (let page = range.start; page < range.start + range.count; page++) {
        doc.switchToPage(page);
        const bottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        doc.font(fonts.regular).fontSize(8).fillColor("#526476").text(
          "Cristal Water | Dados da instalação: registo atual | " + (page + 1) + "/" + range.count,
          48, doc.page.height - 35, { width, align: "center", lineBreak: false });
        doc.page.margins.bottom = bottom;
      }
      doc.end();
    } catch (error) { doc.destroy(); reject(error); }
  });
}
module.exports = { read, sections, headers, html, text, renderPdf };
