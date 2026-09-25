import {describe,it,expect} from 'vitest';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),R=require('../frontend/cw-technician-management-rules'),pins=require('../src/services/technicianPinService');
const fields={name:' Name ',email:' TEch@qa.test ',phone:' 123 ',zone:' Algarve ',vehicleId:null,pin:'001234'},owner='ADMIN:2',requestId='01234567-89ab-4def-8123-456789abcdef';
describe('technician management',()=>{
 it('keeps reviewed PINs and nested credentials out of request audit without changing the actual request',()=>{
  const logger=require('../src/services/loggerService'),middleware=require('../src/middlewares/auditMiddleware'),original=logger.audit;let recorded;
  const body={operation:'PIN',requestId,reviewToken:'private-proof',fields:{pin:'001234',phone:'910123456'},rows:[{Password:'private-password',retained:'yes',child:{token:'private-token'}}]},snapshot=structuredClone(body);
  try{logger.audit=(_name,data)=>{recorded=data;};middleware({method:'POST',originalUrl:'/api/technicians/manage/commit',body},{statusCode:200,on:(_event,fn)=>fn()},()=>{});expect(recorded.body).toEqual({operation:'PIN',requestId,fields:{phone:'910123456'},rows:[{retained:'yes',child:{}}]});expect(body).toEqual(snapshot);}finally{logger.audit=original;}
 });
 it('bounds nested request auditing so malformed deep input cannot expose its credential',()=>{
  const logger=require('../src/services/loggerService'),middleware=require('../src/middlewares/auditMiddleware'),original=logger.audit;let recorded,body={pin:'private-deep'};for(let i=0;i<100;i++)body={next:body};
  try{logger.audit=(_name,data)=>{recorded=data;};middleware({method:'POST',originalUrl:'/api/technicians/manage/review',body},{statusCode:400,on:(_event,fn)=>fn()},()=>{});expect(JSON.stringify(recorded)).not.toContain('private-deep');expect(JSON.stringify(recorded).length).toBeLessThan(1000);}finally{logger.audit=original;}
 });
 it('normalizes editable identity while preserving PIN zeros',()=>{expect(R.fields('CREATE',fields)).toEqual({email:'tech@qa.test',name:'Name',phone:'123',pin:'001234',vehicleId:null,zone:'Algarve'});});
 it('never inserts a default PIN and permits explicit creation without PIN',()=>{expect(R.fields('CREATE',{...fields,pin:''}).pin).toBe('');for(const pin of ['1234','12345',' 001234','001234 ','1234567890123',123456,null,'abc123'])expect(R.fields('CREATE',{...fields,pin})).toBeNull();});
 it('requires the exact fields for each reviewed operation',()=>{expect(R.fields('PIN',{pin:'001234'})).toEqual({pin:'001234'});for(const operation of ['ACTIVATE','DEACTIVATE','ARCHIVE']){expect(R.fields(operation,{})).toEqual({});expect(R.fields(operation,{name:'erase'})).toBeNull();}expect(R.fields('EDIT',fields)).toBeNull();expect(R.fields('DELETE',{})).toBeNull();});
 it('rejects role, cost, location, history and credential-version assignment',()=>{for(const field of ['role','active','authVersion','costPerVisit','latitude','deletedAt','serviceVisits'])expect(R.fields('CREATE',{...fields,[field]:1})).toBeNull();});
 it('refuses invalid identity/vehicle values rather than coercing them',()=>{for(const patch of [{name:' '},{name:'x\u0000'},{email:'not-an-email'},{vehicleId:'1'},{vehicleId:0},{vehicleId:2147483648},{phone:null}])expect(R.fields('CREATE',{...fields,...patch})).toBeNull();});
 it('supports strict bounded paging and active filters',()=>{expect(R.query({page:'2',active:'all',q:' Lagos '})).toEqual({page:2,active:'all',q:'Lagos'});for(const q of [{page:'01'},{page:'0'},{page:'1000001'},{active:'yes'},{pin:'123456'},{q:['a']}])expect(R.query(q)).toBeNull();});
 it('retains only an owned operation reference across reload',()=>{const p={version:1,owner,operation:'PIN',technicianId:4,requestId};expect(R.pending(JSON.stringify(p),owner)).toEqual(p);for(const patch of [{owner:'ADMIN:3'},{pin:'001234'},{fields:{}},{reviewToken:'secret'},{technicianId:null},{operation:'DELETE'}])expect(R.pending(JSON.stringify({...p,...patch}),owner)).toBe(false);});
 it('does not expose a PIN in trusted technician records',()=>{const t={id:2,name:'Name',active:true,hasPin:true,updatedAt:'2026-09-25T15:00:00.000Z'};expect(R.tech(t)).toBe(true);expect(R.tech({...t,pin:'hidden'})).toBe(false);expect(R.tech({...t,password:'hidden'})).toBe(false);});
 it('hashes new PINs and verifies historical plain PINs without rewriting them',async()=>{const pin='001234',hash=await pins.hash(pin);expect(hash).not.toBe(pin);expect(pins.hashed(hash)).toBe(true);expect(await pins.matches(pin,hash)).toBe(true);expect(await pins.matches('001235',hash)).toBe(false);expect(await pins.matches('1111','1111')).toBe(true);expect(await pins.matches(pin,null)).toBe(false);});
 it('refuses ambiguous legacy PINs instead of choosing the first identity',async()=>{const db={technician:{findMany:async({where})=>where.id.gt?[]:[{id:1,pin:'1234'},{id:2,pin:'1234'}]}};expect(await pins.findMatches(db,'1234')).toEqual([1,2]);});
});
