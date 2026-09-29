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
    const rows=buildReview(data);expect(rows).toHaveLength(3);expect(rows[0].text).toContain('Extra pool — visita extra por concluir');expect(rows[1].text).toContain('Regular pool — conclusão');expect(rows[2].text).toContain('Regular pool — 1 fotografia');
  });
  it.each([
    ['pt','água aberta','bomba em manual','trabalho por concluir','visita extra por concluir','fotografia(s) por enviar','Visita 99'],
    ['en','water left on','pump in manual mode','unfinished work','unfinished extra visit','photo(s) awaiting upload','Visit 99'],
    ['fr','eau ouverte','pompe en mode manuel','travail à terminer','visite supplémentaire à terminer','photo(s) à envoyer','Visite 99'],
    ['es','agua abierta','bomba en modo manual','trabajo sin terminar','visita extra sin terminar','foto(s) por enviar','Visita 99'],
    ['de','Wasser läuft','Pumpe im manuellen Modus','unerledigte Arbeit','unerledigter Zusatzbesuch','Foto(s) zum Senden','Besuch 99'],
  ])('renders owned review warnings in %s without changing source records or foreign text', (language,water,pump,regular,extra,photos,fallback) => {
    const literal='Guardar <img src=x> — routeUnknown {name}';
    const data={...baseline(),snapshot:{confirmedAt:'2026-09-29T10:00:00Z',visits:[{id:1,name:literal},{id:1,visitType:'EXTRA',name:literal}]},water:[{visitId:1,status:'OPEN',serverId:8}],pumps:{1:{visitId:1,serverId:9}},photos:[{visitId:99}],outbox:{2:{visitId:2,rejected:literal}},verificationErrors:[literal]};
    const before=JSON.stringify(data),rows=buildReview(data,language);
    for(const phrase of [water,pump,regular,extra,photos,fallback])expect(rows.some(row=>row.text.includes(phrase))).toBe(true);
    expect(rows[0].text.startsWith(literal+(language==='fr'?' : ':': '))).toBe(true);
    expect(rows.filter(row=>row.kind==='critical').every(row=>row.text.startsWith(literal+' — '))).toBe(true);
    expect(rows.some(row=>row.text.endsWith(literal))).toBe(true);
    expect(rows.every(row=>Object.keys(row).join(',')==='kind,text')).toBe(true);
    expect(JSON.stringify(data)).toBe(before);
  });
  it('normalizes a supported regional language and falls back to Portuguese', () => {
    const data={...baseline(),online:false};
    expect(buildReview(data,'en-GB')[0].text).toBe('Route not currently confirmed. Connect and refresh the schedule; the office may have made changes.');
    expect(buildReview(data,'unknown')).toEqual(buildReview(data));
  });
  it('keeps queue operation and blocked-state distinctions in translated copy', () => {
    const data={...baseline(),outbox:{a:{visitId:7,visitType:'EXTRA',scope:'EXTRA_VISIT_START'},b:{visitId:7,visitType:'EXTRA',scope:'EXTRA_VISIT_CORRECTION',blocked:true},c:{visitId:8,scope:'REGULAR_VISIT_COMPLETE'}}};
    expect(buildReview(data,'en').map(row=>row.text)).toEqual(['Visit 7 — start awaiting server confirmation.','Visit 7 — correction awaiting server confirmation; office support needed.','Visit 8 — completion awaiting server confirmation.']);
  });
});
