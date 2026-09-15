import {it,expect} from 'vitest';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{yearsBefore}=require('../src/business/system/DataRetentionBusiness');
it('clamps leap-day retention anniversaries without deleting an extra day',()=>{
 expect(yearsBefore(new Date('2028-02-29T12:15:00Z'),1).toISOString()).toBe('2027-02-28T12:15:00.000Z');
 expect(yearsBefore(new Date('2028-03-01T12:15:00Z'),1).toISOString()).toBe('2027-03-01T12:15:00.000Z');
 expect(yearsBefore(new Date('2036-02-29T12:15:00Z'),10).toISOString()).toBe('2026-02-28T12:15:00.000Z');
});
