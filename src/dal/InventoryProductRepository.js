const prisma = require('../prismaClient');
const { normalizeProductName, normalizeUnit } = require('../utils/stockNormalizer');
function n(v,d=0){const x=Number(v);return Number.isFinite(x)?x:d;}
function s(v){return typeof v==='string'?v.trim():v==null?'':String(v).trim();}
function stockName(v){return normalizeProductName(s(v));}
function stockUnit(v){return normalizeUnit(s(v)||'KG');}
function isUniqueConstraintError(err){return err&&(err.code==='P2002'||String(err.message||'').includes('Unique constraint'));}
async function upsertProduct(raw, client = prisma) {
  const { name, sku, brand, category, unit, unitCost } = raw || {};
  const productName = stockName(name || raw?.productName);
  const productUnit = stockUnit(unit);
  const cleanSku = s(sku);
  const data = {
    name: productName,
    brand: s(brand) || null,
    category: s(category) || 'CHEMICAL',
    unit: productUnit,
    defaultCost: n(unitCost, 0),
  };

  if (!productName) return null;

  // Tranca lógica por produto/unidade durante a transação PostgreSQL.
  // Evita corrida findFirst -> create quando várias faturas entram em simultâneo.
  if (client?.$executeRawUnsafe) {
    const lockKey = `${productName}:${productUnit}`;
    await client.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', lockKey).catch(() => null);
  }

  try {
    if (cleanSku) {
      return await client.inventoryProduct.upsert({
        where: { sku: cleanSku },
        update: data,
        create: { ...data, sku: cleanSku },
      });
    }

    const existing = await client.inventoryProduct.findFirst({
      where: { name: { equals: productName, mode: 'insensitive' }, unit: productUnit },
    });

    if (existing) {
      return await client.inventoryProduct.update({
        where: { id: existing.id },
        data: {
          category: data.category || existing.category,
          defaultCost: n(unitCost, existing.defaultCost || 0),
          active: true,
            archiveStatus: "ATIVO",
            deletedAt: null,
        },
      });
    }

    return await client.inventoryProduct.create({ data });
  } catch (err) {
    // Fallback defensivo para colisões de concorrência ou constraint única em DBs já migradas.
    if (isUniqueConstraintError(err)) {
      const existing = await client.inventoryProduct.findFirst({
        where: cleanSku
          ? { OR: [{ sku: cleanSku }, { name: { equals: productName, mode: 'insensitive' }, unit: productUnit }] }
          : { name: { equals: productName, mode: 'insensitive' }, unit: productUnit },
      });
      if (existing) {
        return client.inventoryProduct.update({
          where: { id: existing.id },
          data: {
            category: data.category || existing.category,
            defaultCost: n(unitCost, existing.defaultCost || 0),
            active: true,
            archiveStatus: 'ATIVO',
            deletedAt: null,
          },
        });
      }
    }
    throw err;
  }
}

module.exports={upsertProduct};
