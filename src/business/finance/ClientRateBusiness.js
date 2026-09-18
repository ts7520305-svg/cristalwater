const { prisma } = require('../../prismaClient');
const DAY = 86400000;
const services = require('../../services/clientServicePlan');
function fail(message, status = 400) { const error = new Error(message); error.status = status; throw error; }
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail('Data inválida; use AAAA-MM-DD');
  const n = new Date(value + 'T00:00:00Z');
  if (!Number.isFinite(n.getTime()) || n.toISOString().slice(0,10) !== value || value < '2000-01-01' || value > '2199-12-31') fail('Data inválida ou fora de 2000–2199');
  return n.getTime();
}
function cents(value) {
  if (!['number','string'].includes(typeof value) || String(value).trim() === '') fail('Valor mensal obrigatório');
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 10000000 || Math.abs(n * 100 - Math.round(n * 100)) > 0.000001) fail('Valor mensal inválido; use até duas casas decimais');
  return Math.round(n * 100);
}
function validate(payload = {}) {
  if (payload.servicePlan != null) {
    if (cents(payload.baseMonthlyAmount)!==0 || !Array.isArray(payload.periods) || payload.periods.length) fail('O plano sazonal define o preço total; não o combine com preços antigos.');
    return {currency:'EUR',baseCents:0,periods:[],method:'CALENDAR_DAY_PRORATA',servicePlan:services.validate(payload.servicePlan,cents)};
  }
  const baseCents = cents(payload.baseMonthlyAmount);
  if (!Array.isArray(payload.periods) || payload.periods.length > 200) fail('Indique até 200 períodos');
  const periods = payload.periods.map(p => {
    if (!p || typeof p !== 'object') fail('Período inválido');
    const start = date(p.startsOn), end = p.endsOn ? date(p.endsOn) : Infinity;
    if (end < start) fail('Fim anterior ao início');
    const label = String(p.label || '').trim();
    if (label.length > 120) fail('Designação demasiado longa');
    return { startsOn: p.startsOn, endsOn: p.endsOn || null, monthlyCents: cents(p.monthlyAmount), label };
  }).sort((a,b) => a.startsOn.localeCompare(b.startsOn));
  for (let i=1;i<periods.length;i++) if (!periods[i-1].endsOn || periods[i].startsOn <= periods[i-1].endsOn) fail('Os períodos não podem sobrepor-se; a data final está incluída');
  return { currency:'EUR', baseCents, periods, method:'CALENDAR_DAY_PRORATA' };
}
function month(ref) {
  if (typeof ref !== 'string' || !/^\d{4}-\d{2}$/.test(ref)) fail('Mês inválido; use AAAA-MM');
  const start = date(ref + '-01'), end = new Date(start); end.setUTCMonth(end.getUTCMonth()+1);
  return { start, end:end.getTime(), days:(end.getTime()-start)/DAY };
}
function calculate(snapshot, ref) {
  const range = month(ref), segments = []; let weightedCents = 0;
  for (let d=range.start;d<range.end;d+=DAY) {
    const day = new Date(d).toISOString().slice(0,10);
    const season=services.onDay(snapshot.servicePlan,day);
    const p = snapshot.servicePlan ? (season ? {monthlyCents:season.monthlyCents,startsOn:season.key,label:season.label} : {monthlyCents:0,startsOn:'OUTSIDE_CONTRACT',label:'Fora da vigência'}) : snapshot.periods.find(p => p.startsOn <= day && (!p.endsOn || p.endsOn >= day));
    const monthlyCents = p ? p.monthlyCents : snapshot.baseCents;
    weightedCents += monthlyCents;
    const source = p ? p.startsOn : 'BASE', previous = segments.at(-1);
    if (previous && previous.source === source) { previous.endsOn=day; previous.days++; }
    else segments.push({source,label:p?.label || (p ? 'Período acordado' : 'Preço base'),startsOn:day,endsOn:day,days:1,monthlyAmount:monthlyCents/100});
  }
  const amount = Math.round(weightedCents / range.days) / 100;
  return {monthRef:ref,amount,daysInMonth:range.days,segments,method:'CALENDAR_DAY_PRORATA'};
}
function clientId(value) { const id = Number(value); if (!Number.isSafeInteger(id) || id <= 0) fail('Cliente inválido'); return id; }
async function latest(id, db=prisma) { return db.clientRatePlan.findFirst({where:{clientId:clientId(id)},orderBy:{version:'desc'}}); }
async function read(id) {
  const client = await prisma.client.findUnique({where:{id:clientId(id)},include:{pools:true}});
  if (!client) fail('Cliente não encontrado',404);
  const plan = await latest(id);
  return {ok:true,clientId:client.id,clientName:client.name,plan,legacyBaseAmount:Math.round((Number(client.monthlyFee || client.monthlyAmount || 0)+(client.pools||[]).reduce((n,p)=>n+Number(p.monthlyAmount||0),0))*100)/100};
}
async function save(id, payload, actor) {
  if(payload?.servicePlan!=null)fail('Use a simulação conjunta de serviços e calendário para guardar o acordo sazonal.',409);
  const snapshot = validate(payload), target = clientId(id);
  if (!Number.isSafeInteger(payload.expectedVersion) || payload.expectedVersion < 0) fail('Versão inválida');
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Client" WHERE id = ${target} FOR UPDATE`;
    if (!await tx.client.findUnique({where:{id:target}})) fail('Cliente não encontrado',404);
    const previous = await latest(target,tx);
    if(previous?.snapshot?.servicePlan)fail('Este cliente tem serviços sazonais. Reveja o acordo no editor de serviços e visitas.',409);
    if ((previous?.version || 0) !== payload.expectedVersion) fail('Plano alterado por outra sessão. Recarregue antes de gravar.',409);
    const plan = await tx.clientRatePlan.create({data:{clientId:target,version:payload.expectedVersion+1,snapshot,createdBy:actor}});
    await tx.userAuditLog.create({data:{action:'CLIENT_RATE_PLAN_SAVED',actor,entity:'ClientRatePlan',entityId:String(plan.id),metadata:{clientId:target,version:plan.version}}});
    return {ok:true,plan};
  });
}
async function billing(client, ref, fallback, db=prisma) {
  month(ref);
  const plan = await latest(client.id,db);
  if (!plan) return {amount:fallback,planVersion:null};
  const existing = await db.invoice.findUnique({where:{clientId_monthRef:{clientId:client.id,monthRef:ref}},select:{id:true}});
  if (existing) fail('Já existe fatura neste mês. O plano de preços não altera documentos existentes.',409);
  return {...calculate(plan.snapshot,ref),planVersion:plan.version,planId:plan.id};
}
module.exports = {validate,calculate,read,save,billing,latest};
