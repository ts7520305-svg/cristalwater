'use strict';
function extraProjection(row) {
  const execution = row.execution && typeof row.execution === 'object' && !Array.isArray(row.execution) ? row.execution : {};
  const absent = value => value === undefined || value === null;
  const reading = key => absent(execution[key]) ? 'Não registado' : typeof execution[key] === 'number' && Number.isFinite(execution[key]) ? execution[key] : 'Por confirmar';
  const checks = Object.fromEntries(['cleaned','brushed','vacuumed','basketCleaned','waterlineClean','backwashDone'].map(key => [key, absent(execution[key]) ? null : typeof execution[key] === 'boolean' ? execution[key] : 'Por confirmar']));
  const products = execution.chemicalsJson;
  const validProducts = Array.isArray(products) && products.length <= 50 && products.every(p => p && typeof p.name === 'string' && p.name.trim() && p.name.length <= 200 && typeof p.quantity === 'number' && Number.isFinite(p.quantity) && p.quantity > 0 && typeof p.unit === 'string' && p.unit.trim() && p.unit.length <= 100);
  return { ...row, ...checks, ...Object.fromEntries(['ph','chlorine','alkalinity','salt','temperature','orpMv'].map(key => [key, reading(key)])),
    plannedDate: row.scheduledAt, technicianName: row.technician?.name,
    chemicals: validProducts ? products.map(p => ({ name: p.name, quantity: p.quantity, unit: p.unit })) : [],
    chemicalNotice: validProducts ? 'Nenhum químico registado.' : absent(products) ? 'Consumo não registado.' : 'Consumo por confirmar. Peça a revisão do registo.',
    notes: typeof execution.notes === 'string' ? execution.notes || 'Sem observações registadas.' : absent(execution.notes) ? 'Observações de execução não registadas.' : 'Observações de execução por confirmar.',
    internalNotes: typeof row.internalNote === 'string' ? row.internalNote : null,
    planningNotes: typeof row.notes === 'string' ? row.notes : null,
    problem: typeof execution.problem === 'string' ? execution.problem : null,
  };
}

module.exports = extraProjection;
