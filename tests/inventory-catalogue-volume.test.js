import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../src/business/inventory/InventoryCatalogueBusiness.js', import.meta.url), 'utf8');

function setup(pages = [[]], failure) {
  const calls = [], transactions = [], error = Error('PRIVATE_DATABASE_ERROR');
  const tx = { inventoryProduct: { findMany: async args => {
    calls.push(args); if (failure === calls.length) throw error; return pages[calls.length - 1];
  } } };
  const prisma = new Proxy({ $transaction: async (callback, options) => {
    transactions.push(options); if (failure === 'start') throw error;
    const result = await callback(tx); if (failure === 'commit') throw error; return result;
  } }, { get(target, property) { if (property !== '$transaction') throw Error('Query outside snapshot'); return target[property]; } });
  const sandbox = { module: { exports: {} }, require: name => { if (name === '../../prismaClient') return { prisma }; throw Error('Unexpected dependency'); } };
  vm.runInNewContext(source, sandbox);
  return { ...sandbox.module.exports, calls, transactions, error };
}

describe('complete inventory catalogue with bounded database pages', () => {
  it.each([0, 1, 499, 500, 501, 1000, 1001])('retains every row and field for %s products', async count => {
    const rows = Array.from({ length: count }, (_, index) => ({ id: index + 1, name: 'Duplicate name', active: index < 500, notes: '<literal>', defaultCost: 1.25 }));
    const pages = []; for (let i = 0; i < rows.length; i += 500) pages.push(rows.slice(i, i + 500)); if (count % 500 === 0) pages.push([]);
    const test = setup(pages), output = await test.listProducts({ includeInactive: 'true' });
    expect(output).toEqual({ ok: true, products: rows });
    expect(test.transactions).toEqual([{ isolationLevel: 'RepeatableRead', timeout: 30000 }]);
    expect(test.calls).toHaveLength(Math.floor(count / 500) + 1);
    test.calls.forEach((query, index) => {
      expect(query.where).toEqual({}); expect(query.take).toBe(500);
      expect(query.orderBy).toEqual([{ active: 'desc' }, { name: 'asc' }, { id: 'asc' }]);
      expect(query.select).toBeUndefined(); expect(query.include).toBeUndefined();
      expect(query.cursor).toEqual(index ? { id: index * 500 } : undefined); expect(query.skip).toBe(index ? 1 : undefined);
    });
  });
  it.each([{}, { includeInactive: 'false' }, { active: 'true' }])('retains the default active filter for %s', async query => {
    const test = setup(); await test.listProducts(query); expect(test.calls[0].where).toEqual({ active: true });
  });
  it.each([{ includeInactive: 'true' }, { active: 'all' }])('retains the inactive aliases for %s', async query => {
    const test = setup(); await test.listProducts(query); expect(test.calls[0].where).toEqual({});
  });
  it('trims the search and retains case-insensitive name/SKU/brand matching', async () => {
    const test = setup(); await test.listProducts({ q: '  Ácido  ' });
    expect(test.calls[0].where).toEqual({ active: true, OR: ['name', 'sku', 'brand'].map(field => ({ [field]: { contains: 'Ácido', mode: 'insensitive' } })) });
  });
  it.each([1, 2, 'start', 'commit'])('does not publish partial products after failure %s', async failure => {
    const test = setup([Array.from({ length: 500 }, (_, i) => ({ id: i + 1 })), []], failure);
    await expect(test.listProducts()).rejects.toBe(test.error); expect(test.transactions).toHaveLength(1);
  });
});
