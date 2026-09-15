import { it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { parseReference, resolutionVersion, expectedVersion, requirement } = require('../src/services/alertResolutionStateService');
it.each([undefined, null, '', true, {}, [1], 'unknown-1', 'Technical-1', '1.0', '1e0', '01', ' 1', 0, -1, 2147483648])('rejects ambiguous alert reference %j', value => {
  expect(() => parseReference(value)).toThrow();
});
it('keeps legacy numeric notifications and exact supported references', () => {
  expect(parseReference(1)).toEqual({ source: 'notification', id: 1 });
  for (const source of ['technical', 'notification', 'visit', 'generic']) expect(parseReference(`${source}-2147483647`)).toEqual({ source, id: 2147483647 });
});
it.each([null, '', true, {}, 'A'.repeat(64), '1'.repeat(63)])('rejects malformed expected version %j', value => {
  expect(() => expectedVersion(value)).toThrow();
});
it('retains optional legacy versions and makes metadata key order irrelevant', () => {
  expect(expectedVersion(undefined)).toBe(null);
  const a = { id: 1, status: 'OPEN', updatedAt: new Date('2028-01-01T10:00:00Z'), metadata: { a: 1, b: 2 } };
  const b = { ...a, updatedAt: a.updatedAt.toISOString(), metadata: { b: 2, a: 1 } };
  expect(resolutionVersion('notification', a)).toBe(resolutionVersion('notification', b));
  expect(resolutionVersion('notification', a)).not.toBe(resolutionVersion('notification', { ...a, message: 'Changed problem' }));
  expect(resolutionVersion('notification', a)).not.toBe(resolutionVersion('technical', a));
});
it('requires physical and operational workflows independently of severity', () => {
  expect(requirement('technical', { type: 'AGUA_ABERTA', priority: 'LOW' }).code).toBe('PHYSICAL_CONFIRMATION_REQUIRED');
  expect(requirement('notification', { eventType: 'PUMP_MANUAL_OVERDUE' }).code).toBe('PHYSICAL_CONFIRMATION_REQUIRED');
  expect(requirement('visit', { status: 'NOT_DONE' }).code).toBe('VISIT_ACTION_REQUIRED');
  expect(requirement('notification', { eventType: 'EQUIPMENT_MAINTENANCE_DUE' }).code).toBe('MAINTENANCE_ACTION_REQUIRED');
  expect(requirement('technical', { type: 'FILTER_LEAK', priority: 'CRITICAL' })).toBe(null);
});
