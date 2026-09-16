import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
const { buildReview, mergeReminders } = createRequire(import.meta.url)('../frontend/cw-field-day-review.js');
const baseline = () => ({snapshot:{confirmedAt:new Date().toISOString(),visits:[]},water:[],pumps:{},outbox:{},drafts:{},photos:[],online:true});
describe('field end-of-day review', () => {
  it('marks a partial server failure as an incomplete review', () => {
    expect(buildReview({...baseline(),verificationErrors:['Água aberta']})[0]).toEqual({kind:'unknown',text:'Água aberta: não foi possível confirmar os dados no servidor. A revisão está incompleta.'});
  });
  it('includes a remote critical reminder absent from the device', () => {
    const rows=mergeReminders([],[{id:5,isCompleted:false,metadata:{localId:'remote',visitId:7,poolName:'Outra piscina'}}]);
    expect(rows).toHaveLength(1);expect(rows[0].serverId).toBe(5);
    expect(buildReview({...baseline(),water:rows})[0].text).toContain('Outra piscina — água aberta');
  });
  it('deduplicates server reminders and preserves a local physical confirmation', () => {
    const local=[{localId:'same',closed:true,serverId:5}];
    expect(mergeReminders(local,[{id:5,metadata:{localId:'same'}}],true)).toEqual(local);
    expect(mergeReminders([{localId:'same',closed:true}],[{id:5,metadata:{localId:'same'}}],true)).toHaveLength(1);
  });
  it('does not resurrect a reminder completed on the server', () => {
    expect(mergeReminders([],[{id:5,isCompleted:true,metadata:{localId:'closed'}}])).toEqual([]);
  });
  it('does not flag a water closure already acknowledged by the server', () => {
    expect(buildReview({...baseline(),water:[{serverId:5,status:'CLOSED',closeSyncedAt:new Date().toISOString()}]})).toEqual([]);
  });
  it('does not consider offline or unconfirmed routes checked', () => {
    const data=baseline();data.online=false;
    expect(buildReview(data)[0].kind).toBe('unknown');
    data.online=true;data.snapshot.confirmedAt=null;
    expect(buildReview(data)[0].kind).toBe('unknown');
  });
  it('keeps critical water and pump responsibility visible even after a visit ends', () => {
    const data=baseline();data.snapshot.visits=[{id:1,name:'Quinta',done:true}];
    data.water=[{visitId:1,status:'OPEN',serverId:4}];data.pumps={a:{visitId:1,serverId:5}};
    const rows=buildReview(data);
    expect(rows.filter(row=>row.kind==='critical')).toHaveLength(2);
    expect(rows.every(row=>row.text.includes('Quinta'))).toBe(true);
  });
  it('distinguishes physically closed reminders from server confirmation', () => {
    const data=baseline();data.water=[{visitId:1,status:'CLOSED',serverId:4}];data.pumps={a:{visitId:1,closed:true,serverId:5}};
    const rows=buildReview(data);
    expect(rows).toHaveLength(2);expect(rows.every(row=>row.kind==='pending')).toBe(true);
  });
  it('does not duplicate queued completions as unfinished work or include tomorrow', () => {
    const data=baseline();data.snapshot.visits=[{id:1,name:'Quinta'},{id:2,name:'Amanhã',future:true}];
    data.outbox={1:{visitId:1,blocked:true}};
    const rows=buildReview(data);expect(rows).toHaveLength(1);expect(rows[0].text).toContain('apoio do escritório');
  });
  it('includes photographs and unsent occurrences from visits outside the current route', () => {
    const data=baseline();data.photos=[{visitId:9},{visitId:9}];data.drafts={'visit-8':{pendingProblems:[{synced:false}]}};
    const rows=buildReview(data);expect(rows).toHaveLength(2);
    expect(rows[0].text).toContain('2 fotografia');expect(rows[1].text).toContain('Visita 8');
  });
  it('does not modify or resolve any source record', () => {
    const data=baseline();data.water=[{visitId:1,status:'OPEN'}];const before=JSON.stringify(data);
    buildReview(data);expect(JSON.stringify(data)).toBe(before);
    expect(buildReview(baseline())).toEqual([]);
  });
  it('keeps extra work visible when a regular visit with the same number has a queued completion', () => {
    const data=baseline();data.snapshot.visits=[{id:7,visitType:'EXTRA',name:'Extra pool'},{id:7,visitType:'REGULAR',name:'Regular pool'}];data.outbox={7:{visitId:7}};data.photos=[{visitId:7}];
    const rows=buildReview(data);expect(rows).toHaveLength(3);expect(rows[0].text).toContain('Extra pool — visita extra por confirmar');expect(rows[1].text).toContain('Regular pool — conclusão');expect(rows[2].text).toContain('Regular pool — 1 fotografia');
  });
});
