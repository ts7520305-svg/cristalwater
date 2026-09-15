import { describe, it, expect } from 'vitest';
const { spawnSync } = require('node:child_process');
describe('Long-running route calendars', () => {
  for (const timezone of ['UTC', 'Europe/Lisbon']) {
    it(`preserves daily, weekly and monthly rounds across 25 years in ${timezone}`, () => {
      const result = spawnSync(process.execPath, ['-e', `
        const assert = require('node:assert/strict');
        const schedule = require('./src/services/roundScheduleService');
        let days=0,months=0,leapDays=0;
        for(let date=new Date(2020,0,1,12);date<new Date(2045,0,1,12);date.setDate(date.getDate()+1)) {
          days++;
          if(date.getMonth()===1&&date.getDate()===29)leapDays++;
          const last=new Date(date.getFullYear(),date.getMonth()+1,0).getDate();
          assert(schedule.matches({recurrence:'DAILY'},date));
          for(let weekday=0;weekday<7;weekday++)assert.equal(schedule.matches({recurrence:'WEEKLY',dayOfWeek:weekday},date),date.getDay()===weekday);
          assert.equal(schedule.matches({recurrence:'MONTHLY',dayOfMonth:31},date),date.getDate()===last);
          if(date.getDate()===last)months++;
          if(date.getDate()===1){
            const next=schedule.nextDate({recurrence:'MONTHLY',dayOfMonth:31},date);
            assert.equal(next.getDate(),last);assert.equal(next.getMonth(),date.getMonth());assert.equal(next.getHours(),8);
            const week=schedule.weekDates({recurrence:'DAILY'},date);
            assert.equal(week.length,7);assert.equal(new Set(week.map(d=>d.toDateString())).size,7);
          }
        }
        assert.equal(days,9132);assert.equal(months,300);assert.equal(leapDays,7);
      `], { cwd: process.cwd(), env: { ...process.env, TZ: timezone }, encoding: 'utf8' });
      expect(result.stderr).toBe('');
      expect(result.status).toBe(0);
    });
  }
});
