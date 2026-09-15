function civilDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Data inválida, use AAAA-MM-DD');
  const date = new Date(value + 'T00:00:00.000Z');
  if (!Number.isFinite(+date) || date.toISOString().slice(0, 10) !== value || date.getUTCFullYear() < 2000 || date.getUTCFullYear() > 2199) throw new Error('Data inválida (2000–2199)');
  return date;
}
function advance(date, unit, count) {
  if (!Number.isInteger(count) || count < 1 || count > (unit === 'DAYS' ? 3650 : 120) || !['DAYS', 'MONTHS'].includes(unit)) throw new Error('Intervalo inválido');
  const current = civilDate(date instanceof Date ? date.toISOString().slice(0, 10) : date);
  if (unit === 'DAYS') current.setUTCDate(current.getUTCDate() + count);
  else {
    const day = current.getUTCDate();
    current.setUTCDate(1); current.setUTCMonth(current.getUTCMonth() + count);
    const last = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0)).getUTCDate();
    current.setUTCDate(Math.min(day, last));
  }
  return civilDate(current.toISOString().slice(0, 10));
}
function dayLisbon(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = type => parts.find(part => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
module.exports = { civilDate, advance, dayLisbon };
