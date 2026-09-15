import { describe,it,expect } from 'vitest';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {validate,calculate}=require('../src/business/finance/ClientRateBusiness');
const period={startsOn:'2028-02-15',endsOn:'2028-02-29',monthlyAmount:120,label:'Verão'};
describe('dated monthly rates',()=>{
 it('prorates leap February once at month total and preserves zero prices',()=>{
  const snapshot=validate({baseMonthlyAmount:80,periods:[period]});
  const q=calculate(snapshot,'2028-02');expect(q.daysInMonth).toBe(29);expect(q.amount).toBe(100.69);expect(q.segments.map(s=>s.days)).toEqual([14,15]);
  expect(calculate(snapshot,'2028-03').amount).toBe(80);
  expect(calculate(validate({baseMonthlyAmount:80,periods:[{...period,startsOn:'2028-02-01',monthlyAmount:0}]}),'2028-02').amount).toBe(0);
 });
 it('supports permanent rates, inclusive end and adjacent periods',()=>{
  const s=validate({baseMonthlyAmount:80,periods:[{startsOn:'2027-12-01',endsOn:'2027-12-31',monthlyAmount:90},{startsOn:'2028-01-01',monthlyAmount:100}]});
  expect(calculate(s,'2027-12').amount).toBe(90);expect(calculate(s,'2050-01').amount).toBe(100);
 });
 it.each(['2027-02-29','2028-02-30','2028-13-01','bad'])('rejects impossible date %s',startsOn=>expect(()=>validate({baseMonthlyAmount:80,periods:[{...period,startsOn}]})).toThrow());
 it('rejects overlapping, reverse, infinite overlap and fractional cents',()=>{
  for(const periods of [[period,{...period,startsOn:'2028-02-29'}],[{...period,endsOn:'2028-02-01'}],[{...period,endsOn:null},{...period,startsOn:'2029-01-01',endsOn:null}]])expect(()=>validate({baseMonthlyAmount:80,periods})).toThrow();
  expect(()=>validate({baseMonthlyAmount:1.001,periods:[]})).toThrow();
 });
 it('covers Gregorian month lengths across 25 years',()=>{
  const s=validate({baseMonthlyAmount:80,periods:[]});
  for(let y=2020;y<2045;y++)for(let m=1;m<=12;m++){const q=calculate(s,`${y}-${String(m).padStart(2,'0')}`);expect(q.amount).toBe(80);expect(q.daysInMonth).toBe(new Date(Date.UTC(y,m,0)).getUTCDate());}
 });
});
