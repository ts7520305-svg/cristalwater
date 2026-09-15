import { it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { normalizeRepeatRuleInput: normalize, parseRepeatRuleInterval: parse, addRepeatInterval: add } = require('../src/services/reminderRepeatService');

it.each([
  ['2028-01-31T10:30:00.000Z', 'MONTHLY', '2028-02-29T10:30:00.000Z'],
  ['2027-01-31T10:30:00.000Z', 'MONTHLY', '2027-02-28T10:30:00.000Z'],
  ['2028-02-29T10:30:00.000Z', 'YEARLY', '2029-02-28T10:30:00.000Z'],
  ['2028-11-30T10:30:00.000Z', 'QUARTERLY', '2029-02-28T10:30:00.000Z'],
  ['2028-12-28T10:30:00.000Z', 'WEEKLY', '2029-01-04T10:30:00.000Z'],
  ['2028-03-25T10:30:00.000Z', 'EVERY_2_DAYS', '2028-03-27T10:30:00.000Z'],
])('schedules %s with %s without overflowing the target month', (from, rule, expected) => {
  const date = new Date(from);
  expect(add(date, parse(rule)).toISOString()).toBe(expected);
  expect(date.toISOString()).toBe(from);
});

it.each(['EVERY_0_DAYS', 'EVERY_1096_DAYS', 'EVERY_121_MONTHS', 'EVERY_11_YEARS', 'CUSTOM', 'EVERY_999999999999999999999_YEARS', 'BOGUS'])('rejects an invalid recurrence %s', repeatRule => {
  expect(() => normalize({ repeatRule })).toThrow();
});
it.each([{ customRepeatValue: 1.5 }, { customRepeatValue: 2, customRepeatUnit: 'WEEKS' }])('rejects malformed custom input %j', input => {
  expect(() => normalize({ repeatRule: 'CUSTOM', ...input })).toThrow();
});
it('preserves supported legacy rules and normalizes custom Portuguese units', () => {
  expect(normalize({ repeatRule: 'WEEKLY' })).toBe('EVERY_7_DAYS');
  expect(normalize({ repeatRule: 'CUSTOM', customRepeatValue: 6, customRepeatUnit: 'MESES' })).toBe('EVERY_6_MONTHS');
  expect(normalize({ repeatRule: 'NONE' })).toBe('NONE');
});
