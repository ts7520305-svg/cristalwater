import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url), {parse,read}=require('../src/services/dailyServiceLogService');
const day='2094-02-07';
function database(rows=[],broken){const models=['serviceVisit','workGuide','vehicleStockMovement','visitStateLog','technicianTrack','technician','user','locationLog','vehicle'];const tx=Object.fromEntries(models.map(name=>[name,{findMany:async()=>{if(name===broken)throw Error('PRIVATE_DATABASE_FAILURE');return name==='serviceVisit'?rows:[];}}]));return {$transaction:async(fn,options)=>{expect(options.isolationLevel).toBe('RepeatableRead');return fn(tx);}};}
describe('daily operational read provenance',()=>{
 it('binds an exact UTC day and canonical optional filters',()=>{const p=parse({date:day,technicianId:'7',vehicleId:'8'});expect(p.start.toISOString()).toBe(day+'T00:00:00.000Z');expect(p.end.toISOString()).toBe('2094-02-08T00:00:00.000Z');expect(p.technicianFilter).toBe(7);expect(p.vehicleFilter).toBe(8);});
 it('does not fall back to today or all technicians for invalid selections',()=>{for(const query of [{date:'2094-02-30'},{date:day+'suffix'},{date:[day]},{date:day,day},{date:day,technicianId:'01'},{date:day,technicianId:'7.1'},{date:day,vehicleId:'2147483648'},{date:day,unexpected:'1'}])expect(()=>parse(query)).toThrow();});
 it('reports a real empty snapshot without inventing counts',async()=>{const r=await read({date:day},database());expect(r.complete).toBe(true);expect(r.services).toEqual([]);expect(r.timeline).toEqual([]);expect(r.summary.services).toBe(0);expect(r.visitType).toBe('REGULAR');});
 it('aborts the entire result if any required source fails',async()=>{await expect(read({date:day},database([{id:1,status:'PLANNED'}],'vehicleStockMovement'))).rejects.toThrow('PRIVATE_DATABASE_FAILURE');});
 it('marks a bounded result as partial instead of presenting its counts as complete',async()=>{const rows=Array.from({length:501},(_,i)=>({id:i+1,status:'PLANNED',date:new Date(day+'T12:00:00Z'),client:null,pool:null,technician:null}));const r=await read({date:day},database(rows));expect(r.services).toHaveLength(500);expect(r.complete).toBe(false);expect(r.limits).toEqual([{source:'serviceVisit',limit:500}]);expect(r.summary.services).toBe(500);});
});
