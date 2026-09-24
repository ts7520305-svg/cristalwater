import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
const require = createRequire(import.meta.url), rules = require('../frontend/cw-maintenance-material-rules');
const costs = require('../src/services/expenseCostAllocationService');
const labor = require('../src/services/maintenanceLaborShareService'), material = require('../src/services/maintenanceMaterialShareService');
const source = (endAt = '2025-12-31T23:59:59.999Z') => ({ monthRef: endAt.slice(0, 7), targetSnapshot: { endAt } });
const target = endAt => ({ snapshot: { endAt } });
function proof(parent, child, version = 1) { const a = source(parent), t = target(child); return { allocationBefore: a, target: t, ...rules.sharePeriod(a, t, version) }; }
describe('maintenance shares between execution months', () => {
  it('keeps old same-month versions and shapes without adding period fields', () => {
    for (const version of [1,2,3,4,5,7]) {
      const p = proof('2026-02-01T00:00:00.000Z', '2026-02-28T23:59:59.999Z', version);
      expect(p.version).toBe(version); expect(p).not.toHaveProperty('period'); expect(rules.verifyPeriod(p, version)).toBe(p);
    }
  });
  it('uses canonical UTC completion months across year and leap-day boundaries', () => {
    for (const [start,end] of [['2025-12-31T23:59:59.999Z','2026-01-01T00:00:00.000Z'],['2024-02-29T23:59:59.999Z','2024-03-01T00:00:00.000Z'],['2026-02-01T00:00:00.000Z','2026-01-31T23:59:59.999Z']]) {
      const p = proof(start, end, 5); expect(rules.verifyPeriod(p, 5)).toBe(p);
      expect(p).toMatchObject({ version:6, monthRef:end.slice(0,7), period:{schema:1,basis:'CONFIRMED_EXECUTION_MONTHS_UTC',parentMonthRef:start.slice(0,7),maintenanceMonthRef:end.slice(0,7)} });
    }
  });
  it('rejects forged months, period downgrades, redundant claims and noncanonical dates', () => {
    const changes = [p=>p.monthRef='2026-03',p=>p.period.parentMonthRef='2026-01',p=>p.period.maintenanceMonthRef='2025-12',p=>p.period.schema=2,p=>p.period.basis='MANUAL',p=>p.period.extra=true,p=>p.period=null,p=>delete p.period,p=>p.version=5,p=>p.allocationBefore.monthRef='2026-01',p=>p.target.snapshot.endAt='2026-01-01T01:00:00+01:00',p=>p.target.snapshot.endAt='2026-02-30T00:00:00.000Z'];
    for (const change of changes) { const p=proof('2025-12-31T23:59:59.999Z','2026-01-01T00:00:00.000Z',5);change(p);expect(()=>rules.verifyPeriod(p,5)).toThrow(); }
    const same=proof('2026-01-01T00:00:00.000Z','2026-01-02T00:00:00.000Z');same.period=undefined;expect(()=>rules.verifyPeriod(same,1)).toThrow();
  });
  it('uses exactly the same rules in the browser', () => {
    const c={};vm.runInNewContext(fs.readFileSync(new URL('../frontend/cw-maintenance-material-rules.js',import.meta.url),'utf8'),c);
    const p=proof('2025-12-31T23:59:59.999Z','2026-01-01T00:00:00.000Z',4);expect(c.CWMaintenanceMaterialRules.verifyPeriod(p,4)).toBe(p);
    expect(JSON.parse(JSON.stringify(c.CWMaintenanceMaterialRules.sharePeriod(p.allocationBefore,p.target,4)))).toEqual(rules.sharePeriod(p.allocationBefore,p.target,4));
  });
  it('conserves cents and measured quantities across months and returns voided shares to the original month', () => {
    for (const kind of ['LABOR','MATERIAL']) for (const destination of ['MAINTENANCE_EQUIPMENT','MAINTENANCE_REMINDER']) {
      const a={...source(),id:1,expenseId:1,amountCents:100,quantity:kind==='LABOR'?'3':'0.3',quantityUnit:kind==='LABOR'?'SECOND':'KG',valuationType:kind,voidedAt:null,needsReview:false,reviewReasons:[]};
      const p={...proof('2025-12-31T23:59:59.999Z','2026-01-01T00:00:00.000Z'),amountCents:33,quantity:'0.1',workTime:{durationMs:1000},target:{type:destination,id:9,snapshot:{endAt:'2026-01-01T00:00:00.000Z'}}};
      const s={share:{id:'share',completionId:destination==='MAINTENANCE_EQUIPMENT'?9:null,...(destination==='MAINTENANCE_REMINDER'?{reminderId:9}:{}),preview:p},hash:'hash',voidedAt:null,needsReview:false};
      a[kind==='LABOR'?'maintenanceShares':'maintenanceMaterialShares']=[s];
      const service=kind==='LABOR'?labor:material,rows=service.project([a]);
      expect(rows.map(r=>[r.monthRef,r.amountCents])).toEqual([['2025-12',67],['2026-01',33]]);expect(rows[1].sourceMonthRef).toBe('2025-12');expect(rows[1].targetType).toBe(destination);
      expect(rows.reduce((n,r)=>n+rules.quantity(r.quantity),0n)).toBe(rules.quantity(a.quantity));
      const expense={allocations:[a],title:'Origem',unallocatedCents:0};expect(costs.entries([expense],'2026-01')).toHaveLength(1);expect(costs.entries([expense],'2025-12')[0].amountCents).toBe(67);
      s.voidedAt='2026-03-01T00:00:00.000Z';expect(service.project([a])).toEqual([a]);expect(costs.entries([expense],'2026-01')).toEqual([]);expect(costs.entries([expense],'2025-12')[0].amountCents).toBe(100);
    }
  });
  it('never confirms a zero monthly total when a damaged journal could hide a share in another month', () => {
    const s=costs.summary([{allocations:[],unallocatedCents:0,maintenanceShareHistoryReview:true}], '2026-01',new Date('2026-03-01T00:00:00Z'));
    expect(s).toMatchObject({state:'REVIEW',allocatedAmountCents:null,clientAmountCents:null,companyAmountCents:null,unplacedShareReviewCount:1,valuations:{materialAmountCents:null,laborAmountCents:null}});
    expect(costs.summary([{allocations:[],unallocatedCents:0}], '2026-01',new Date())).toMatchObject({state:'READY',allocatedAmountCents:0,unplacedShareReviewCount:0});
  });
});
