"use strict";
const { writePdfResponse, line, section, paragraph } = require('./documentPdfService');
const unreadable = () => { throw Object.assign(Error('O relatório guardado está incompleto ou ilegível. Peça revisão ao escritório.'), { statusCode: 409 }); };
const count = value => { if (!Number.isSafeInteger(value) || value < 0) unreadable(); return value; };

async function generateMonthlyReportPDF(res, report) {
  // Validate the saved snapshot before response bytes; never reconstruct history
  // using the client's current pools, names, payment state or visit totals.
  const data = report.data;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(report.month) || !data || typeof data.client !== 'string' || !Array.isArray(data.pools)) unreadable();
  const blocks = [];
  line(blocks, 'Cliente', data.client);
  line(blocks, 'Mês', report.month);
  line(blocks, 'Estado de pagamento guardado', data.paymentStatus);
  if (data.reportVersion === 2) {
    paragraph(blocks, 'Visitas regulares. Contagem pela data de fecho, em UTC.');
    paragraph(blocks, 'Registos sem data de fecho ficam por confirmar, pelo mês planeado ou pela data antiga do registo.');
  }
  paragraph(blocks, 'Dados do cliente, instalações e pagamento correspondem ao relatório guardado; esta consulta não atualiza o histórico.');
  if (!data.pools.length) paragraph(blocks, 'Sem piscinas registadas neste relatório.');
  for (const pool of data.pools) {
    if (!pool || typeof pool.name !== 'string') unreadable();
    section(blocks, `Piscina: ${pool.name}`);
    paragraph(blocks, `Visitas realizadas: ${count(pool.totalVisits)}`);
    paragraph(blocks, `Não realizadas: ${count(pool.notDone)}`);
    if (data.reportVersion === 2 && pool.unconfirmed != null) {
      count(pool.unconfirmed);
      if (pool.unconfirmed) paragraph(blocks, `Por confirmar: ${pool.unconfirmed} - falta a data de fecho.`);
    }
  }
  await writePdfResponse(res, `relatorio-${report.month}.pdf`, 'Relatório Mensal', output => output.push(...blocks), { disposition: 'attachment', reference: `Relatório #${report.id}` });
}
module.exports = { generateMonthlyReportPDF };
