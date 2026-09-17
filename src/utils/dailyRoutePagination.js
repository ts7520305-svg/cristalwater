'use strict';

// Daily operational screens need the complete assigned list. Pagination is an
// explicit API option, never an implicit truncation of the route snapshot.
function parseDailyRoutePage(query = {}) {
  const invalid = () => Object.assign(new Error('Paginação inválida: use limit inteiro positivo e offset inteiro não negativo.'), { status: 400 });
  if (query.limit === undefined) {
    if (query.offset !== undefined) throw invalid();
    return { limit: null, offset: 0 };
  }
  if (!/^\d+$/.test(String(query.limit)) || !Number.isSafeInteger(Number(query.limit)) || Number(query.limit) < 1) throw invalid();
  const offset = query.offset === undefined ? 0 : Number(query.offset);
  if (query.offset !== undefined && (!/^\d+$/.test(String(query.offset)) || !Number.isSafeInteger(offset))) throw invalid();
  return { limit: Math.min(Number(query.limit), 300), offset };
}

function dailyRoutePage(rows, { limit, offset }) {
  const visits = limit === null ? rows : rows.slice(offset, offset + limit);
  const hasMore = offset + visits.length < rows.length;
  return { total: rows.length, returned: visits.length, complete: offset === 0 && visits.length === rows.length, limit, offset, hasMore, nextOffset: hasMore ? offset + visits.length : null, visits };
}

module.exports = { parseDailyRoutePage, dailyRoutePage };
