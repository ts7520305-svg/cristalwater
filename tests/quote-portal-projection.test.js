const { publicQuote } = require('../src/business/repair/QuotePortalBusiness');
describe('customer quote projection', () => {
 const fixture = () => ({ publishedAt: '2026-09-15', decisionAt: null, decision: null, quote: { id: 8, repairId: 3, version: 2, createdBy: 'private', snapshot: { currency: 'EUR', validUntil: '2030-01-01', lines: [{description:'Bomba',quantity:1,unitPrice:100,total:100,unitCost:80,marginPercent:20}], totalCost:80,profit:20,net:100,taxPercent:23,tax:23,total:123,terms:'Prazo de entrega' }, repair: { pool:{name:'Piscina'}, problem:'Bomba', status:'QUOTED', quotes:[{id:8}], notes:'private' } } });
 it('exposes selling prices only and checks latest version, expiry and terminal state', () => {
  const f=fixture(), now=new Date('2026-09-15');
  expect(publicQuote(f,now).status).toBe('PENDING');
  expect(JSON.stringify(publicQuote(f,now))).not.toMatch(/unitCost|marginPercent|totalCost|profit|private/);
  f.quote.repair.quotes[0].id=9;expect(publicQuote(f,now).status).toBe('SUPERSEDED');
  f.quote.repair.quotes[0].id=8;expect(publicQuote(f,new Date('2030-01-01')).status).toBe('EXPIRED');
  f.quote.repair.status='CANCELLED';expect(publicQuote(f,now).status).toBe('UNAVAILABLE');
  f.decision='APPROVED';expect(publicQuote(f,now).status).toBe('APPROVED');
 });
});
