import { it, expect } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../src/business/technician/TechnicianBriefingBusiness.js', import.meta.url), 'utf8');

it.each(['generalReminder', 'operationalReminder'])('does not report an empty briefing when %s cannot be read', async failing => {
  const prisma = Object.fromEntries(['generalReminder', 'operationalReminder'].map(name => [name, {
    async findMany() { if (name === failing) throw Error('database unavailable'); return []; },
  }]));
  const sandbox = { require: () => ({ prisma }), module: { exports: {} } };
  vm.runInNewContext(source, sandbox);
  await expect(sandbox.module.exports.loadVisitBriefings([{ poolId: 7, clientId: 3, technicianId: 4 }])).rejects.toThrow('database unavailable');
});
