import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const service = require('../src/services/operationalRiskSummaryService');
const rules = require('../frontend/cw-operational-risk-rules');

function fixture({ reverse = false, linked = true, work = false } = {}) {
  const vehicles = [
    { id: 1, plate: 'QA-ONE', assignedTechnicians: [{ id: 11, active: true }, { id: 12, active: true }, { id: 13, active: false }] },
    { id: 2, plate: 'QA-TWO', assignedTechnicians: [{ id: 21, active: true }] },
  ];
  if (reverse) { vehicles.reverse(); vehicles.forEach(vehicle => vehicle.assignedTechnicians.reverse()); }
  const rows = data => ({ findMany: async () => data });
  const db = {
    systemSetting: { findUnique: async () => ({ value: JSON.stringify({ ...rules.defaults, technicianLinkedVehicleIssues: linked }) }), findMany: async () => [] },
    vehicle: rows(vehicles),
    transportGuide: rows(work ? [{ id: 70, vehicleId: 2, items: [] }] : []),
    workGuide: rows(work ? [
      { id: 80, vehicleId: 1, technicianId: 11, guideId: null, items: [] },
      { id: 81, vehicleId: 2, technicianId: 21, guideId: 70, items: [{ name: 'Salt', quantity: 0, unit: 'kg' }] },
    ] : []),
    vehicleMaintenanceRecord: rows([]), operationalLock: rows([]), invoice: rows([]),
  };
  return { $transaction: async read => read(db) };
}

describe('operational risk identities', () => {
  it('keeps every vehicle cause distinct for each active technician', async () => {
    const summary = await service.read(fixture());
    expect(summary.issues).toHaveLength(20);
    expect(new Set(summary.issues.map(issue => issue.id)).size).toBe(20);
    const originals = summary.issues.filter(issue => issue.source === 'RISK_ENGINE');
    expect(originals).toHaveLength(8);
    for (const original of originals) {
      const linked = summary.issues.filter(issue => issue.source === 'VEHICLE_RISK' && issue.vehicleId === original.vehicleId && issue.message === original.message);
      expect(linked.map(issue => issue.technicianId).sort()).toEqual(original.vehicleId === 1 ? [11, 12] : [21]);
      for (const issue of linked) expect(issue.id).toBe('TECHNICIAN_LINK:' + original.id + ':' + issue.technicianId);
    }
    expect(summary.byTechnicianId[13]).toBeUndefined();
    expect(summary.byVehicleId[1]).toHaveLength(12);
    expect(summary.byVehicleId[2]).toHaveLength(8);
  });

  it('does not identify alerts by traversal order or observation time', async () => {
    const first = await service.read(fixture());
    const next = await service.read(fixture({ reverse: true }));
    expect(next.issues.map(issue => issue.id).sort()).toEqual(first.issues.map(issue => issue.id).sort());
  });

  it('keeps guide-document, empty-stock and low-stock causes separate', async () => {
    const summary = await service.read(fixture({ work: true }));
    expect(summary.issues).toHaveLength(20);
    expect(new Set(summary.issues.map(issue => issue.id)).size).toBe(summary.issues.length);
    for (const type of ['MISSING_TRANSPORT_GUIDE', 'MISSING_TRANSPORT_GUIDE_DOCUMENT', 'VEHICLE_STOCK_EMPTY', 'VEHICLE_STOCK_LOW']) {
      const original = summary.issues.find(issue => issue.type === type);
      expect(original).toBeDefined();
      for (const technicianId of original.vehicleId === 1 ? [11, 12] : [21]) {
        expect(summary.issues.find(issue => issue.id === 'TECHNICIAN_LINK:' + original.id + ':' + technicianId)).toMatchObject({ source: 'VEHICLE_RISK', vehicleId: original.vehicleId, technicianId, severity: original.severity, message: original.message });
      }
    }
  });

  it('retains the original alerts when technician linking is disabled', async () => {
    const linked = await service.read(fixture());
    const unlinked = await service.read(fixture({ linked: false }));
    expect(unlinked.issues).toHaveLength(8);
    expect(unlinked.issues.map(issue => issue.id)).toEqual(linked.issues.filter(issue => issue.source === 'RISK_ENGINE').map(issue => issue.id));
    expect(unlinked.byTechnicianId).toEqual({});
  });
});
