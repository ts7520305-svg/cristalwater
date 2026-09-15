import {describe,it,expect,vi} from 'vitest';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const silent={log(){},warn(){},error(){}};
function loadBusiness(db){
 const file=require.resolve('../src/business/technician/TechnicianGpsBusiness');
 const context={module:{exports:{}},process:{env:{}},console:silent,global:{},require:name=>name.includes('prismaClient')?{prisma:db}:require(path.resolve(path.dirname(file),name))};
 vm.runInNewContext(fs.readFileSync(file,'utf8'),context);return context.module.exports;
}
describe('geofence failure cannot confirm physical presence',()=>{
 it('does not report success when starting the visit fails',async()=>{
  const tx={$queryRaw:async()=>[],serviceVisit:{findUnique:async()=>({id:1,technicianId:41,status:'PLANNED',pool:{latitude:37,longitude:-8}}),update:async()=>{throw Error('Database write failed');}},auditTrail:{create:async()=>{}}};
  const business=loadBusiness({$transaction:fn=>fn(tx)});
  await expect(business.validateGeofence({visitId:1,currentLatitude:37,currentLongitude:-8,actor:{id:41,role:'TECHNICIAN'}})).rejects.toThrow('Database write failed');
 });
 it('uses a complete client coordinate pair instead of mixing it with incomplete pool GPS',async()=>{
  const tx={$queryRaw:async()=>[],serviceVisit:{findUnique:async()=>({id:1,technicianId:41,status:'PLANNED',pool:{latitude:37,longitude:null,client:{latitude:38,longitude:-7}}}),update:async()=>({})},auditTrail:{create:async()=>{}}};
  const result=await loadBusiness({$transaction:fn=>fn(tx)}).validateGeofence({visitId:1,currentLatitude:38,currentLongitude:-7,actor:{id:41,role:'TECHNICIAN'}});
  expect(result.statusCode).toBe(200);expect(result.body.inside).toBe(true);expect(result.body.distance).toBe(0);
 });
 it('requires an authenticated actor even for internal calls',async()=>{
  const transaction=vi.fn(),business=loadBusiness({$transaction:transaction});
  const result=await business.validateGeofence({visitId:1,currentLatitude:37,currentLongitude:-8});expect(result.statusCode).toBe(403);expect(transaction).not.toHaveBeenCalled();
 });
 it('returns unavailable and unknown presence when the business layer fails',async()=>{
  const handlers={},router={use(){},get(){},post:(route,handler)=>handlers[String(route)]=handler};
  const validate=vi.fn(async()=>{throw Error('Database unavailable');});
  const file=require.resolve('../src/routes/gpsRoutes');
  const context={module:{exports:{}},console:silent,require:name=>name==='express'?{Router:()=>router}:name.includes('TechnicianGpsBusiness')?{validateGeofence:validate}:name.includes('authMiddleware')?()=>()=>{}:require(path.resolve(path.dirname(file),name))};
  vm.runInNewContext(fs.readFileSync(file,'utf8'),context);
  const response={status(value){this.code=value;return this;},json(value){this.body=value;return this;}};
  await handlers['/validate-geofence']({user:{id:41,role:'TECHNICIAN'},body:{visitId:1,latitude:37,longitude:-8}},response);
  expect(validate.mock.calls[0][0].actor.id).toBe(41);expect(response.code).toBe(503);expect(response.body.success).toBe(false);expect(response.body.inside).toBeNull();expect(response.body.requiresManualConfirmation).toBe(true);
 });
});
