'use strict';
const SERVICE_CATEGORIES = Object.freeze(['TECHNICAL_PERIODIC_SERVICE', 'POOL_SERVICE_REMINDER']);
function id(value, optional = false) {
  if (optional && (value === undefined || value === null || value === '')) return null;
  if (!['string', 'number'].includes(typeof value) || !/^[1-9]\d*$/.test(String(value)) || Number(value) > 2147483647) {
    throw Object.assign(new Error('Identificador invalido'), { statusCode: 400 });
  }
  return Number(value);
}
module.exports = { id, SERVICE_CATEGORIES };
