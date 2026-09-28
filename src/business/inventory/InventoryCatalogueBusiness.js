'use strict';
const { prisma } = require('../../prismaClient');
const PAGE_SIZE = 500;

// Preserve the complete legacy JSON list while bounding each database read.
// One snapshot keeps cursor names/status stable if the catalogue changes while
// it is being read. A failed page or commit rejects the entire response.
async function listProducts(query = {}) {
  const q = String(query.q ?? '').trim();
  const where = q ? { OR: ['name', 'sku', 'brand'].map(field => ({ [field]: { contains: q, mode: 'insensitive' } })) } : {};
  if (query.includeInactive !== 'true' && query.active !== 'all') where.active = true;
  return prisma.$transaction(async tx => {
    const products = [];
    let cursor;
    for (;;) {
      const rows = await tx.inventoryProduct.findMany({
        where, orderBy: [{ active: 'desc' }, { name: 'asc' }, { id: 'asc' }], take: PAGE_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      products.push(...rows);
      if (rows.length < PAGE_SIZE) break;
      cursor = rows.at(-1).id;
    }
    return { ok: true, products };
  }, { isolationLevel: 'RepeatableRead', timeout: 30000 });
}

module.exports = { listProducts };
