'use strict';

function parseRepeatRuleInterval(rule) {
  const value = String(rule || '').trim().toUpperCase();
  if (!value || value === 'NONE') return null;
  const match = value.match(/^EVERY_(\d+)_(DAY|DAYS|MONTH|MONTHS|YEAR|YEARS)$/);
  if (match) return { amount: Number(match[1]), unit: match[2].replace(/^(DAY|MONTH|YEAR)$/, '$1S') };
  return { WEEKLY: { amount: 7, unit: 'DAYS' }, MONTHLY: { amount: 1, unit: 'MONTHS' }, QUARTERLY: { amount: 3, unit: 'MONTHS' }, YEARLY: { amount: 1, unit: 'YEARS' } }[value] || null;
}

function validateRepeatInterval(interval) {
  const max = { DAYS: 1095, MONTHS: 120, YEARS: 10 }[interval?.unit];
  return Boolean(max && Number.isInteger(interval.amount) && interval.amount >= 1 && interval.amount <= max);
}

function normalizeRepeatRuleInput(body = {}) {
  const raw = String(body.repeatRule || '').trim().toUpperCase();
  if (!raw || raw === 'NONE') return 'NONE';
  const unit = String(body.customRepeatUnit ?? body.repeatUnit ?? 'DAYS').trim().toUpperCase();
  const units = { DAY: 'DAYS', DIA: 'DAYS', DIAS: 'DAYS', DAYS: 'DAYS', MONTH: 'MONTHS', MES: 'MONTHS', MESES: 'MONTHS', MONTHS: 'MONTHS', YEAR: 'YEARS', ANO: 'YEARS', ANOS: 'YEARS', YEARS: 'YEARS' };
  const interval = raw === 'CUSTOM'
    ? { amount: Number(body.customRepeatValue ?? body.customRepeatDays ?? body.repeatEveryDays), unit: units[unit] }
    : parseRepeatRuleInterval(raw);
  if (!validateRepeatInterval(interval)) throw Object.assign(new Error('Repeticao invalida. Usa personalizada com dias, meses ou anos dentro dos limites permitidos.'), { statusCode: 400 });
  return `EVERY_${interval.amount}_${interval.unit}`;
}

function addRepeatInterval(date, interval) {
  const next = new Date(date);
  if (!interval) return next;
  if (interval.unit === 'MONTHS' || interval.unit === 'YEARS') {
    const months = interval.unit === 'YEARS' ? interval.amount * 12 : interval.amount;
    const originalDay = next.getUTCDate();
    next.setUTCDate(1);
    next.setUTCMonth(next.getUTCMonth() + months);
    const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
    next.setUTCDate(Math.min(originalDay, lastDay));
  } else {
    next.setUTCDate(next.getUTCDate() + interval.amount);
  }
  return next;
}

module.exports = { parseRepeatRuleInterval, validateRepeatInterval, normalizeRepeatRuleInput, addRepeatInterval };
