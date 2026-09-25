'use strict';
const {prisma}=require('../prismaClient'),R=require('../../frontend/cw-extra-history-rules');
const fail=(message,statusCode)=>{throw Object.assign(Error(message),{statusCode});},literal=value=>value.replace(/[\\%_]/g,'\\$&');
async function read(actor,query={},database=prisma){
  const id=Number(actor?.userId||actor?.id);if(actor?.role!=='ADMIN'||!R.positive(id))fail('Consulta reservada à administração.',403);
  const filters=R.filters(query);if(!filters)fail('Reveja os filtros e a página.',400);
  const where={billed:true};for(const key of ['clientId','poolId'])if(filters[key])where[key]=filters[key];
  if(filters.from||filters.to)where.billedAt={...(filters.from?{gte:new Date(filters.from+'T00:00:00.000Z')} : {}),...(filters.to?{lte:new Date(filters.to+'T23:59:59.999Z')} : {})};
  if(filters.q){const contains={contains:literal(filters.q),mode:'insensitive'},numeric=filters.q.match(/^(?:CW-0*|#)?([1-9]\d*)$/i),value=numeric?Number(numeric[1]):null;where.OR=[{client:{name:contains}},{pool:{name:contains}},{notes:contains},...(R.positive(value)?[{id:value},{clientId:value},{poolId:value}]:[])];}
  return database.$transaction(async tx=>{
    for(const [key,model] of [['clientId','client'],['poolId','pool']])if(filters[key]&&!await tx[model].findUnique({where:{id:filters[key]},select:{id:true}}))fail('O cliente ou a piscina não está disponível.',404);
    const total=await tx.extraVisit.count({where}),rows=await tx.extraVisit.findMany({where,skip:(filters.page-1)*R.pageSize,take:R.pageSize,orderBy:[{billedAt:{sort:'desc',nulls:'last'}},{id:'desc'}],select:{id:true,clientId:true,poolId:true,billed:true,billedAt:true,scheduledAt:true,price:true,status:true,billingMode:true,notes:true,client:{select:{name:true}},pool:{select:{name:true,clientId:true}}}});
    const extras=rows.map(v=>({id:v.id,clientId:v.clientId,clientName:v.client?.name??null,poolId:v.poolId,poolName:v.pool?.name??null,poolClientId:v.pool?.clientId??null,clientReview:v.clientId===null?'MISSING':v.pool?.clientId!=null&&v.clientId!==v.pool.clientId?'POOL_CHANGED':'RECORDED',billed:v.billed,billedAt:v.billedAt?.toISOString()??null,scheduledAt:v.scheduledAt.toISOString(),status:v.status,billingMode:v.billingMode,priceRaw:String(v.price),priceCents:R.cents(String(v.price)),notes:v.notes}));
    const pages=Math.max(1,Math.ceil(total/R.pageSize)),owner='ADMIN:'+id,result={ok:true,version:1,owner,asOf:new Date().toISOString(),timeZone:'UTC',basis:'EXTRA_VISIT_BILLED_MARKER',filters,pageSize:R.pageSize,total,pages,hasPrevious:filters.page>1,hasNext:filters.page<pages,extras};
    if(!R.packet(result,filters,owner))throw Error('Invalid extra history source');return result;
  },{isolationLevel:'RepeatableRead',maxWait:15000,timeout:20000});
}
module.exports={read};
