import { it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { normalize } = require('../src/business/admin/ReminderCreationBusiness');
const base = { title: ' Limpar filtro ', dueAt: '2028-01-31T10:00:00Z' };
it.each([
  { title: {} }, { title: ' ' }, { title: 'x'.repeat(301) }, { dueAt: true }, { dueAt: 'invalid' },
  { technicianId: true }, { technicianId: 1.5 }, { technicianId: [1] }, { technicianId: -1 },
  { priority: 'BOGUS' }, { description: {} }, { requestId: '' }, { requestId: 'invalid' },
])('rejects malformed creation input %j', change => {
  expect(() => normalize({ ...base, ...change }, '1')).toThrow();
});
it('normalizes equivalent recurrence forms and binds service reminders to the route pool', () => {
  const a = normalize({ ...base, repeatRule: 'MONTHLY', poolId: 999, clientId: 999 }, '1');
  const b = normalize({ ...base, repeatRule: 'EVERY_1_MONTHS' }, '1');
  expect(a).toEqual(b); expect(a.data.title).toBe('Limpar filtro');
  expect(a.data.poolId).toBe(1); expect(a.data.clientId).toBe(null);
});
