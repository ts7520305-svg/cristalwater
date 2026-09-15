import { it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { id } = require('../src/services/reminderScopeService');
const { version } = require('../src/business/admin/ReminderDeletionBusiness');
it.each([undefined, null, '', true, {}, [1], '1.5', '1e0', '01', ' 1', 0, -1, 2147483648, Infinity])('rejects ambiguous reminder ID %j', value => {
  expect(() => id(value)).toThrow();
});
it('accepts the positive database integer range and explicit optional IDs', () => {
  expect(id('1')).toBe(1); expect(id(2147483647)).toBe(2147483647); expect(id(null, true)).toBe(null);
});
it.each([null, '', true, {}, '2028-02-30T10:00:00.000Z', '2028-01-01', '2028-01-01T10:00:00Z'])('rejects invalid or noncanonical reminder version %j', value => {
  expect(() => version(value)).toThrow();
});
it('retains exact versions and explicitly supports unversioned legacy calls', () => {
  expect(version('2028-01-01T10:00:00.000Z')).toBe('2028-01-01T10:00:00.000Z'); expect(version(undefined)).toBe(null);
});
