import { it, expect } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const presentation = require('../src/services/alertPresentationService');
const source = fs.readFileSync(new URL('../src/business/admin/AlertListBusiness.js', import.meta.url), 'utf8');

it.each(['notification', 'technicalAlert', 'serviceVisit', 'alert', 'linkedVisit', 'repair'])(
  'rejects the whole alert list when %s fails, including after a complete first page', async failure => {
    const calls = {};
    const tx = Object.fromEntries(['notification', 'technicalAlert', 'serviceVisit', 'alert', 'repair'].map(name => [name, {
      async findMany(query) {
        const linked = name === 'serviceVisit' && query.where.id;
        const key = linked ? 'linkedVisit' : name;
        calls[key] = (calls[key] || 0) + 1;
        if (key === failure) {
          if (calls[key] === 1 && !['linkedVisit', 'repair'].includes(key)) return Array.from({ length: 500 }, (_, i) => ({ id: i + 1 }));
          throw Error(`${key} unavailable`);
        }
        return name === 'notification' ? [{ id: 700, metadata: { visitId: 5, repairId: 6 } }] : [];
      },
    }]));
    const prisma = { $transaction: async (fn, options) => {
      expect(options.isolationLevel).toBe('RepeatableRead');
      return fn(tx);
    } };
    const sandbox = { require: name => name.endsWith('prismaClient') ? { prisma } : presentation, module: { exports: {} } };
    vm.runInNewContext(source, sandbox);
    await expect(sandbox.module.exports.list()).rejects.toThrow(`${failure} unavailable`);
    expect(calls[failure]).toBe(['linkedVisit', 'repair'].includes(failure) ? 1 : 2);
  },
);
