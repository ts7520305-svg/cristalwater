import { it, expect } from 'vitest';
import { createRequire } from 'node:module';
const { civilDate, advance, dayLisbon } = createRequire(import.meta.url)('../src/services/equipmentMaintenanceCalendar');
it('clamps monthly maintenance anniversaries across short months and leap years', () => {
  expect(advance('2028-01-31','MONTHS',1).toISOString().slice(0,10)).toBe('2028-02-29');
  expect(advance('2027-01-31','MONTHS',1).toISOString().slice(0,10)).toBe('2027-02-28');
  expect(advance('2028-02-29','MONTHS',12).toISOString().slice(0,10)).toBe('2029-02-28');
  expect(advance('2026-12-31','MONTHS',2).toISOString().slice(0,10)).toBe('2027-02-28');
});
it('uses Lisbon operational days and civil intervals across daylight saving', () => {
  expect(dayLisbon(new Date('2026-07-01T23:30:00Z'))).toBe('2026-07-02');
  expect(dayLisbon(new Date('2026-01-01T23:30:00Z'))).toBe('2026-01-01');
  expect(advance('2026-03-28','DAYS',2).toISOString()).toBe('2026-03-30T00:00:00.000Z');
  expect(advance('2028-02-28','DAYS',1).toISOString().slice(0,10)).toBe('2028-02-29');
});
it('rejects impossible dates, rollover inputs and unbounded intervals', () => {
  for (const invalid of ['2026-02-29','2026-04-31','26-01-01','2026-1-1',null,'2200-01-01']) expect(() => civilDate(invalid)).toThrow();
  for (const count of [0,-1,1.5,121,'1']) expect(() => advance('2026-01-01','MONTHS',count)).toThrow();
  expect(() => advance('2026-01-01','YEARS',1)).toThrow();
});
