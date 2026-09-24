'use strict';
const { prisma } = require('../prismaClient');
const PDFDocument = require('pdfkit');
const prepareFonts = require('./visitReportPdfFonts');
const { language, translator, locales } = require('./visitReportLanguage');
const reportPhotos = require('./visitReportPhotoService');
const { normalizeRole } = require('../utils/roles');
const settingsService = require('./clientReportSettingsService');
const fail = (message, statusCode = 400) => { throw Object.assign(Error(message), { statusCode }); };
const id = value => typeof value === 'string' && /^[1-9]\d{0,9}$/.test(value) && Number(value) <= 2147483647 ? Number(value) : fail('Identificador inválido.');
const text = value => value === null || value === undefined || value === '' ? '-' : String(value);
const date = (value, lang) => value ? new Date(value).toLocaleString(locales[lang || 'pt'], { timeZone: 'Europe/Lisbon' }) : '-';
const yesNo = (value, t) => t(value ? 'Sim' : 'Não');
const htmlText = value => text(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const visitLabel = report => translator(report.language)(report.visitType === 'EXTRA' ? 'Visita extra #' : 'Visita #') + report.visit.id;
const extraProjection = require('./extraVisitReportProjection');
const reportTitle = report => translator(report.language)(report.historicalReview ? 'Revisão administrativa da visita' : report.view === 'admin' ? 'Relatório técnico completo' : 'Relatório de manutenção');
const reportFooter = report => report.historicalReview ? 'Revisão administrativa: registo da visita' : report.historicalOrigin ? 'Dados da instalação: revisão histórica identificada' : 'Dados da instalação: registo atual';

async function read(actor, rawId, query = {}) {
  const visitId = id(rawId), role = normalizeRole(actor?.role), visitType = query.visitType ?? 'REGULAR';
  if (!['ADMIN', 'CLIENT', 'TECHNICIAN', 'TEAM_LEADER'].includes(role)) fail('Acesso negado.', 403);
  if (!['REGULAR', 'EXTRA'].includes(visitType)) fail('Tipo de visita inválido.');
  if (Object.keys(query).some(key => !['view', 'role', 'clientId', 'settingsVersion', 'visitType', 'lang', 'history', 'historyVersion'].includes(key)) ||
      (query.history !== undefined && query.history !== 'review') ||
      (query.view !== undefined && !['client', 'admin'].includes(query.view)) ||
      (query.role !== undefined && !['CLIENT', 'ADMIN'].includes(query.role)) ||
      (query.view !== undefined && query.role !== undefined) ||
      (query.settingsVersion !== undefined && (typeof query.settingsVersion !== 'string' || !/^report-settings-v1:[a-f0-9]{64}$/.test(query.settingsVersion)))) fail('Opções de relatório inválidas.');
  if(query.historyVersion!==undefined&&(query.history!==undefined||typeof query.historyVersion!=='string'||!/^visit-report-origin-v1:[a-f0-9]{64}$/.test(query.historyVersion)))fail('Versão da revisão histórica inválida.');
  const requestedLanguage = query.lang === undefined ? null : language(query.lang);
  const expectedClient = query.clientId === undefined ? null : id(query.clientId);
  const view = query.view || query.role?.toLowerCase() || (role === 'ADMIN' ? 'admin' : 'client');
  if (view === 'admin' && role !== 'ADMIN') fail('Acesso negado.', 403);
  const historicalReview = query.history === 'review';
  if (historicalReview && (role !== 'ADMIN' || view !== 'admin')) fail('A revisão histórica está reservada à administração.', 403);
  if (historicalReview && (query.view !== 'admin' || expectedClient === null || query.settingsVersion === undefined)) fail('Carregue o cliente registado na visita antes de abrir a revisão histórica.', 428);
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
    const differentClient = !!(visit.clientId && visit.pool?.clientId && visit.clientId !== visit.pool.clientId);
    const historicalOrigin=historicalReview?null:await require('./visitReportOriginService').reportReview(tx,visitType,visit);
    if(query.historyVersion!==undefined&&query.historyVersion!=='visit-report-origin-v1:'+historicalOrigin?.hash)fail('A revisão histórica mudou. Consulte antes de abrir o relatório.',409);
    if (differentClient && !historicalReview && !historicalOrigin) fail('A visita e a instalação têm clientes diferentes. Peça a revisão do registo.', 409);
    if (historicalReview && !differentClient) fail('Esta visita não apresenta uma diferença de cliente com a instalação atual. Consulte o relatório habitual.', 409);
    let client = visit.client;
    if (!client) fail('A visita não tem um cliente confirmado.', 409);
    if (expectedClient !== null && expectedClient !== client.id) fail('A visita não pertence ao cliente selecionado.', 409);
    const state = await settingsService.readSnapshot(tx, client);
    if (query.settingsVersion !== undefined && query.settingsVersion !== state.version) fail('As configurações mudaram. Carregue novamente antes de abrir o relatório.', 409);
    const lang = requestedLanguage || state.preferredLanguage;
    if (visitType === 'EXTRA') visit = extraProjection(visit, translator(lang));
    // This is a read-only administrative inspection, never an ownership attestation
    // or permission to share with either client. Do not project live facility data.
    if (historicalReview) visit = { ...visit, pool: null, client: null, technician: null, ...(visitType === 'EXTRA' ? { technicianName: null } : {}) };
    if(historicalOrigin){const d=historicalOrigin.details;client={...client,name:historicalOrigin.client.name,address:d.address||null,zone:d.zone||null};visit={...visit,pool:{id:visit.poolId,clientId:client.id,name:d.poolName,address:d.address||null,zone:d.zone||null,equipment:null,technicalRoom:null}};}
    return { visit, visitType, client: historicalReview ? { id: client.id, name: client.name } : client, view, historicalReview, historicalOrigin, language: lang, setting: state.setting, settingsVersion: state.version };
  }, { isolationLevel: 'RepeatableRead', maxWait: 15000, timeout: 15000 });
  report.photos = await reportPhotos.prepare(report);
  return report;
}

// One projection governs both representations, including the ADMIN client preview.
function sections(report) {
  const { visit: v, client, setting, view } = report, show = key => view === 'admin' || setting[key];
  const t = translator(report.language);
  const result = [], general = [];
  const extra = report.visitType === 'EXTRA', check = key => extra && typeof v[key] !== 'boolean' ? v[key] ?? t("Não registado") : yesNo(v[key], t);
  const add = (key, label, value) => { if (show(key)) general.push([label, text(value)]); };
  if (report.historicalReview) {
    result.push({ title: t('Origem por rever'), body: t('O cliente registado na visita difere do cliente atual da instalação. Esta consulta não confirma a titularidade histórica nem autoriza a partilha com clientes. Os dados atuais da instalação foram omitidos.') });
    general.push([t('Cliente registado na visita (ID)'), text(client.id)], [t('Nome na ficha atual desse cliente'), client.name], [t('Instalação registada na visita (ID)'), text(v.poolId)]);
  } else {
    add('showClientName', t("Cliente"), client.name); add('showPoolName', t("Instalação"), v.pool?.name);
    add('showZone', t("Zona"), v.pool?.zone || client.zone); add('showAddress', t("Morada"), v.pool?.address || client.address);
  }
  add('showTechnicianName', extra ? t("Técnico atribuído (registo atual)") : t("Técnico"), v.technicianName); add('showStatus', t("Estado"), v.status);
  add('showPlannedDate', t("Planeada (hora de Portugal)"), date(v.plannedDate, report.language));
  add('showStartEnd', t("Início (hora de Portugal)"), date(v.startAt, report.language)); add('showStartEnd', t("Fim (hora de Portugal)"), date(v.endAt, report.language));
  if (general.length) result.push({ title: extra ? t("Dados da visita extra") : t("Dados da visita"), rows: general });
  if (show('showWaterParameters')) result.push({ title: t("Parâmetros da água"), rows: [['pH', v.ph], [t("Cloro"), v.chlorine], [t("Alcalinidade"), v.alkalinity], [t("Sal"), v.salt], [t("Temperatura"), v.temperature], ['ORP (mV)', v.orpMv]] });
  if (show('showChecklist')) result.push({ title: t("Trabalhos registados"), rows: [[t("Limpeza geral"), check('cleaned')], [t("Escovagem"), check('brushed')], [t("Aspiração"), check('vacuumed')], [t("Cestos limpos"), check('basketCleaned')], [t("Linha de água limpa"), check('waterlineClean')], [t("Retrolavagem"), check('backwashDone')]] });
  if (show('showChemicals')) result.push({ title: t("Químicos aplicados"), rows: v.chemicals.map((c, i) => [String(i + 1) + '. ' + c.name, text(c.quantity) + (c.unit ? ' ' + c.unit : '')]), empty: v.chemicalNotice || t("Nenhum químico registado.") });
  if (!report.historicalReview && !report.historicalOrigin && show('showEquipment')) { const e = v.pool?.equipment; result.push({ title: t("Equipamento atual da instalação"), rows: [[t("Bomba"), e?.pumpType], [t("Potência da bomba"), e?.pumpPower], [t("Filtro"), e?.filterType], [t("Meio filtrante"), e?.filterMedia], [t("Sistema de sal"), e ? yesNo(e.saltSystem, t) : null], [t("Quantidade de sal"), e?.saltQuantity], [t("Luzes"), e?.lightsCount], [t("Luzes avariadas"), e?.brokenLightsCount], [t("Tipo de luz"), e?.lightsType]] }); }
  if (!report.historicalReview && !report.historicalOrigin && show('showTechnicalRoom')) { const room = v.pool?.technicalRoom; result.push({ title: t("Casa técnica - registo atual"), rows: [[t("Estado"), room?.condition], [t("Localização"), room?.locationNote], [t("Ventilação"), room?.ventilation], [t("Elétrica"), room?.electrical], [t("Notas"), room?.notes]] }); }
  if (show('showNotes')) result.push({ title: t("Observações"), body: v.notes || t("Sem observações.") });
  if (extra && view === 'admin') {
    if (v.planningNotes) result.push({ title: t("Indicações de planeamento"), body: v.planningNotes });
    if (v.problem) result.push({ title: t("Ocorrência registada"), body: v.problem });
  }
  if (view === 'admin') result.push({ title: t("Notas internas"), body: v.internalNotes || t("Sem notas internas.") });
  if(report.historicalOrigin){const h=report.historicalOrigin;result.push({title:t('Origem histórica revista'),body:t('Os dados da instalação foram confirmados para esta visita. Os dados atuais do equipamento e da casa técnica não estão incluídos.')+' '+t('Revisão registada:')+' '+date(h.createdAt,report.language)});if(view==='admin')result.push({title:t('Evidência da revisão administrativa'),body:h.details.evidence+'\n'+t('Motivo:')+' '+h.reason});}
  if (show('showPhotos')) result.push({ title: t("Fotografias da visita"), photos: report.photos || [], empty: t("Nenhuma foto registada.") });
  return result;
}

function headers(res, report, type) {
  if(report.historicalOrigin)res.set('X-CW-History-Version','visit-report-origin-v1:'+report.historicalOrigin.hash);
  res.set({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    'X-CW-Report-Type': report.visitType === 'EXTRA' ? 'extra-' + type : type, 'X-CW-Visit-Type': report.visitType || 'REGULAR', 'X-CW-Visit-Id': String(report.visit.id), 'X-CW-Client-Id': String(report.client.id),
    'Content-Language': language(report.language), 'X-CW-Report-View': report.view, 'X-CW-Settings-Version': report.settingsVersion,
    'X-CW-Report-Origin': report.historicalReview ? 'historical-review' : report.historicalOrigin ? 'historical-confirmed' : 'current' });
}
function html(report) {
  const t = translator(report.language);
  const title = reportTitle(report);
  return `<!doctype html><html lang="${language(report.language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font:15px/1.5 Arial,sans-serif;margin:32px;color:#1f2937}main{max-width:850px;margin:auto}h1{color:#125e88}section{margin:22px 0}h2{font-size:19px;border-bottom:1px solid #d4dfe7;padding-bottom:6px;break-after:avoid}dl{margin:0}dt{font-weight:bold;break-after:avoid}dd{margin:0 0 12px}p,dd,dt{white-space:pre-wrap;overflow-wrap:anywhere}figure{margin:16px 0;break-inside:avoid}figure img{display:block;max-width:100%;max-height:360px;width:auto;height:auto;margin:8px auto}figcaption{font-weight:bold;overflow-wrap:anywhere}button{min-height:44px;padding:8px 18px}footer{font-size:12px;color:#526476}@media print{button{display:none}body{margin:0}}</style></head><body><main><button onclick="window.print()">${htmlText(t("Imprimir / Guardar PDF"))}</button><h1>Cristal Water</h1><p>${title} | ${visitLabel(report)}</p>${sections(report).map(s => `<section><h2>${htmlText(s.title)}</h2>${s.photos ? (s.photos.length ? s.photos.map(p => `<figure><figcaption>${htmlText(p.label)}</figcaption>${p.bytes ? `<img src="data:image/jpeg;base64,${p.bytes.toString('base64')}" alt="${htmlText(p.label)}" width="${p.width}" height="${p.height}">` : `<p>${htmlText(p.message)}</p>`}</figure>`).join('') : `<p>${htmlText(s.empty)}</p>`) : s.body ? `<p>${htmlText(s.body)}</p>` : s.rows.length ? `<dl>${s.rows.map(([label, value]) => `<dt>${htmlText(label)}</dt><dd>${htmlText(value)}</dd>`).join('')}</dl>` : `<p>${htmlText(s.empty)}</p>`}</section>`).join('')}<footer>${htmlText(t(report.historicalReview ? "Revisão administrativa: registo da visita" : report.historicalOrigin ? "Documento gerado pelo sistema Cristal Water. Os dados históricos da instalação correspondem à revisão identificada." : "Documento gerado pelo sistema Cristal Water. Os dados da instalação correspondem ao registo atual."))}</footer></main></body></html>`;
}
function renderPdf(report) {
  const t = translator(report.language);
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
      if (fonts.unsupported.size) content.push({ title: t("Caracteres por confirmar"), body: t("Alguns caracteres não são suportados por este PDF e aparecem como [U+...]. Consulte o registo original para confirmar o texto.") });
      const width = doc.page.width - 96;
      function header() {
        const font = doc._font?.name || fonts.regular, size = doc._fontSize || 10;
        doc.fillColor("#145f86").font(fonts.bold).fontSize(20).text("Cristal Water", 48, 34, { width, lineBreak: false });
        doc.fillColor("#334155").font(fonts.regular).fontSize(10).text(
          reportTitle(report) + " | " + visitLabel(report),
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
          "Cristal Water | " + t(reportFooter(report)) + " | " + (page + 1) + "/" + range.count,
          48, doc.page.height - 35, { width, align: "center", lineBreak: false });
        doc.page.margins.bottom = bottom;
      }
      doc.end();
    } catch (error) { doc.destroy(); reject(error); }
  });
}
module.exports = { read, sections, headers, html, text, renderPdf };
