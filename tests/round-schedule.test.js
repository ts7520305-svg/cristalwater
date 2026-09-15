import {describe,it,expect} from 'vitest';
const schedule=require('../src/services/roundScheduleService');
describe('Round recurrence calendar',()=>{
  it('keeps weekly defaults and supports Sunday',()=>{const rule=schedule.parse({dayOfWeek:0});expect(rule.recurrence).toBe('WEEKLY');expect(schedule.matches(rule,new Date(2032,1,29,8))).toBe(true);expect(schedule.matches(rule,new Date(2032,2,1,8))).toBe(false);});
  it('clamps month end including leap years',()=>{const rule=schedule.parse({recurrence:'MONTHLY',dayOfMonth:31});for(const date of [new Date(2032,1,29,8),new Date(2033,1,28,8),new Date(2032,3,30,8)])expect(schedule.matches(rule,date)).toBe(true);expect(schedule.matches(rule,new Date(2032,2,30,8))).toBe(false);});
  it('respects inclusive daily windows across a year boundary',()=>{const rule=schedule.parse({recurrence:'DAILY',startsOn:'2032-12-31',endsOn:'2033-01-02'});expect(schedule.weekDates(rule,new Date(2032,11,29),1).map(d=>d.getDate())).toEqual([31,1,2]);expect(schedule.nextDate(rule,new Date(2033,0,3))).toBe(null);});
  it('rejects impossible dates, reversed windows and invalid month days',()=>{for(const body of [{startsOn:'2032-02-30'},{recurrence:'MONTHLY',dayOfMonth:0},{recurrence:'DAILY',dayOfWeek:true},{startsOn:'2033-01-02',endsOn:'2033-01-01'},{recurrence:'YEARLY'}])expect(()=>schedule.parse(body)).toThrow();});
  it('starts at the configured future window and preserves omitted fields',()=>{const rule=schedule.parse({recurrence:'MONTHLY',dayOfMonth:31,startsOn:'2032-02-01'});expect(schedule.nextDate(rule,new Date(2030,0,1)).getDate()).toBe(29);expect(schedule.parse({},rule)).toEqual(rule);expect(schedule.parse({recurrence:'WEEKLY'},rule).dayOfMonth).toBe(null);});
});
